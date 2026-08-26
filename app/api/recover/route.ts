import { NextResponse } from "next/server";
import { findRecoverable, issueToken } from "@/lib/recovery";
import { recoveryBody, sendMail } from "@/lib/mailer";
import { recoveryRequestSchema } from "@/lib/validation";

/**
 * 要求一封找回身分的信。
 *
 * **無論信箱是否存在，回應一律相同。** 若對「查無此信箱」給出不同答覆，
 * 任何人都能用這個端點逐一測試某個信箱有沒有參加這場活動——
 * 對一群新生而言，這本身就是不該外洩的資訊。
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = recoveryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "信箱格式不正確" }, { status: 400 });
  }

  const participant = await findRecoverable(parsed.data.email);

  if (participant) {
    const token = await issueToken(participant.id, "RECOVER_SESSION");
    try {
      await sendMail({
        to: participant.email!,
        subject: "找回你的收集成果",
        text: recoveryBody(
          participant.nickname,
          `${new URL(req.url).origin}/recover/${token}`,
        ),
      });
    } catch (e) {
      // 寄送失敗也不改變回應內容，否則同樣會洩漏信箱是否存在。
      console.error("[recover] 寄送失敗", e);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "如果這個信箱有已驗證的報到紀錄，我們已經寄出找回連結。",
  });
}
