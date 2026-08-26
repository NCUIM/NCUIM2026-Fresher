import type { TokenPurpose } from "@prisma/client";
import { prisma } from "./prisma";
import { generateSessionToken } from "./codes";

const TTL_MINUTES: Record<TokenPurpose, number> = {
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
