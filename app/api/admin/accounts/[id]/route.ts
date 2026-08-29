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
  if (admin.role !== "SUPER") {
    return NextResponse.json(
      { error: "只有總管理員可以管理帳號" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;

  if (id === admin.id) {
    return NextResponse.json(
      { error: "不能移除自己的帳號" },
      { status: 409 },
    );
  }

  const target = await prisma.admin.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "找不到這個帳號" }, { status: 404 });
  }

  /*
    真正不能沒有的是總管理員，不是「任何管理員」。
    只剩主持人的話，沒有人能新增帳號、建立活動或指派主持人——
    後台等於只剩半套，得回去改資料庫才救得回來。
  */
  if (target.role === "SUPER") {
    const supers = await prisma.admin.count({ where: { role: "SUPER" } });
    if (supers <= 1) {
      return NextResponse.json(
        { error: "這是最後一位總管理員，移除後就沒有人能管理帳號與活動" },
        { status: 409 },
      );
    }
  }

  // AdminSession 為 cascade，刪除帳號會同時登出他所有的裝置。
  await prisma.admin.delete({ where: { id } });

  return NextResponse.json({ ok: true, username: target.username });
}
