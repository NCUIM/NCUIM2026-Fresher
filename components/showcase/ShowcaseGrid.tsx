"use client";

import { useState } from "react";
import type { CardView } from "@/lib/cards";
import { CardPopup, popOriginFrom, type PopOrigin } from "@/components/card/CardPopup";
import { SHOWCASE_SIZE } from "@/lib/validation";
import { EmptySlot, SlotFace } from "./SlotFace";

type Slot = { position: number; subjectId: string; card: CardView };

/**
 * 個人頁上的九宮格。點格子會展開那個人的卡片，不是跳到編輯頁。
 *
 * 先前每一格都連到 /showcase：想看看自己選了誰，結果被丟進編輯介面，
 * 而編輯不是點下去時想做的事——想改的人會去按上方那顆「編輯」。
 */
export function ShowcaseGrid({
  slots,
  eventName,
}: {
  slots: Slot[];
  eventName: string;
}) {
  const [opened, setOpened] = useState<
    { card: CardView; origin: PopOrigin } | null
  >(null);

  const bySlot = new Map(slots.map((s) => [s.position, s]));

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
          const slot = bySlot.get(i);
          return slot ? (
            <button
              key={i}
              onClick={(e) =>
                setOpened({ card: slot.card, origin: popOriginFrom(e) })
              }
              className="grid aspect-square place-items-center rounded-lg border border-neon bg-slate p-1 transition-colors hover:border-neon hover:bg-neon/10"
            >
              <SlotFace
                nickname={slot.card.nickname}
                avatarUrl={slot.card.avatarUrl}
              />
            </button>
          ) : (
            <span
              key={i}
              className="grid aspect-square place-items-center rounded-lg border border-dashed border-line"
            >
              <EmptySlot index={i} />
            </span>
          );
        })}
      </div>

      {opened && (
        <CardPopup
          card={opened.card}
          origin={opened.origin}
          eventName={eventName}
          onClose={() => setOpened(null)}
        />
      )}
    </>
  );
}
