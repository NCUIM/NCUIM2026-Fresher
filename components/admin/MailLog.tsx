"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  to: string;
  subject: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  error: string | null;
  createdAt: string;
  participant: { id: string; nickname: string } | null;
};

type Data = {
  logs: Entry[];
  sent: number;
  failed: number;
  skipped: number;
};

const LABEL: Record<Entry["status"], string> = {
  SENT: "已寄出",
  FAILED: "失敗",
  SKIPPED: "未寄出",
};

const TONE: Record<Entry["status"], string> = {
  SENT: "text-neon",
  FAILED: "text-flare",
  SKIPPED: "text-moon",
};

/**
 * 寄信紀錄。
 *
 * 這一段的存在理由不是稽核，是**可見性**：寄信刻意不阻斷報到流程，
 * 所以 SMTP 出問題時現場沒有任何跡象——使用者照常完成報到、看到成功畫面，
 * 信卻不會到。這裡把那件事變成看得見的。
 */
export function MailLog({ eventId }: { eventId: string }) {
  const [data, setData] = useState<Data | null>(null);

  async function load() {
    const res = await fetch(`/api/admin/mail-log?eventId=${eventId}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data) return null;

  const total = data.sent + data.failed + data.skipped;
  const problem = data.failed + data.skipped;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">寄信紀錄</h2>
        <button onClick={load} className="text-xs text-faint underline">
          重新整理
        </button>
      </div>

      {/*
        沒問題的時候只給一行，不要佔掉後台的注意力；
        一有問題就講清楚後果，因為「信沒寄出」的影響要兩週後才浮現。
      */}
      {problem === 0 ? (
        <p className="text-xs text-faint">
          {total === 0
            ? "還沒有寄出任何信件。"
            : `${total} 封全部寄出成功。`}
        </p>
      ) : (
        <div className="flex flex-col gap-1 rounded-lg border border-flare/50 bg-flare/15 px-4 py-3 text-sm text-flare">
          <span className="font-bold">
            有 {problem} 封信沒有送出（成功 {data.sent} 封）
          </span>
          {data.skipped > 0 && (
            <span className="text-flare/85">
              其中 {data.skipped} 封是因為<strong>沒有設定 SMTP</strong>，
              信件內容只印到了伺服器紀錄。
            </span>
          )}
          <span className="text-flare/85">
            收不到驗證信的人無法用信箱找回身分。活動結束第 7 天後，
            iOS 會清除瀏覽器儲存，他們將永久失去自己的收集成果。
          </span>
        </div>
      )}

      {data.logs.length > 0 && (
        <details className="rounded-xl border border-line surface px-4 py-3">
          <summary className="cursor-pointer text-sm text-dim">
            最近 {data.logs.length} 筆
          </summary>
          <ul className="mt-3 flex flex-col gap-2">
            {data.logs.map((l) => (
              <li key={l.id} className="flex flex-col gap-0.5 text-xs">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`font-bold ${TONE[l.status]}`}>
                    {LABEL[l.status]}
                  </span>
                  <span className="text-dim">
                    {l.participant?.nickname ?? "（已移除）"}
                  </span>
                  <span className="break-all text-faint">{l.to}</span>
                </span>
                <span className="text-faint">
                  {l.subject}・
                  {new Date(l.createdAt).toLocaleString("zh-TW")}
                </span>
                {l.error && (
                  <span className="break-all text-flare/85">{l.error}</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
