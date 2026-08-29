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
  readOnly = false,
}: {
  impressions: WallImpression[];
  purgeDate: string | null;
  /*
    後台檢視用。呈現與本人看到的完全一致——審核時看到的必須是本人
    看到的那一份，不然「有問題的內容」與「被回報的內容」對不起來。

    差別有二：隱藏的內容照樣留在牆上（只是標示出來），因為那正是
    最需要被看到的；以及不提供隱藏與回報，那是收件人自己的決定。
  */
  readOnly?: boolean;
}) {
  const [items, setItems] = useState(impressions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 檢舉要二次確認：它會驚動主辦方，而且送出後不能撤回。
  const [confirmingReport, setConfirmingReport] = useState(false);

  // 從 items 找而不是存整個物件，這樣切換隱藏後彈窗內容會跟著更新。
  const selected = items.find((i) => i.id === selectedId) ?? null;
  // 唯讀時不濾掉隱藏的：對審核者而言，那些正是最需要看見的內容。
  const visible = readOnly ? items : items.filter((i) => !i.hidden);
  const hiddenOnes = readOnly ? [] : items.filter((i) => i.hidden);

  function patch(id: string, change: Partial<WallImpression>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }

  async function toggleHidden(item: WallImpression) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/impressions/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impressionId: item.id, hidden: !item.hidden }),
      });
      if (!res.ok) {
        setError("操作失敗，請再試一次");
        return;
      }
      patch(item.id, { hidden: !item.hidden });
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setBusy(false);
    }
  }

  async function report(item: WallImpression) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/impressions/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impressionId: item.id }),
      });
      if (!res.ok) {
        setError("回報失敗，請再試一次");
        return;
      }
      patch(item.id, { reported: true });
      setConfirmingReport(false);
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setSelectedId(null);
    setConfirmingReport(false);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="px text-[11px] tracking-[0.2em] text-faint">EMPTY</span>
        <p className="font-bold">還沒有人寫下對你的印象</p>
        <p className="text-sm text-dim">
          多去認識一些人，他們寫的話會出現在這裡。
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 夜空當底，右上角一道琥珀月光 */}
      <div className="wall-field relative flex-1 overflow-hidden rounded-xl border border-line bg-void">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 72% 16%, rgba(255,206,92,.14), transparent 55%)",
          }}
        />

        {visible.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-faint">
            這面牆上的內容都被你隱藏了。
          </p>
        ) : (
          visible.map((item, i) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={`wall-card absolute max-w-[72%] rounded-lg px-3 py-2 text-left ${
                // 唯讀檢視下，被回報的最顯眼，其次是被隱藏的——
                // 那個排序就是審核時該處理的順序。
                readOnly && item.reported
                  ? "z-20 border border-flare bg-flare/15 text-flare"
                  : readOnly && item.hidden
                    ? "z-10 border border-moon/60 bg-moon/10 text-moon"
                    : item.featured
                      ? "z-10 border border-moon bg-void text-moon shadow-[0_0_14px_rgba(255,206,92,0.22)]"
                      : "border border-line bg-slate text-dim"
              }`}
              style={
                {
                  // 以索引推導位置與節奏，讓每張卡片的漂浮軌跡各不相同，
                  // 但重新整理後保持一致，不會每次都跳到別的地方。
                  left: `${6 + ((i * 37) % 52)}%`,
                  top: `${5 + ((i * 53) % 78)}%`,
                  "--drift-delay": `${(i % 7) * -1.4}s`,
                  "--drift-duration": `${9 + (i % 5) * 1.6}s`,
                  // 交錯方向，否則所有卡片會像同一塊布一起平移，看不出在漂。
                  "--drift-x": `${i % 2 === 0 ? 8 : -8}%`,
                  "--drift-y": `${i % 3 === 0 ? -10 : 9}%`,
                  "--drift-rot": `${i % 2 === 0 ? 2 : -2}deg`,
                } as React.CSSProperties
              }
            >
              <p className="text-xs leading-snug">{item.text}</p>
              <p
                className={`mt-1 text-[10px] ${item.featured ? "text-moon/70" : "text-faint"}`}
              >
                — {item.authorNickname}
                {item.featured && " ★"}
                {readOnly && item.reported && " ・已回報"}
                {readOnly && item.hidden && " ・已隱藏"}
              </p>
            </button>
          ))
        )}
      </div>

      {/*
        隱藏的內容收在這裡而不是留在牆上。留在牆上（就算調淡）等於沒有隱藏；
        但完全不列出來，「還原」就變成一個到不了的功能。
      */}
      {hiddenOnes.length > 0 && (
        <details className="rounded-xl border border-line surface px-4 py-3">
          <summary className="cursor-pointer text-sm text-dim">
            已隱藏（{hiddenOnes.length}）
          </summary>
          <ul className="mt-3 flex flex-col gap-1.5">
            {hiddenOnes.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setSelectedId(item.id)}
                  className="w-full rounded-lg border border-line px-3 py-2 text-left"
                >
                  <p className="truncate text-xs text-faint">{item.text}</p>
                  <p className="mt-0.5 text-[10px] text-faint">
                    — {item.authorNickname}
                    {item.reported && " ・已回報"}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {purgeDate && (
        <p className="text-center text-[11px] text-faint">
          這些內容將於 {purgeDate} 刪除，想留下請自行截圖
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 px-5 pb-[calc(1.5rem+var(--safe-bottom))]"
          onClick={close}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-line surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/*
              檢舉放在角落而不是與隱藏並列。它是少數情況才用得到的動作，
              擺在同等份量的位置會讓每個只想關掉一則的人都先讀一次「回報」。

              唯讀檢視不提供：隱藏與回報都是收件人自己的決定，
              後台代替他做等於幫他決定要不要在意這句話。
            */}
            {!readOnly && (
              <button
                onClick={() => setConfirmingReport(true)}
                disabled={selected.reported || busy}
                aria-label={selected.reported ? "已回報給主辦方" : "回報給主辦方"}
                className={`absolute top-3 right-3 grid size-8 place-items-center rounded-full border text-base font-black transition-colors ${
                  selected.reported
                    ? "border-line text-faint"
                    : "border-flare/60 text-flare hover:bg-flare/10"
                }`}
              >
                !
              </button>
            )}

            <p className="pr-10 text-base">{selected.text}</p>
            <p className="mt-2 text-sm text-dim">— {selected.authorNickname}</p>
            {selected.reported && (
              <p className="mt-1 text-xs text-faint">已回報給主辦方</p>
            )}

            {confirmingReport ? (
              <div className="mt-5 flex flex-col gap-2 rounded-lg border border-flare/50 bg-flare/10 p-4">
                <p className="text-sm font-bold text-flare">
                  要回報這則內容給主辦方嗎？
                </p>
                <p className="text-xs text-flare/85">
                  主辦方會看到內容與作者。<strong>送出後無法撤回。</strong>
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => report(selected)}
                    disabled={busy}
                    className="tap-target flex-1 rounded-sm bg-flare py-2.5 text-sm font-bold text-void disabled:opacity-60"
                  >
                    {busy ? "送出中…" : "確定回報"}
                  </button>
                  <button
                    onClick={() => setConfirmingReport(false)}
                    disabled={busy}
                    className="tap-target rounded-sm border border-line px-4 text-sm text-dim"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : readOnly ? (
              <div className="mt-5 flex flex-col gap-2">
                <p className="flex flex-wrap gap-2 text-xs">
                  {selected.featured && (
                    <span className="text-neon">在作者的九宮格中</span>
                  )}
                  {selected.reported && (
                    <span className="font-bold text-flare">已回報，需處理</span>
                  )}
                  {selected.hidden && (
                    <span className="text-moon">已被收件人隱藏</span>
                  )}
                </p>
                <button
                  onClick={close}
                  className="tap-target rounded-sm py-2.5 text-sm text-faint"
                >
                  關閉
                </button>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                {/* 開關而不是單向按鈕：隱藏一按就生效，不可逆的話誤觸就沒救了。 */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-3">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">
                      {selected.hidden ? "已隱藏" : "顯示在牆上"}
                    </span>
                    <span className="text-xs text-faint">
                      {selected.hidden
                        ? "只有你看不到，作者不會知道"
                        : "關掉就不會出現在漂浮牆上"}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={!selected.hidden}
                    disabled={busy}
                    onChange={() => toggleHidden(selected)}
                    className="size-6 shrink-0 accent-neon"
                  />
                </label>

                <button
                  onClick={close}
                  className="tap-target rounded-sm py-2.5 text-sm text-faint"
                >
                  關閉
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
