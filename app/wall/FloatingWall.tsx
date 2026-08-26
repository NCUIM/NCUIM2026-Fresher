"use client";

import { useState } from "react";
import type { WallImpression } from "@/lib/wall";

/**
 * 漂浮呈現。
 *
 * 動畫一律用 transform 與 opacity，不動 top/left——後者會觸發版面重排，
 * 在同時有數十張卡片漂浮時會讓手機明顯掉幀。
 *
 * 尊重 prefers-reduced-motion：對前庭功能敏感的人，滿版緩慢漂移的內容
 * 可能引發不適，因此在該設定下改為靜態排列（見 globals.css）。
 */
export function FloatingWall({
  impressions,
  purgeDate,
}: {
  impressions: WallImpression[];
  purgeDate: string | null;
}) {
  const [selected, setSelected] = useState<WallImpression | null>(null);
  const [items, setItems] = useState(impressions);
  const [error, setError] = useState<string | null>(null);

  async function hide(impression: WallImpression, report: boolean) {
    try {
      const res = await fetch("/api/impressions/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impressionId: impression.id, report }),
      });
      if (!res.ok) {
        setError("操作失敗，請再試一次");
        return;
      }
      setItems((list) => list.filter((i) => i.id !== impression.id));
      setSelected(null);
    } catch {
      setError("連線失敗，請確認網路");
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-4xl">💌</p>
        <p className="font-medium">還沒有人寫下對你的印象</p>
        <p className="text-sm text-gray-500">
          多去認識一些人，他們寫的話會出現在這裡。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="wall-field relative flex-1">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className={`wall-card absolute max-w-[70%] rounded-2xl px-4 py-3 text-left shadow-sm ${
              item.featured
                ? "z-10 bg-gray-900 text-white"
                : "bg-white/90 text-gray-800 ring-1 ring-gray-200"
            }`}
            style={
              {
                // 以索引推導位置與節奏，讓每張卡片的漂浮軌跡各不相同，
                // 但重新整理後保持一致，不會每次都跳到別的地方。
                left: `${8 + ((i * 37) % 55)}%`,
                top: `${6 + ((i * 53) % 80)}%`,
                "--drift-delay": `${(i % 7) * -1.4}s`,
                "--drift-duration": `${9 + (i % 5) * 1.6}s`,
              } as React.CSSProperties
            }
          >
            <p className={item.featured ? "text-sm" : "text-xs"}>{item.text}</p>
            <p
              className={`mt-1 text-[10px] ${item.featured ? "text-gray-300" : "text-gray-400"}`}
            >
              — {item.authorNickname}
              {item.featured && " ★"}
            </p>
          </button>
        ))}
      </div>

      {purgeDate && (
        <p className="pb-2 text-center text-xs text-gray-400">
          這些內容將於 {purgeDate} 刪除，想留下請自行截圖
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-5 pb-[calc(1.5rem+var(--safe-bottom))]"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base">{selected.text}</p>
            <p className="mt-2 text-sm text-gray-500">
              — {selected.authorNickname}
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={() => hide(selected, true)}
                className="tap-target rounded-lg bg-red-50 py-3 text-sm font-medium text-red-700"
              >
                隱藏並回報給主辦方
              </button>
              <button
                onClick={() => hide(selected, false)}
                className="tap-target rounded-lg border border-gray-300 py-3 text-sm"
              >
                只隱藏，不回報
              </button>
              <button
                onClick={() => setSelected(null)}
                className="tap-target rounded-lg py-3 text-sm text-gray-500"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
