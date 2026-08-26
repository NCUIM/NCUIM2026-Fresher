import { NextResponse } from "next/server";
import { z } from "zod";
import { loginAdmin } from "@/lib/admin-session";

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "帳號或密碼不正確" }, { status: 401 });
  }

  const ok = await loginAdmin(parsed.data.username, parsed.data.password);
  if (!ok) {
    // 帳號不存在與密碼錯誤回傳完全相同的訊息與狀態碼，
    // 否則這個端點會變成列舉有效帳號的工具。
    return NextResponse.json({ error: "帳號或密碼不正確" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
