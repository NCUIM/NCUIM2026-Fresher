"use client";

import { useState } from "react";
// 從 lib/validation 取值，不從 lib/showcase——後者匯入 Prisma，
// 在 client component 中會把資料庫驅動打包進瀏覽器套件。
import { SHOWCASE_SIZE } from "@/lib/validation";

type Candidate = { id: string; nickname: string; avatarUrl: string | null };

export function ShowcaseEditor({
  candidates,
  initialSelected,
}: {
  candidates: Candidate[];
  initialSelected: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const full = selected.length >= SHOWCASE_SIZE;

  function toggle(id: string) {
    setMessage(null);
    setSelected((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      if (current.length >= SHOWCASE_SIZE) return current;
      return [...current, id];
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/showcase", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }
      setMessage("已儲存");
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 空格用點陣序號填滿，本身就像一副等待集齊的卡冊 */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
          const person = selected[i] ? byId.get(selected[i]) : null;
          return (
            <div
              key={i}
              className={`grid aspect-square place-items-center rounded-lg p-1 text-center text-xs leading-tight ${
                person
                  ? "border border-neon bg-slate text-neon"
                  : "px border border-dashed border-line text-faint"
              }`}
            >
              {person ? person.nickname : String(i + 1).padStart(2, "0")}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-center justify-between text-sm font-bold">
          <span>從收集到的人裡挑選</span>
          <span className={`px text-xs ${full ? "text-moon" : "text-faint"}`}>
            {selected.length}/{SHOWCASE_SIZE}
          </span>
        </p>

        {candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-faint">
            還沒有收集到任何人。
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {candidates.map((c) => {
              const picked = selected.includes(c.id);
              const disabled = !picked && full;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => toggle(c.id)}
                    disabled={disabled}
                    aria-pressed={picked}
                    className={`tap-target flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left ${
                      picked
                        ? "border-neon bg-neon/10 text-neon"
                        : disabled
                          ? "border-line/50 text-faint"
                          : "border-line text-chalk"
                    }`}
                  >
                    <span className="flex-1 truncate">{c.nickname}</span>
                    <span className="px text-sm">{picked ? "✓" : "＋"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">{message}</p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
      >
        {saving ? "儲存中…" : "儲存九宮格"}
      </button>
    </div>
  );
}
