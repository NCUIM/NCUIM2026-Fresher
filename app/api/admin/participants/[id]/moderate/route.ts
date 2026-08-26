import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";

const moderateSchema = z.object({
  clearAvatar: z.boolean().optional(),
  clearBio: z.boolean().optional(),
  clearSocialUrl: z.boolean().optional(),
  nickname: z.string().trim().min(1).max(20).optional(),
});

/**
 * 移除違規的 Profile 內容。
 *
 * 因為 Card 是即時引用 Profile 而非收集當下的快照，這裡清空欄位後，
 * 所有已經收集過此人的參與者手上那張卡片會立刻跟著更新——
 * 這正是當初不採用快照的原因。
 */
export async function POST(
  req: Request,
  ctx: RouteContext<"/api/admin/participants/[id]/moderate">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = moderateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入內容有誤" }, { status: 400 });
  }
  const { clearAvatar, clearBio, clearSocialUrl, nickname } = parsed.data;

  // 清除頭像時連影像本體一起刪掉，否則 /api/avatar/{id} 仍取得到那張圖，
  // 「移除」就只是把它從畫面上藏起來而已。
  if (clearAvatar) {
    await prisma.avatar.deleteMany({ where: { participantId: id } });
  }

  const updated = await prisma.participant.update({
    where: { id },
    data: {
      ...(clearAvatar ? { avatarUrl: null } : {}),
      ...(clearBio ? { bio: null } : {}),
      ...(clearSocialUrl ? { socialUrl: null } : {}),
      ...(nickname ? { nickname } : {}),
    },
    select: { id: true, nickname: true, avatarUrl: true, bio: true, socialUrl: true },
  });

  return NextResponse.json(updated);
}
