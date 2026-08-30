import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../lib/password.ts";

/**
 * 建立第一個總管理員，只做這一件事。
 *
 * 為什麼正式環境不用 `npm run db:seed`：那支種子還會建一場示範活動，
 * 附帶寫死的報到碼 JOINNCU1 與通關碼 1234。那組碼在原始碼裡、在文件裡、
 * 也在每一份 git 紀錄裡——拿它當正式活動的入口，等於沒有入口。
 *
 * 正式環境的活動要從後台建：那條路徑會**隨機產生**報到碼，順帶把組別與
 * 全部預設成就一起建好，該填的名稱、通關碼、開始時間也都由主辦方當場決定。
 *
 * 那為什麼還需要這支腳本：建立管理員的 API 要求你已經以總管理員身分登入。
 * 全新的資料庫沒有第一個帳號，就永遠進不了後台——這支腳本解的就是那個
 * 雞生蛋的問題，之後的主持人帳號都從後台建。
 *
 * 用法：
 *   SEED_ADMIN_USERNAME=... SEED_ADMIN_PASSWORD=... npm run admin:create
 */
const MIN_PASSWORD_LENGTH = 8; // 與 /api/admin/accounts 的規則一致

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

function fail(message: string): never {
  console.error("");
  console.error(message);
  console.error("");
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL 未設定。");

  /*
    先報出要寫進哪一個資料庫再動手。

    本機與正式環境只差 .env 裡的一行，而這支腳本會建立一組能進後台的
    憑證——寫錯地方不會有任何錯誤訊息，你只會在需要登入時發現帳號不在
    那裡（或更糟：在你以為安全的地方多了一組不該存在的帳號）。
  */
  const target = new URL(url);
  console.log("即將寫入：");
  console.log(`  主機    ${target.hostname}`);
  console.log(`  資料庫  ${target.pathname.replace("/", "")}`);

  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!username || !password) {
    fail(
      [
        "SEED_ADMIN_USERNAME 與 SEED_ADMIN_PASSWORD 都必須設定。",
        "這裡刻意沒有預設值——正式環境的管理員密碼不該來自原始碼。",
      ].join("\n"),
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`密碼至少要 ${MIN_PASSWORD_LENGTH} 個字元。`);
  }
  if (password === "change-me") {
    fail(
      [
        "不接受 change-me。那是本機示範用的密碼，寫在 .env.example 裡，",
        "任何看過這個 repo 的人都知道。",
      ].join("\n"),
    );
  }

  /*
    只擋死 change-me 這個字串是不夠的——change-me2 一樣好猜。

    這裡不阻止，只出聲：密碼是誰的決定不該由腳本代勞，但「這個看起來
    像是從公開範例改來的」這件事，使用者值得在按下 Enter 之前知道一次。
    這個帳號看得到全場參與者的真實姓名與信箱。
  */
  if (password.toLowerCase().includes("change-me")) {
    console.warn("");
    console.warn("⚠ 這個密碼看起來是從 .env.example 的 change-me 改來的。");
    console.warn("  那個字串在原始碼與 git 紀錄裡都查得到，猜起來很快。");
    console.warn("  這個帳號能看到全場參與者的真實姓名與信箱。");
  }

  const existing = await prisma.admin.findUnique({ where: { username } });
  if (existing) {
    console.log("");
    console.log(
      `管理員「${username}」已存在（role=${existing.role}），未做任何變更。`,
    );
    console.log("要改密碼請從後台的管理員帳號頁操作。");
    return;
  }

  await prisma.admin.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      // 第一個帳號必須是總管理員，否則沒有人能建立活動或其他帳號。
      role: "SUPER",
    },
  });

  console.log("");
  console.log(`已建立總管理員：${username}`);
  console.log("接著請到 /admin/login 登入，並從「活動管理」建立這場活動——");
  console.log("報到碼會在那時隨機產生，不要沿用示範用的那一組。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
