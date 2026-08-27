import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { generatePersonalCode, generateSessionToken } from "@/lib/codes";
import { setSessionCookie } from "@/lib/session";
import { pickTeamIdForNewParticipant } from "@/lib/teams";
import { firstErrorMessage, joinSchema } from "@/lib/validation";
import { sendVerificationEmail } from "@/lib/send-verification";

/** 報到：驗證 Entry Code 與通關碼，建立 Participant，並種下身分 cookie。 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }
  const {
    entryCode, passcode, nickname, socialUrl, bio, icons, email, zodiac, university,
  } = parsed.data;

  const entry = await prisma.entryCode.findUnique({
    where: { code: entryCode.toUpperCase() },
    include: { event: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "註冊碼不存在" }, { status: 404 });
  }
  if (entry.event.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "這場活動已經結束，無法再報到" },
      { status: 409 },
    );
  }
  if (entry.event.passcode !== passcode) {
    return NextResponse.json({ error: "活動通關碼不正確" }, { status: 403 });
  }

  const sessionToken = generateSessionToken();
  const personalCode = generatePersonalCode();

  // 分隊必須與建立 Participant 在同一個交易內，否則併發報到會讀到過期的人數。
  const participant = await prisma.$transaction(async (tx) => {
    const teamId = await pickTeamIdForNewParticipant(tx, entry.eventId, entry.role);

    return tx.participant.create({
      data: {
        eventId: entry.eventId,
        role: entry.role, // Role 由所掃描的 Entry Code 決定，事後不變
        teamId,
        sessionToken,
        personalCode,
        nickname,
        socialUrl: socialUrl ?? null,
        bio: bio ?? null,
        icons,
        email: email ?? null,
        zodiac: zodiac ?? null,
        university: university?.trim() || null,
      },
      include: { team: true },
    });
  });

  await setSessionCookie(sessionToken);

  // 等待權杖建立完成（只有 SMTP 呼叫在背景進行），
  // 這樣請求回傳時系統狀態已經確定，使用者立刻點開信中的連結也不會撲空。
  if (email) {
    await sendVerificationEmail(participant.id, await getPublicOrigin());
  }

  // 回應中不含 sessionToken——它只存在於 HttpOnly cookie 裡。
  return NextResponse.json(
    {
      id: participant.id,
      nickname: participant.nickname,
      role: participant.role,
      personalCode: participant.personalCode,
      team: participant.team
        ? { number: participant.team.number, name: participant.team.name }
        : null,
    },
    { status: 201 },
  );
}
