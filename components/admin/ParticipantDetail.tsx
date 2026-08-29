"use client";

import { useEffect, useState } from "react";
import { SHOWCASE_SIZE } from "@/lib/validation";

type Detail = {
  nickname: string;
  wall: {
    id: string;
    text: string;
    authorId: string;
    authorNickname: string;
    featured: boolean;
    hidden: boolean;
    reported: boolean;
  }[];
  showcase: {
    position: number;
    nickname: string;
    avatarUrl: string | null;
  }[];
};

/**
 * 一位參與者收到的短評與他的九宮格。
 *
 * 只在展開時才去取——七十個人若全部預先載入，光是為了看其中一個人的內容，
 * 就要把全場的私人短評一次拉到瀏覽器裡。
 */
export function ParticipantDetail({ participantId }: { participantId: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/participants/${participantId}/detail`);
      if (cancelled) return;
      if (!res.ok) {
        setError("讀取失敗");
        return;
      }
      setData(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  if (error) return <p className="text-xs text-flare">{error}</p>;
  if (!data) return <p className="text-xs text-faint">讀取中…</p>;

  const bySlot = new Map(data.showcase.map((s) => [s.position, s]));

  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-1.5">
        <h4 className="text-xs font-bold text-dim">
          九宮格（{data.showcase.length}/{SHOWCASE_SIZE}）
        </h4>
        <div className="grid w-40 grid-cols-3 gap-1">
          {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
            const s = bySlot.get(i);
            return (
              <div
                key={i}
                title={s?.nickname}
                className={`grid aspect-square place-items-center overflow-hidden rounded border text-[9px] ${
                  s ? "border-neon bg-slate text-neon" : "border-dashed border-line"
                }`}
              >
                {s ? (
                  s.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.avatarUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="truncate px-0.5">{s.nickname}</span>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <h4 className="text-xs font-bold text-dim">
          收到的短評（{data.wall.length}）
        </h4>
        {data.wall.length === 0 ? (
          <p className="text-xs text-faint">還沒有人寫給他。</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.wall.map((w) => (
              <li
                key={w.id}
                className={`rounded border px-2.5 py-2 text-xs ${
                  w.reported
                    ? "border-flare bg-flare/10"
                    : w.hidden
                      ? "border-moon/50 bg-moon/10"
                      : "border-line"
                }`}
              >
                <p className="whitespace-pre-wrap">{w.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-faint">
                  <span>—— {w.authorNickname}</span>
                  {w.featured && <span className="text-neon">在對方九宮格中</span>}
                  {/*
                    回報與隱藏分開標示，兩者的意思完全不同：
                    隱藏是「我不想看到」，回報才是「請你們處理」。
                    混在一起會讓真正需要處置的那幾則淹沒在無關的隱藏裡。
                  */}
                  {w.reported && (
                    <span className="font-bold text-flare">已回報，需處理</span>
                  )}
                  {w.hidden && <span className="text-moon">已被收件人隱藏</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
