import { NextResponse } from "next/server";
import { getPublicOrigin } from "@/lib/origin";
import { getCurrentParticipant } from "@/lib/session";
import { sendVerificationEmail } from "@/lib/send-verification";

/** 重寄驗證信。issueToken 會把同用途的舊權杖一併作廢。 */
export async function POST(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }
  if (!me.email) {
    return NextResponse.json({ error: "還沒有填寫信箱" }, { status: 400 });
  }
  if (me.emailVerified) {
    return NextResponse.json({ error: "信箱已經驗證過了" }, { status: 409 });
  }

  await sendVerificationEmail(me.id, await getPublicOrigin());
  return NextResponse.json({ ok: true });
}
