import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * 開發用：清空所有 Participant 及其衍生資料，保留 Event、Team、
 * AchievementDef 與 Admin。方便重複測試報到流程。
 *
 * 外鍵皆為 onDelete: Cascade，因此刪除 Participant 會一併清掉
 * Scan、Collection、Impression、ShowcaseSlot 與 AchievementEarned。
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const { count } = await prisma.participant.deleteMany({});
console.log(`已刪除 ${count} 位 Participant 及其所有衍生資料。`);

await prisma.$disconnect();
