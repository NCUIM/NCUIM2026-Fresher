import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { hashPassword, verifyPassword } from "@/lib/password";
import { firstErrorMessage } from "@/lib/validation";

const schema = z.object({
  currentPassword: z.string().min(1, "請輸入目前的密碼"),
  newPassword: z.string().min(8, "新密碼至少 8 個字元").max(128),
});

/**
 * 修改自己的密碼。
 *
 * 需要目前的密碼：管理員的登入狀態可能停留在某台沒鎖螢幕的電腦上，
 * 只憑 session 就能改密碼的話，任何人都能把帳號接管過去。
 *
 * 改完後撤銷其他所有工作階段——換密碼通常代表懷疑帳號外流，
 * 若舊的登入仍然有效，換密碼就沒有意義。
 */
export async function PATCH(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const ok = await verifyPassword(parsed.data.currentPassword, admin.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "目前的密碼不正確" }, { status: 403 });
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });

  await prisma.adminSession.deleteMany({ where: { adminId: admin.id } });

  return NextResponse.json({
    ok: true,
    message: "密碼已更新，所有裝置都已登出，請重新登入。",
  });
}
