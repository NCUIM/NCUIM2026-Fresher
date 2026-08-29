"use client";

import { useState } from "react";
import type { CardView } from "@/lib/cards";
import { CardPopup, popOriginFrom, type PopOrigin } from "./CardPopup";

/**
 * 收集清單的網格。
 *
 * 格子上只有圖與暱稱，其餘一律不放。這一頁的用途是「我收集到誰了」，
 * 一眼掃過全部戰績；把圖示、組別、自我介紹都塞進小格子，每一張都變得
 * 難讀，反而看不出收集到誰。細節等點開再說。
 */
export function CardGrid({
  cards,
  eventName,
}: {
  cards: CardView[];
  eventName: string;
}) {
  const [opened, setOpened] = useState<
    { card: CardView; origin: PopOrigin } | null
  >(null);

  return (
    <>
      <ul className="grid grid-cols-3 gap-3">
        {cards.map((card) => (
          <li key={card.id}>
            <button
              onClick={(e) =>
                setOpened({ card, origin: popOriginFrom(e) })
              }
              className="flex w-full flex-col items-center gap-1 rounded-lg border border-line bg-slate p-2 transition-colors hover:border-neon"
            >
              {/*
                三個圖示排在照片上方，由左而右。它們是這個人自己挑的性格標記，
                在一片相似的頭像裡最快能認出「這是誰」——所以要完整看得見，
                疊在照片上會被底圖吃掉。
                場次名稱不放：同一份清單裡每張都一樣，佔位置卻沒有資訊。
              */}
              <span
                aria-hidden="true"
                className="flex h-6 w-full items-center justify-start gap-1.5 rounded-sm bg-void/50 px-1.5 text-sm leading-none"
              >
                {card.icons.map((icon) => (
                  <span key={icon.key}>{icon.emoji}</span>
                ))}
              </span>

              {card.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.avatarUrl}
                  alt=""
                  className="aspect-square w-full rounded-lg border border-line object-cover"
                />
              ) : (
                <span className="grid aspect-square w-full place-items-center rounded-lg border border-line bg-void text-2xl font-black text-faint">
                  {card.nickname.slice(0, 1)}
                </span>
              )}

              <span className="w-full truncate px-1 text-center text-xs text-dim">
                {card.nickname}
              </span>
            </button>
          </li>
        ))}
      </ul>

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
