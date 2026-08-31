import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import { isTestDatabase } from "./test-db-guard";

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
  /** 有的話，這筆紀錄會隨該participant的資料一起被 14 天清除帶走。 */
  participantId?: string;
};

/**
 * 記下這次寄信的結果。
 *
 * 寫紀錄本身絕不能讓寄信失敗——它是輔助資訊，不是主流程。
 * 資料庫這時候若也出問題，至少還有 console 這條退路。
 */
async function record(
  mail: OutgoingMail,
  status: "SENT" | "FAILED" | "SKIPPED",
  error?: string,
) {
  try {
    await prisma.mailLog.create({
      data: {
        participantId: mail.participantId ?? null,
        to: mail.to,
        subject: mail.subject,
        status,
        error: error?.slice(0, 500) ?? null,
      },
    });
  } catch (e) {
    console.error("[mailer] 寫入寄信紀錄失敗", e);
  }
}

/**
 * 寄信。
 *
 * 設定了 SMTP_HOST 才會真的寄出；否則把內容印到伺服器紀錄。
 * 這讓開發與測試不需要任何外部服務，也不會在跑測試時真的寄信給別人。
 *
 * 無論成功、失敗或未設定，都會在 MailLog 留下一筆——因為呼叫端刻意
 * 不讓寄信失敗阻斷主流程（Q20），失敗在畫面上是完全無聲的。
 *
 * ⚠️ 正式環境務必設定 SMTP 相關環境變數，否則找回身分的信不會送達，
 * 而 ADR-0001 所述的十四天查看期就等同不存在。
 */
export async function sendMail(mail: OutgoingMail): Promise<void> {
  /*
    連著測試資料庫時一律不寄。

    測試用的信箱是 ming@example.com 這類保留網域，根本不收信——每一封
    都會退信。而退信不是無害的：它直接扣寄件網域的信譽分，累積到一定
    比例，服務商會停掉整個帳號。到那時候真正要用的驗證信也寄不出去了。

    擋在這裡而不是只靠啟動指令帶環境變數：指令會被忘記、會被繞過，
    而「現在連的是哪個資料庫」是騙不了人的事實。
  */
  if (isTestDatabase()) {
    await record(mail, "SKIPPED");
    return;
  }

  const host = process.env.SMTP_HOST;

  if (!host) {
    console.log(
      `\n[mailer] 未設定 SMTP，僅輸出內容：\n  收件人：${mail.to}\n  主旨：${mail.subject}\n  ${mail.text.replace(/\n/g, "\n  ")}\n`,
    );
    await record(mail, "SKIPPED");
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

  try {
    await transport.sendMail({
      // `||` 而不是 `??`：部署工具常把「沒設定」帶成空字串，
      // 而空的 from 會讓 nodemailer 直接拋錯。
      from: process.env.SMTP_FROM?.trim() || "no-reply@localhost",
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
    await record(mail, "SENT");
  } catch (e) {
    const err = e as { responseCode?: number; code?: string; message?: string };
    // 把服務商的錯誤碼一起留下：429 / 550 這類數字才看得出是撞到額度還是被退信。
    const detail = [err.responseCode, err.code, err.message]
      .filter(Boolean)
      .join(" ");
    await record(mail, "FAILED", detail || String(e));
    throw e;
  }
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
