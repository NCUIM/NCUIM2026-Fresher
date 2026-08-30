/**
 * 拒絕對非測試資料庫執行破壞性操作。
 *
 * 測試與彩排的第一步都是清空整張參與者表。若不小心指向開發資料庫，
 * 別人手動報到的資料會在毫無徵兆的情況下消失——這件事實際發生過一次，
 * 而且從使用者的角度看起來像是「報到沒有存進去」，很難聯想到真正的原因。
 *
 * 所以寧可讓腳本拒絕執行，也不要靜默地刪除。
 */
export function assertTestDatabase(scriptName: string): void {
  const url = process.env.DATABASE_URL ?? "";

  if (!url.includes("ncuim_test")) {
    console.error(
      `\n拒絕執行 ${scriptName}：這個腳本會清空所有參與者資料。\n` +
        `目前的 DATABASE_URL 不是測試資料庫：\n  ${url || "(未設定)"}\n\n` +
        "請改用 npm 指令（它們會自動指向測試資料庫）：\n" +
        "  npm run test:setup   準備測試資料庫\n" +
        "  npm run dev:test     啟動測試用的開發伺服器（連接埠 3001）\n" +
        "  npm test             執行測試\n",
    );
    process.exit(1);
  }
}

/**
 * 現在連的是不是測試資料庫。
 *
 * 與 assertTestDatabase 的差別是它不中止程式，只回報。給的是「這個情境
 * 該不該有對外副作用」的判斷依據——例如寄信。
 */
export function isTestDatabase(): boolean {
  return (process.env.DATABASE_URL ?? "").includes("ncuim_test");
}
