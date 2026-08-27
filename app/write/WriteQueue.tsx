"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IMPRESSION_MAX } from "@/lib/validation";

type Pending = { subjectId: string; nickname: string };

/**
 * 一次只顯示一位對象。待撰寫清單可能有數十筆，若一次攤開所有輸入框，
 * 在手機上會變成一面令人卻步的長牆；逐一處理反而讓人願意寫完。
 */
export function WriteQueue({ initial }: { initial: Pending[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const current = queue[0];

  async function submit() {
    if (!current || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: current.subjectId, text }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "儲存失敗");
        return;
      }
      setQueue((q) => q.slice(1));
      setText("");
      router.refresh(); // 讓分數重新計算
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setSubmitting(false);
    }
  }

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-4xl">🎉</p>
        <p className="font-bold text-neon">全部寫完了</p>
        <p className="text-sm text-dim">
          所有收集到的人都有你的一段話，分數也都入帳了。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-black">寫下你的印象</h1>
        <span className="px text-sm text-flare">
          還有 {String(queue.length).padStart(2, "0")} 位
        </span>
      </div>

      <div className="rounded-xl border border-line bg-night p-5">
        <p className="px text-[10px] tracking-[0.2em] text-faint">ABOUT</p>
        <p className="mb-3 text-lg font-black">{current.nickname}</p>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-sm">
            <span className="text-dim">他給你的感覺是？</span>
            <span className="px text-xs text-faint">
              {text.length}/{IMPRESSION_MAX}
            </span>
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, IMPRESSION_MAX))}
            rows={3}
            autoFocus
            placeholder="例如：講話很好笑，聊到停不下來"
            className="resize-none rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
          />
        </label>

        <p className="mt-2 text-xs text-faint">
          只有 {current.nickname} 看得到，而且會顯示你的名字。
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting || !text.trim()}
        className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
      >
        {submitting ? "儲存中…" : "送出，下一位"}
      </button>
    </div>
  );
}
