import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { getShowcase } from "@/lib/showcase";

/**
 * 瀏覽某人的九宮格。九宮格是公開的——上面放的是 Card，本來就是公開資訊。
 *
 * 這裡只回傳「這個人選了誰」，永遠不回傳「這個人被幾個人選中」（ADR-0003）。
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/showcase/[participantId]">,
) {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  const { participantId } = await ctx.params;

  const owner = await prisma.participant.findUnique({
    where: { id: participantId },
    select: { id: true, nickname: true, eventId: true },
  });
  if (!owner || owner.eventId !== me.eventId) {
    return NextResponse.json({ error: "找不到這個人" }, { status: 404 });
  }

  return NextResponse.json({
    owner: { id: owner.id, nickname: owner.nickname },
    slots: await getShowcase(owner.id),
  });
}
