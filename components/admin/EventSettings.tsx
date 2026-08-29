"use client";

import { useState } from "react";

type Settings = {
  name: string;
  passcode: string;
  basePoints: number;
  leaderboardTopN: number;
};

const field =
  "rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint";

export function EventSettings({
  eventId,
  initial,
  participantCount,
}: {
  eventId: string;
  initial: Settings;
  participantCount: number;
}) {
  const [name, setName] = useState(initial.name);
  const [passcode, setPasscode] = useState(initial.passcode);
  const [basePoints, setBasePoints] = useState(String(initial.basePoints));
  const [topN, setTopN] = useState(String(initial.leaderboardTopN));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isDefaultPasscode = initial.passcode === "1234";

  async function save() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/event", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          name,
          passcode,
          basePoints: Number(basePoints),
          leaderboardTopN: Number(topN),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }
      setNotice("已儲存。尚未報到的人需要使用新的通關碼。");
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold">活動設定</h2>

      {isDefaultPasscode && (
        <p className="rounded-lg border border-flare/50 bg-flare/10 px-3 py-2.5 text-sm text-flare">
          目前仍是種子檔的預設通關碼 <span className="px">1234</span>。
          活動開始前請務必換掉。
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">活動名稱</span>
        <span className="text-xs text-faint">
          會出現在報到頁、投影畫面，以及每一張卡片上。
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">活動通關碼</span>
        <span className="text-xs text-faint">
          報到時要輸入。請於現場口頭或投影公布，不要印在 QR Code 旁邊——
          兩者一起貼出去，通關碼就失去擋人的作用。
        </span>
        <input
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          autoCapitalize="none"
          autoComplete="off"
          className={`px ${field}`}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">每次收集的基礎分</span>
          <input
            type="number"
            inputMode="numeric"
            value={basePoints}
            onChange={(e) => setBasePoints(e.target.value)}
            className={`px ${field}`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold">排行榜公開名次</span>
          <input
            type="number"
            inputMode="numeric"
            value={topN}
            onChange={(e) => setTopN(e.target.value)}
            className={`px ${field}`}
          />
        </label>
      </div>

      <p className="text-xs text-faint">
        目前 {participantCount} 人已報到。基礎分改動會立即影響所有人的分數——
        它是即時計算的，不是報到當下就固定下來的。
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">{notice}</p>
      )}

      <button
        onClick={save}
        disabled={saving || !passcode.trim() || !name.trim()}
        className="tap-target rounded-sm border border-neon py-3 font-bold text-neon disabled:border-line disabled:text-faint"
      >
        {saving ? "儲存中…" : "儲存活動設定"}
      </button>
    </section>
  );
}
