import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 驗證 Entry Code 並回傳報到頁需要的資訊。
 *
 * 刻意不回傳 passcode——它必須由現場宣布，若隨頁面一起送出就完全失去
 * 「擋住不在場的人」的作用（Q21）。
 *
 * 手動輸入的補救路徑靠這裡「先問過再導向」：直接導向 /join/[code] 的話，
 * 代碼打錯的人會落在那頁的錯誤畫面上，而那裡沒有返回入口，也沒有輸入框。
 * 錯誤訊息因此寫成給使用者看的語氣，它會直接顯示在輸入框下方。
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
    return NextResponse.json(
      { error: "查不到這組報到碼" },
      { status: 404 },
    );
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
