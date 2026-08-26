import { prisma } from "./prisma";
import { issueToken } from "./recovery";
import { sendMail, verifyEmailBody } from "./mailer";

/**
 * 建立驗證權杖並寄出驗證信。
 *
 * ⚠️ 權杖必須**同步**建立，只有 SMTP 呼叫可以非同步。
 * 若整個流程都丟到背景，請求回傳後系統狀態是不確定的——
 * 使用者可能在權杖寫入資料庫之前就點開了信中的連結。
 *
 * 寄信本身則允許失敗：SMTP 掛掉不該讓報到跟著失敗（Q20 的非阻斷原則）。
 */
export async function sendVerificationEmail(
  participantId: string,
  origin: string,
): Promise<void> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { email: true, nickname: true },
  });
  if (!participant?.email) return;

  const token = await issueToken(participantId, "VERIFY_EMAIL");

  void sendMail({
    to: participant.email,
    subject: "請確認你的信箱",
    text: verifyEmailBody(participant.nickname, `${origin}/verify/${token}`),
  }).catch((e) => console.error("[mailer] 驗證信寄送失敗", e));
}
