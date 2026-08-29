import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/origin";
import { prisma } from "@/lib/prisma";
import { generatePersonalCode, generateSessionToken } from "@/lib/codes";
import { setSessionCookie } from "@/lib/session";
import { pickTeamIdForNewParticipant } from "@/lib/teams";
import { firstErrorMessage, joinSchema } from "@/lib/validation";
import { sendVerificationEmail } from "@/lib/send-verification";
import {
  DUPLICATE_EMAIL_MESSAGE,
  emailTaken,
  isDuplicateEmailError,
} from "@/lib/email-uniqueness";

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
    entryCode, passcode, nickname, realName, socialUrl, bio, icons, email,
    zodiac, university,
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

  /*
    信箱重複檢查刻意放在通關碼之後。

    這個回應會透露「某個信箱有沒有報到過」，而通關碼只在現場公布——
    先驗通關碼，等於把這個資訊限制在人已經到場的情況下。
    /api/recover 沒有這道門，所以它必須不分存在與否都回相同內容（ADR-0001）。
  */
  if (email && (await emailTaken(entry.eventId, email))) {
    return NextResponse.json(
      { error: DUPLICATE_EMAIL_MESSAGE },
      { status: 409 },
    );
  }

  const sessionToken = generateSessionToken();
  const personalCode = generatePersonalCode();

  // 分隊必須與建立 Participant 在同一個交易內，否則併發報到會讀到過期的人數。
  let participant;
  try {
    participant = await prisma.$transaction(async (tx) => {
      const teamId = await pickTeamIdForNewParticipant(tx, entry.eventId, entry.role);

      return tx.participant.create({
        data: {
          eventId: entry.eventId,
          role: entry.role, // Role 由所掃描的 Entry Code 決定，事後不變
          teamId,
          sessionToken,
          personalCode,
          nickname,
          realName,
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
  } catch (e) {
    // 上面的事前檢查與這次寫入之間，可能有另一個請求用同一個信箱插進來。
    if (isDuplicateEmailError(e)) {
      return NextResponse.json(
        { error: DUPLICATE_EMAIL_MESSAGE },
        { status: 409 },
      );
    }
    throw e;
  }

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
