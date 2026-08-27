import "dotenv/config";
import { execSync } from "node:child_process";

/**
 * 準備測試資料庫。
 *
 * 測試與彩排會清空整張參與者表，因此必須跟開發用的資料庫分開——
 * 否則在別人手動測試的同時跑一次測試，就會把對方剛報到的資料洗掉。
 * 這件事實際發生過。
 *
 * 由 npm run test:setup 呼叫，DATABASE_URL 已由 cross-env 指向 ncuim_test。
 */
const url = process.env.DATABASE_URL ?? "";
if (!url.includes("ncuim_test")) {
  console.error(
    `拒絕執行：DATABASE_URL 不是測試資料庫。\n實際值：${url}\n` +
      "這個腳本會覆寫資料結構，只允許對 ncuim_test 執行。",
  );
  process.exit(1);
}

console.log("將資料結構同步到測試資料庫…");
execSync("npx prisma db push --accept-data-loss", {
  stdio: "inherit",
  env: process.env,
});

console.log("寫入種子資料…");
execSync("node prisma/seed.mts", { stdio: "inherit", env: process.env });

console.log("\n測試資料庫已就緒。接著執行 npm run dev:test，再開另一個終端跑 npm test。");
