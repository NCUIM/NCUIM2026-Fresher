import "dotenv/config";
import { sendMail } from "../lib/mailer.ts";

/**
 * 寄一封測試信，確認 SMTP 設定真的能送出。
 *
 * 值得獨立成一個指令：不然要驗證寄信，得先報到、填信箱、再等驗證信，
 * 中間任何一步出錯都會被誤判成「寄信壞了」。
 *
 * 用法：npm run mail:test -- 你的信箱@gmail.com
 */
const to = process.argv[2];

if (!to) {
  console.error("用法：npm run mail:test -- you@example.com");
  process.exit(1);
}

const host = process.env.SMTP_HOST;
if (!host) {
  console.error(
    "SMTP_HOST 未設定。\n" +
      "現在的行為是把信件內容印到終端機而不是寄出——正式環境等同於找回機制不存在。\n" +
      "請先在 .env 填入 SMTP 設定，詳見 .env.example。",
  );
  process.exit(1);
}

console.log("SMTP 設定：");
console.log(`  主機      ${host}:${process.env.SMTP_PORT ?? 587}`);
console.log(`  加密      secure=${process.env.SMTP_SECURE ?? "false"}`);
console.log(`  帳號      ${process.env.SMTP_USER ?? "（未設定，將以匿名連線）"}`);
console.log(`  寄件者    ${process.env.SMTP_FROM ?? "no-reply@localhost"}`);
console.log(`  收件者    ${to}\n`);

try {
  await sendMail({
    to,
    subject: "NCUIM 寄信測試",
    text: [
      "這是一封測試信。",
      "",
      "收到它代表 SMTP 設定正確，驗證信與找回身分的連結都能送達。",
      "",
      `寄出時間：${new Date().toLocaleString("zh-TW")}`,
    ].join("\n"),
  });
  console.log("已送出。請檢查收件匣，也記得看一下垃圾郵件匣。");
  console.log(
    "\n這封測試信不會出現在後台的寄信紀錄——那裡只顯示屬於活動參與者的信件。",
  );
} catch (e) {
  const err = e as { code?: string; responseCode?: number; message?: string };
  console.error("寄送失敗：", err.message ?? e);

  // Gmail 最常見的兩種失敗，訊息本身看不出原因，這裡直接講。
  if (err.responseCode === 535 || err.code === "EAUTH") {
    console.error(
      "\n認證失敗。Gmail 不接受帳號密碼，必須使用「應用程式密碼」：\n" +
        "  1. Google 帳戶需先開啟兩步驟驗證\n" +
        "  2. 到 https://myaccount.google.com/apppasswords 產生 16 碼密碼\n" +
        "  3. 把那 16 碼填進 SMTP_PASSWORD（空格可留可不留）",
    );
  }
  if (err.code === "ESOCKET" || err.code === "ETIMEDOUT") {
    console.error(
      "\n連線不到主機。檢查 SMTP_PORT 與 SMTP_SECURE 是否配對：\n" +
        "  587 要搭 SMTP_SECURE=false（STARTTLS）\n" +
        "  465 要搭 SMTP_SECURE=true（SSL）\n" +
        "兩者交叉設定會卡住直到逾時。",
    );
  }
  process.exit(1);
}
