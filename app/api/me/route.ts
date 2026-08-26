import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { firstErrorMessage, profileSchema } from "@/lib/validation";
import { sendVerificationEmail } from "@/lib/send-verification";
import { computeScore, pendingImpressions } from "@/lib/score";
import { evaluateAchievements, getAchievementStatus } from "@/lib/achievements";

/** 目前登入者的身分、分數與待辦。 */
export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  // 讀取前先評估一次。發放是冪等的，這讓顯示永遠與當前狀態一致，
  // 即使某次觸發點被漏掉也不會讓人少拿成就。
  await evaluateAchievements(me.id);

  const [score, pending, achievements] = await Promise.all([
    computeScore(me.id),
    pendingImpressions(me.id),
    getAchievementStatus(me.id),
  ]);

  return NextResponse.json({
    id: me.id,
    nickname: me.nickname,
    role: me.role,
    avatarUrl: me.avatarUrl,
    bio: me.bio,
    socialUrl: me.socialUrl,
    icons: me.icons,
    email: me.email,
    emailVerified: me.emailVerified,
    personalCode: me.personalCode,
    team: me.team ? { number: me.team.number, name: me.team.name } : null,
    score,
    pendingImpressions: pending,
    achievements,
  });
}

/**
 * 修改自己的 Profile。
 *
 * 因為 Card 即時引用 Profile 而非快照，這裡的修改會立刻反映到所有
 * 收集過此人的參與者手上——打錯的暱稱不會永遠留在別人的清單裡。
 */
export async function PUT(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { nickname, socialUrl, bio, icons, email } = parsed.data;

  // 信箱換了就必須重新驗證：舊的驗證狀態只證明了舊位址收得到信。
  const emailChanged = (email ?? null) !== me.email;

  const updated = await prisma.participant.update({
    where: { id: me.id },
    data: {
      nickname,
      socialUrl: socialUrl ?? null,
      bio: bio ?? null,
      icons,
      email: email ?? null,
      ...(emailChanged ? { emailVerified: false } : {}),
    },
    select: {
      nickname: true,
      socialUrl: true,
      bio: true,
      icons: true,
      email: true,
      emailVerified: true,
    },
  });

  if (emailChanged && email) {
    await sendVerificationEmail(me.id, new URL(req.url).origin);
  }

  return NextResponse.json(updated);
}
