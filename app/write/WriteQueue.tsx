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
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-4xl">🎉</p>
        <p className="font-medium">全部寫完了！</p>
        <p className="text-sm text-gray-500">
          所有收集到的人都有你的一段話，分數也都入帳了。
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">寫下你的印象</h1>
        <span className="text-sm text-gray-500">還有 {queue.length} 位</span>
      </div>

      <div className="rounded-2xl border border-gray-200 p-5">
        <p className="text-sm text-gray-500">關於</p>
        <p className="mb-3 text-lg font-bold">{current.nickname}</p>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-sm">
            <span>他給你的感覺是？</span>
            <span className="text-xs text-gray-400">
              {text.length}/{IMPRESSION_MAX}
            </span>
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, IMPRESSION_MAX))}
            rows={3}
            autoFocus
            placeholder="例如：講話很好笑，聊到停不下來"
            className="resize-none rounded-lg border border-gray-300 px-3 py-2.5"
          />
        </label>

        <p className="mt-2 text-xs text-gray-400">
          只有 {current.nickname} 看得到，而且會顯示你的名字。
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        onClick={submit}
        disabled={submitting || !text.trim()}
        className="tap-target rounded-lg bg-gray-900 py-3 font-medium text-white disabled:bg-gray-300"
      >
        {submitting ? "儲存中…" : "送出，下一位"}
      </button>
    </div>
  );
}
