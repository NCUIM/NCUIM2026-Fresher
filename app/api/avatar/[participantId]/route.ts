import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 提供頭像影像。
 *
 * 不需要驗證身分：頭像本來就是 Card 的一部分，會顯示給所有收集到此人的人，
 * 而網址中的 participantId 並非機密。加上驗證只會讓圖片無法被瀏覽器快取。
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/avatar/[participantId]">,
) {
  const { participantId } = await ctx.params;

  const avatar = await prisma.avatar.findUnique({
    where: { participantId },
  });

  if (!avatar) {
    return NextResponse.json({ error: "找不到圖片" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.contentType,
      // 網址帶版本戳，內容一旦變動網址就會變，因此可以放心長期快取。
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(avatar.data.length),
    },
  });
}
