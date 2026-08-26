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
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
          const person = selected[i] ? byId.get(selected[i]) : null;
          return (
            <div
              key={i}
              className={`flex aspect-square items-center justify-center rounded-xl text-center text-xs ${
                person
                  ? "bg-gray-900 text-white"
                  : "border border-dashed border-gray-300 text-gray-300"
              }`}
            >
              {person ? (
                <span className="line-clamp-2 px-1">{person.nickname}</span>
              ) : (
                i + 1
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-center justify-between text-sm font-medium">
          <span>從收集到的人裡挑選</span>
          <span className={full ? "text-xs text-amber-600" : "text-xs text-gray-400"}>
            {selected.length}/{SHOWCASE_SIZE}
          </span>
        </p>

        {candidates.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
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
                    className={`tap-target flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                      picked
                        ? "bg-gray-900 text-white"
                        : disabled
                          ? "border border-gray-100 text-gray-300"
                          : "border border-gray-200"
                    }`}
                  >
                    <span className="flex-1 truncate">{c.nickname}</span>
                    <span className="text-sm">{picked ? "✓" : "＋"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="tap-target sticky bottom-[var(--safe-bottom)] rounded-lg bg-gray-900 py-3 font-medium text-white disabled:bg-gray-300"
      >
        {saving ? "儲存中…" : "儲存九宮格"}
      </button>
    </div>
  );
}
