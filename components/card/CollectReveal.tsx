"use client";

import { useState } from "react";
import type { CardView } from "@/lib/cards";
import { IMPRESSION_MAX } from "@/lib/validation";
import { CardDisplay } from "./CardDisplay";

/**
 * 收集成功的揭示。
 *
 * 這是整個產品最核心的動作，先前卻只是換一個畫面顯示卡片，毫無回饋。
 * 洋紅在全站只保留給這一刻，色差也只用在這裡——用在別處就稀釋掉了。
 *
 * 短評直接寫在這裡，而不是等使用者之後自己去 /write：
 * 剛見完面是印象最深的時刻，隔幾小時再回想「這個人給我什麼感覺」
 * 只會寫出罐頭句。而且基礎分要寫完才入帳，順手完成才不會積成一堆待辦。
 */
export function CollectReveal({
  card,
  duplicate,
  points,
}: {
  card: CardView;
  duplicate: boolean;
  points?: number;
}) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/impressions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectId: card.id, text }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "儲存失敗");
        return;
      }
      setSaved(true);
    } catch {
      setError("連線失敗，稍後可以到「寫短評」補完");
    } finally {
      setSaving(false);
    }
  }

  if (duplicate) {
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col items-center gap-1">
          <span className="px text-[11px] tracking-[0.2em] text-faint">
            ALREADY COLLECTED
          </span>
          <h1 className="text-xl font-black text-dim">你已經收集過這個人了</h1>
          <p className="text-sm text-faint">重複掃描不會增加分數</p>
        </header>
        <CardDisplay card={card} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-4 overflow-hidden rounded-xl">
      {/* 掃描線橫過畫面一次，模擬「讀取到了」 */}
      <div
        aria-hidden="true"
        className="reveal-scan glow-flare pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-flare"
      />

      <header className="flex flex-col items-center gap-1">
        <span className="px text-glow-flare text-[11px] tracking-[0.22em] text-flare">
          CARD ACQUIRED
        </span>
        <h1 className="aberration text-2xl font-black">收集成功</h1>
      </header>

      <div className="reveal-card">
        <CardDisplay card={card} tone="flare" />
      </div>

      {saved ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-neon/50 bg-neon/10 px-4 py-3">
          <span className="font-bold text-neon">印象已記下</span>
          {points !== undefined && points > 0 && (
            <span className="px text-glow-moon text-sm text-moon">
              +{points} PTS 已入帳
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-line surface px-4 py-3">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-sm">
              <span className="font-bold">
                趁現在寫下對 {card.nickname} 的印象
              </span>
              <span className="px text-xs text-faint">
                {text.length}/{IMPRESSION_MAX}
              </span>
            </span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, IMPRESSION_MAX))}
              rows={2}
              placeholder="例如：講話很好笑，聊到停不下來"
              className="resize-none rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
            />
          </label>

          <p className="text-xs text-faint">
            只有 {card.nickname} 看得到，會顯示你的名字。
            {points !== undefined && points > 0 && ` 寫完才會拿到 ${points} 分。`}
          </p>

          {error && (
            <p role="alert" className="rounded-sm bg-flare/15 px-3 py-2 text-sm text-flare">
              {error}
            </p>
          )}

          <button
            onClick={submit}
            disabled={saving || !text.trim()}
            className="tap-target glow-neon rounded-sm bg-neon py-2.5 text-sm font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
          >
            {saving ? "儲存中…" : "記下印象"}
          </button>

          <p className="text-center text-[11px] text-faint">
            現在不方便？之後可以到底部的「寫短評」補完
          </p>
        </div>
      )}
    </div>
  );
}
