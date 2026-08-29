"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IMPRESSION_MAX } from "@/lib/validation";

type Pending = { subjectId: string; nickname: string };
type Written = Pending & { text: string };

/**
 * 一次只顯示一位對象。待撰寫清單可能有數十筆，若一次攤開所有輸入框，
 * 在手機上會變成一面令人卻步的長牆；逐一處理反而讓人願意寫完。
 *
 * 下方另外列出已經寫過的。規格說短評「可修改」、API 也一直是 upsert，
 * 但寫完的人會從待寫清單消失——沒有這一區，「可修改」就是做不到的事。
 */
export function WriteQueue({
  initial,
  written,
  frozen = false,
}: {
  initial: Pending[];
  written: Written[];
  /** 活動已封存：已寫的仍看得到，但不能再新增或修改。 */
  frozen?: boolean;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 正在重寫的對象。null 代表在處理待寫佇列。
  const [editing, setEditing] = useState<Written | null>(null);

  const current = queue[0];
  const target = editing ?? current;

  async function submit() {
    if (!target || !text.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: target.subjectId, text }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "儲存失敗");
        return;
      }
      if (editing) {
        setEditing(null);
      } else {
        setQueue((q) => q.slice(1));
      }
      setText("");
      router.refresh(); // 讓分數與已寫清單重新計算
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(w: Written) {
    setEditing(w);
    setText(w.text);
    setError(null);
  }

  const writtenList = written.length > 0 && (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold text-dim">
        已經寫過的（{written.length}）
      </h2>
      <ul className="flex flex-col gap-1.5">
        {written.map((w) => (
          <li
            key={w.subjectId}
            className={`rounded-lg border px-3 py-2.5 ${
              editing?.subjectId === w.subjectId
                ? "border-neon bg-neon/10"
                : "border-line"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{w.nickname}</p>
                <p className="mt-0.5 text-xs break-words whitespace-pre-wrap text-dim">
                  {w.text}
                </p>
              </div>
              {!frozen && (
                <button
                  onClick={() => startEdit(w)}
                  className="tap-target inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-line px-3 py-1 text-xs text-dim transition-colors hover:border-neon/50 hover:text-chalk"
                >
                  <span aria-hidden="true">✎</span>
                  重寫
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-faint">
        {frozen
          ? "活動已結束，這些內容不會再變動了。"
          : "重寫會直接取代原本那一則，對方的牆上只會有最新的版本。"}
      </p>
    </section>
  );

  /*
    封存後整頁唯讀。待寫清單就算還有人也不再顯示輸入框——
    寫不進去卻擺著一個能打字的框，比直接說清楚更讓人困惑。
  */
  if (frozen) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black">我寫過的短評</h1>
          <p className="text-xs text-faint">
            活動已經結束，不能再新增或修改。
            {initial.length > 0 && ` 還有 ${initial.length} 位沒來得及寫。`}
          </p>
        </div>
        {written.length > 0 ? (
          writtenList
        ) : (
          <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-faint">
            活動期間沒有寫過任何短評。
          </p>
        )}
      </div>
    );
  }

  // 待寫清空且不在重寫中：恭喜畫面，但已寫清單仍留著讓人回去改。
  if (!target) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-4xl">🎉</p>
          <p className="font-bold text-neon">全部寫完了</p>
          <p className="text-sm text-dim">
            所有收集到的人都有你的一段話，分數也都入帳了。
          </p>
        </div>
        {writtenList}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">
            {editing ? "重寫這一則" : "寫下你的印象"}
          </h1>
          {editing ? (
            <button
              onClick={() => {
                setEditing(null);
                setText("");
              }}
              className="text-xs text-faint underline"
            >
              取消
            </button>
          ) : (
            <span className="px text-sm text-flare">
              還有 {String(queue.length).padStart(2, "0")} 位
            </span>
          )}
        </div>

        <div className="rounded-xl border border-line surface p-5">
          <p className="px text-[10px] tracking-[0.2em] text-faint">ABOUT</p>
          <p className="mb-3 text-lg font-black">{target.nickname}</p>

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
            只有 {target.nickname} 看得到，而且會顯示你的名字。
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare"
          >
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={submitting || !text.trim()}
          className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void transition-colors hover:bg-neon/85 disabled:bg-line disabled:text-faint disabled:shadow-none"
        >
          {submitting
            ? "儲存中…"
            : editing
              ? "儲存修改"
              : "送出，下一位"}
        </button>
      </div>

      {/* 重寫時把清單收起來，避免旁邊還列著同一則造成混淆。 */}
      {!editing && writtenList}
    </div>
  );
}
