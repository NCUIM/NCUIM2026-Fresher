import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { generateEntryCode } from "@/lib/codes";
import { DEFAULT_ACHIEVEMENTS } from "@/lib/achievements.config";
import { firstErrorMessage } from "@/lib/validation";

const createSchema = z.object({
  name: z.string().trim().min(1, "請輸入活動名稱").max(60),
  passcode: z.string().trim().min(1, "請設定通關碼").max(40),
  startsAt: z.string().min(1, "請設定開始時間"),
  teamCount: z.number().int().min(0).max(50),
  basePoints: z.number().int().min(0).max(1000),
  leaderboardTopN: z.number().int().min(1).max(100),
});

/**
 * 活動總覽。**僅限總管理員**——主持人只該看得到自己被指派的那一場，
 * 這裡回傳的是全部。
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }
  if (admin.role !== "SUPER") {
    return NextResponse.json(
      { error: "只有總管理員可以查看所有活動" },
      { status: 403 },
    );
  }

  const events = await prisma.event.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      archivedAt: true,
      purgeAfter: true,
      basePoints: true,
      leaderboardTopN: true,
      teamCount: true,
      createdAt: true,
      _count: { select: { participants: true, teams: true, achievements: true } },
      hosts: {
        select: { admin: { select: { id: true, username: true } } },
      },
    },
  });

  return NextResponse.json({ events, activeEventId: admin.activeEventId });
}

/**
 * 建立活動。
 *
 * 一併產生註冊碼、分組與成就——只建 Event 本身的話，那場活動什麼都做不了：
 * 沒有註冊碼就沒有人進得來，沒有成就則整個計分只剩基礎分。
 * 這正是 seed 在做的事，這裡把它搬到後台。
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }
  if (admin.role !== "SUPER") {
    return NextResponse.json(
      { error: "只有總管理員可以建立活動" },
      { status: 403 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { name, passcode, startsAt, teamCount, basePoints, leaderboardTopN } =
    parsed.data;

  const startsAtDate = new Date(startsAt);
  if (Number.isNaN(startsAtDate.getTime())) {
    return NextResponse.json({ error: "開始時間格式不正確" }, { status: 400 });
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        name,
        passcode,
        startsAt: startsAtDate,
        teamCount,
        basePoints,
        leaderboardTopN,
      },
    });

    await tx.entryCode.createMany({
      data: [
        { eventId: created.id, code: generateEntryCode(), role: "PARTICIPANT", label: "一般參與者" },
        { eventId: created.id, code: generateEntryCode(), role: "STAFF", label: "工作人員" },
      ],
    });

    if (teamCount > 0) {
      await tx.team.createMany({
        data: Array.from({ length: teamCount }, (_, i) => ({
          eventId: created.id,
          number: i + 1,
        })),
      });
    }

    await tx.achievementDef.createMany({
      data: DEFAULT_ACHIEVEMENTS.map((a) => ({
        eventId: created.id,
        key: a.key,
        type: a.type,
        threshold: a.threshold,
        points: a.points,
        hidden: a.hidden,
        title: a.title,
        description: a.description ?? null,
        targetRole: a.targetRole ?? null,
      })),
    });

    return created;
  });

  return NextResponse.json(event, { status: 201 });
}
