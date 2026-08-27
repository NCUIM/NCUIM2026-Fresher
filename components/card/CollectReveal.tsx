import type { CardView } from "@/lib/cards";
import { CardDisplay } from "./CardDisplay";

/**
 * 收集成功的揭示。
 *
 * 這是整個產品最核心的動作，先前卻只是換一個畫面顯示卡片，毫無回饋。
 * 洋紅在全站只保留給這一刻，色差也只用在這裡——用在別處就稀釋掉了。
 *
 * 重複收集時刻意不套用同一套慶祝：那不是新的相遇，給同樣的回饋會讓
 * 真正的第一次失去份量。
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

      {points !== undefined && points > 0 && (
        <p className="px text-glow-moon text-center text-sm text-moon">
          +{points} PTS
        </p>
      )}
    </div>
  );
}
