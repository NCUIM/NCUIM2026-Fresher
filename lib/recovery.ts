import type { TokenPurpose } from "@prisma/client";
import { prisma } from "./prisma";
import { generateSessionToken } from "./codes";

export const TTL_MINUTES: Record<TokenPurpose, number> = {
  // 驗證信可能在報到後隔一陣子才被點開，給整場活動加上緩衝的時間。
  VERIFY_EMAIL: 60 * 24,
  // 找回身分的連結權限最大，存活時間壓到最短。
  RECOVER_SESSION: 30,
};

export async function issueToken(
  participantId: string,
  purpose: TokenPurpose,
): Promise<string> {
  // 同一用途的舊權杖先作廢：避免信箱裡累積多把仍然有效的鑰匙。
  await prisma.recoveryToken.updateMany({
    where: { participantId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = generateSessionToken();
  await prisma.recoveryToken.create({
    data: {
      participantId,
      purpose,
      token,
      expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60_000),
    },
  });
  return token;
}

export type PeekResult = { ok: true; nickname: string } | { ok: false };

/**
 * 檢視權杖現在能不能用，**但不消費它**。
 *
 * 存在的理由是把「看」與「用」拆成兩個動作。先前 /recover/[token] 是一支
 * GET，在被開啟的當下就消費權杖並種下身分 cookie——於是任何人都能替自己
 * 要一封找回信，再把那個連結傳給別人，對方的瀏覽器就會靜默地變成傳連結
 * 的那個人（session fixation）。受害者之後掃到的人、寫的每一則短評、
 * 填進去的真實姓名與信箱，全部進到攻擊者的帳號裡。
 *
 * 拆開之後，種 cookie 一定來自使用者在確認頁按下的那一個 POST，
 * 而 GET 回到它應有的樣子：沒有副作用。
 *
 * 順帶解掉另一個問題——信件掃描器與聊天軟體的連結預覽會預先抓取網址，
 * 那會在本人點開之前就把一次性權杖燒掉，使用者只會看到「連結已失效」。
 *
 * 回傳暱稱供確認頁顯示「你是不是 XXX」。這不算多洩漏什麼：能拿到權杖的人
 * 本來就能直接完成找回，暱稱也是卡片上對外公開的欄位。
 */
export async function peekToken(
  token: string,
  purpose: TokenPurpose,
): Promise<PeekResult> {
  const row = await prisma.recoveryToken.findUnique({
    where: { token },
    include: { participant: { select: { nickname: true } } },
  });

  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) {
    return { ok: false };
  }

  return { ok: true, nickname: row.participant.nickname };
}

export type ConsumeResult =
  | { ok: true; participantId: string; sessionToken: string }
  | { ok: false };

/**
 * 使用一次性權杖。成功後立即標記為已用。
 *
 * 過期、已用過、用途不符都回傳同一種失敗——對使用者而言差別只是
 * 「請再要一次新的連結」，區分這些狀態只會多洩漏資訊。
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<ConsumeResult> {
  const row = await prisma.recoveryToken.findUnique({
    where: { token },
    include: { participant: { select: { id: true, sessionToken: true } } },
  });

  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) {
    return { ok: false };
  }

  await prisma.recoveryToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return {
    ok: true,
    participantId: row.participantId,
    sessionToken: row.participant.sessionToken,
  };
}

/** 標記信箱已驗證。未驗證的信箱不允許用來找回身分。 */
export async function markEmailVerified(participantId: string): Promise<void> {
  await prisma.participant.update({
    where: { id: participantId },
    data: { emailVerified: true },
  });
}

/**
 * 找出可用於找回身分的參與者。
 *
 * **只接受已驗證的信箱。** 若允許未驗證的信箱，一個打錯的位址
 * （例如把 gmail 打成 gmial）會讓找回連結寄到不相干的人手上，
 * 而那個人就能接管這個身分。要求先驗證，也讓報到頁那個
 * 「信箱尚未驗證」的提示真正有意義。
 */
export async function findRecoverable(email: string) {
  return prisma.participant.findFirst({
    where: {
      email: { equals: email.trim(), mode: "insensitive" },
      emailVerified: true,
      event: { status: { in: ["ACTIVE", "ARCHIVED"] } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** 換發身分憑證，用於工作人員協助或使用者主動作廢舊裝置。 */
export async function rotateSessionToken(participantId: string): Promise<string> {
  const sessionToken = generateSessionToken();
  await prisma.participant.update({
    where: { id: participantId },
    data: { sessionToken },
  });
  return sessionToken;
}
