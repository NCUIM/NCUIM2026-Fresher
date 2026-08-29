"use client";

import type { CardView } from "@/lib/cards";
import { CardDisplay } from "./CardDisplay";

/** 被點擊的元素與畫面中心的位移，用來決定展開動畫從哪裡長出來。 */
export type PopOrigin = { dx: number; dy: number };

/**
 * 從被點擊的元素算出動畫起點。
 *
 * 沒有這一步，展開會從畫面正中央憑空出現，看不出是哪一張被打開的——
 * 而九宮格與收集清單都是「一片相似的小格子」，那個對應關係特別重要。
 */
export function popOriginFrom(e: React.MouseEvent<HTMLElement>): PopOrigin {
  const r = e.currentTarget.getBoundingClientRect();
  return {
    dx: r.left + r.width / 2 - window.innerWidth / 2,
    dy: r.top + r.height / 2 - window.innerHeight / 2,
  };
}

/** 點擊卡片後彈出的完整內容。周圍暗處點擊即關閉。 */
export function CardPopup({
  card,
  origin,
  onClose,
  eventName,
}: {
  card: CardView;
  origin: PopOrigin;
  onClose: () => void;
  eventName?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-void/85 p-5 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.nickname} 的卡片`}
    >
      <div
        className="card-pop w-full max-w-sm"
        style={
          {
            "--pop-x": `${origin.dx}px`,
            "--pop-y": `${origin.dy}px`,
          } as React.CSSProperties
        }
        onClick={(e) => e.stopPropagation()}
      >
        <CardDisplay card={card} eventName={eventName} />
        <button
          onClick={onClose}
          className="tap-target mt-3 w-full rounded-sm border border-line py-2.5 text-sm text-dim"
        >
          關閉
        </button>
      </div>
    </div>
  );
}
