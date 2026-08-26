import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * 刪除已過保留期的活動個資。
 *
 * 第一階段刻意由人手動執行，不做排程：自動刪除若在設定錯誤時觸發，
 * 造成的損失無法回復，而每年只辦幾場活動，手動執行的成本可以忽略。
 *
 * 刪除 Participant 即透過 cascade 清掉 Scan、Collection、Impression、
 * ShowcaseSlot 與 AchievementEarned。Event 本身與其成就設定保留，
 * 供事後檢視統計結構。
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const dryRun = !process.argv.includes("--confirm");

const expired = await prisma.event.findMany({
  where: { status: "ARCHIVED", purgeAfter: { lte: new Date() } },
  select: {
    id: true,
    name: true,
    purgeAfter: true,
    _count: { select: { participants: true } },
  },
});

if (expired.length === 0) {
  console.log("沒有到期的活動。");
} else {
  for (const e of expired) {
    console.log(
      `${dryRun ? "[預覽]" : "[刪除]"} ${e.name}：` +
        `${e._count.participants} 位參與者，` +
        `到期日 ${e.purgeAfter?.toLocaleDateString("zh-TW")}`,
    );
    if (!dryRun) {
      await prisma.participant.deleteMany({ where: { eventId: e.id } });
      await prisma.announcement.deleteMany({ where: { eventId: e.id } });
    }
  }
  if (dryRun) {
    console.log("\n這是預覽。確定要執行請加上 --confirm。");
  }
}

await prisma.$disconnect();
