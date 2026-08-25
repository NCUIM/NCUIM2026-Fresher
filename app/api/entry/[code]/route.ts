import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 驗證 Entry Code 並回傳報到頁需要的資訊。
 *
 * 刻意不回傳 passcode——它必須由現場宣布，若隨頁面一起送出就完全失去
 * 「擋住不在場的人」的作用（Q21）。
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/entry/[code]">,
) {
  const { code } = await ctx.params;

  const entry = await prisma.entryCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { event: true },
  });

  if (!entry) {
    return NextResponse.json({ error: "註冊碼不存在" }, { status: 404 });
  }

  if (entry.event.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "這場活動已經結束，無法再報到" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    entryCode: entry.code,
    role: entry.role,
    label: entry.label,
    event: {
      id: entry.event.id,
      name: entry.event.name,
    },
  });
}
