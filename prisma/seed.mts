import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEFAULT_ACHIEVEMENTS } from "../lib/achievements.config.ts";
import { hashPassword } from "../lib/password.ts";

// 副檔名為 .mts：確保無論 package.json 的 type 為何都以 ESM 執行。
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_EVENT_NAME = "NCUIM 2026 新生歡迎會";
const DEMO_PASSCODE = "1234";
const DEMO_TEAM_COUNT = 10; // 70 人 ÷ 10 隊 ≈ 每隊 7 人
const ENTRY_CODE_PARTICIPANT = "JOINNCU1";
const ENTRY_CODE_STAFF = "STAFFNCU";

async function main() {
  const existing = await prisma.event.findFirst({
    where: { name: DEMO_EVENT_NAME },
  });
  if (existing) {
    console.log(`已存在示範活動（id=${existing.id}），略過建立。`);
  } else {
    const event = await prisma.event.create({
      data: {
        name: DEMO_EVENT_NAME,
        passcode: DEMO_PASSCODE,
        startsAt: new Date(),
        basePoints: 10,
        leaderboardTopN: 10,
        teamCount: DEMO_TEAM_COUNT,
        entryCodes: {
          create: [
            { code: ENTRY_CODE_PARTICIPANT, role: "PARTICIPANT", label: "一般參與者" },
            { code: ENTRY_CODE_STAFF, role: "STAFF", label: "工作人員" },
          ],
        },
        teams: {
          create: Array.from({ length: DEMO_TEAM_COUNT }, (_, i) => ({
            number: i + 1,
            name: `第 ${i + 1} 組`,
          })),
        },
        achievements: {
          create: DEFAULT_ACHIEVEMENTS.map((a) => ({
            key: a.key,
            type: a.type,
            threshold: a.threshold,
            points: a.points,
            hidden: a.hidden,
            title: a.title,
            description: a.description ?? null,
            targetRole: a.targetRole ?? null,
          })),
        },
      },
    });

    console.log(`已建立活動：${event.name}`);
    console.log(`  通關碼           ${DEMO_PASSCODE}`);
    console.log(`  一般參與者註冊碼 ${ENTRY_CODE_PARTICIPANT}`);
    console.log(`  工作人員註冊碼   ${ENTRY_CODE_STAFF}`);
    console.log(`  組別             ${DEMO_TEAM_COUNT} 組`);
    console.log(`  成就             ${DEFAULT_ACHIEVEMENTS.length} 項`);
  }

  const username = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "change-me";
  const admin = await prisma.admin.findUnique({ where: { username } });
  if (admin) {
    console.log(`管理員 ${username} 已存在，略過建立。`);
  } else {
    /*
      種子建立的是總管理員——它是這個系統的第一個帳號，必須能建立活動
      與其他帳號，否則全新環境會卡在「沒有人有權限新增任何東西」。
      之後的主持人帳號從後台建立，預設是權限較低的 HOST。
    */
    await prisma.admin.create({
      data: {
        username,
        passwordHash: await hashPassword(password),
        role: "SUPER",
      },
    });
    console.log(`已建立總管理員：${username}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
