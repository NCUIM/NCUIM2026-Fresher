import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAdmin, loginAdmin } from "@/lib/admin-session";

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

  /*
    回傳登入後該去哪裡，由伺服器決定而不是前端猜。

    總管理員先看總管理後台——他要處理的第一個問題通常是「這次要管哪一場」。
    主持人直接進活動選單，只被指派一場時那一頁會再把他送進去。
  */
  const admin = await getCurrentAdmin();
  return NextResponse.json({
    ok: true,
    role: admin?.role ?? "HOST",
    redirectTo: admin?.role === "SUPER" ? "/admin" : "/admin/events",
  });
}
