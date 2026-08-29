import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getCurrentAdmin,
  requireEventAccess,
  resolveAdminEvent,
} from "@/lib/admin-session";
import { firstErrorMessage } from "@/lib/validation";

const settingsSchema = z.object({
  passcode: z.string().trim().min(1, "通關碼不可為空").max(32),
  // 全場最多 70 人，任何人最多只能掃到 69 個——基礎分設太高會讓
  // 成就獎勵完全失去份量，因此設上限。
  basePoints: z.number().int().min(0).max(1000),
  leaderboardTopN: z.number().int().min(1).max(100),
});

/** 讀取目前活動的設定。 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const event = await resolveAdminEvent(admin);
  if (!event) {
    return NextResponse.json({ error: "找不到活動" }, { status: 404 });
  }

  // 明確挑欄位，不整包回傳——Event 上有 archivedAt、purgeAfter 等
  // 這個端點不需要的東西，順手端出去只會擴大暴露面。
  return NextResponse.json({
    id: event.id,
    name: event.name,
    passcode: event.passcode,
    basePoints: event.basePoints,
    leaderboardTopN: event.leaderboardTopN,
    teamCount: event.teamCount,
    status: event.status,
  });
}

/**
 * 修改活動設定。
 *
 * 這些值原本只能從種子檔設定，主辦方無從更改——正式活動前必須換掉
 * 預設通關碼，卻沒有換的方法。
 *
 * 通關碼改動立即生效：已經報到的人不受影響（他們的身分已經建立），
 * 尚未報到的人必須使用新的通關碼。這正是活動中途發現舊碼外流時
 * 需要的行為。
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

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  // 通關碼與基礎分是整場活動的設定，改錯場的後果立即而全面。
  const requested =
    typeof (raw as { eventId?: unknown })?.eventId === "string"
      ? (raw as { eventId: string }).eventId
      : null;
  const event = requested
    ? await requireEventAccess(admin, requested)
    : await resolveAdminEvent(admin);
  if (!event) {
    return NextResponse.json({ error: "找不到活動" }, { status: 404 });
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: parsed.data,
    select: {
      passcode: true,
      basePoints: true,
      leaderboardTopN: true,
    },
  });

  return NextResponse.json(updated);
}
