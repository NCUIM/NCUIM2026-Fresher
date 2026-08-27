import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";

/**
 * 移除管理員。
 *
 * 兩道防護：不能刪自己（會把自己鎖在門外），也不能刪掉最後一位
 * （後台就再也沒有人進得去，只能改資料庫）。
 */
export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/admin/accounts/[id]">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;

  if (id === admin.id) {
    return NextResponse.json(
      { error: "不能移除自己的帳號" },
      { status: 409 },
    );
  }

  const total = await prisma.admin.count();
  if (total <= 1) {
    return NextResponse.json(
      { error: "這是最後一位管理員，移除後就沒有人進得了後台" },
      { status: 409 },
    );
  }

  const target = await prisma.admin.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "找不到這個帳號" }, { status: 404 });
  }

  // AdminSession 為 cascade，刪除帳號會同時登出他所有的裝置。
  await prisma.admin.delete({ where: { id } });

  return NextResponse.json({ ok: true, username: target.username });
}
