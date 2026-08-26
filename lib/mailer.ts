import nodemailer from "nodemailer";

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
};

/**
 * 寄信。
 *
 * 設定了 SMTP_HOST 才會真的寄出；否則把內容印到伺服器紀錄。
 * 這讓開發與測試不需要任何外部服務，也不會在跑測試時真的寄信給別人。
 *
 * ⚠️ 正式環境務必設定 SMTP 相關環境變數，否則找回身分的信不會送達，
 * 而 ADR-0001 所述的十四天查看期就等同不存在。
 */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  const host = process.env.SMTP_HOST;

  if (!host) {
    console.log(
      `\n[mailer] 未設定 SMTP，僅輸出內容：\n  收件人：${mail.to}\n  主旨：${mail.subject}\n  ${mail.text.replace(/\n/g, "\n  ")}\n`,
    );
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM ?? "no-reply@localhost",
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
  });
}

export function verifyEmailBody(nickname: string, url: string): OutgoingMail["text"] {
  return [
    `${nickname} 你好，`,
    "",
    "請點擊下面的連結確認這個信箱可以收信：",
    url,
    "",
    "確認之後，萬一你的手機出狀況或瀏覽器資料被清除，",
    "就能用這個信箱找回自己的收集成果。",
    "",
    "如果你沒有參加這場活動，請忽略這封信。",
  ].join("\n");
}

export function recoveryBody(nickname: string, url: string): OutgoingMail["text"] {
  return [
    `${nickname} 你好，`,
    "",
    "點擊下面的連結，就能在這台裝置上回到你的收集成果：",
    url,
    "",
    "這個連結只能使用一次，30 分鐘後失效。",
    "",
    "如果不是你本人要求的，請忽略這封信，你的身分不會有任何變動。",
  ].join("\n");
}
