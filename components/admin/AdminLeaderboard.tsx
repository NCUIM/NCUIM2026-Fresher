"use client";

import { useEffect, useState } from "react";
import { SHOWCASE_SIZE } from "@/lib/validation";
import { FloatingWall } from "@/components/wall/FloatingWall";
import type { WallImpression } from "@/lib/wall";
import { Avatar } from "@/components/card/Avatar";
import { CardDisplay } from "@/components/card/CardDisplay";
import type { CardView } from "@/lib/cards";

type Entry = {
  rank: number;
  participantId: string;
  nickname: string;
  score: number;
};

type Detail = {
  nickname: string;
  card: CardView;
  wall: WallImpression[];
  showcase: { position: number; nickname: string; avatarUrl: string | null }[];
};

type Opened = {
  id: string;
  nickname: string;
  view: "card" | "showcase" | "wall";
};

/**
 * 後台的完整排名。
 *
 * 與參與者端有兩個差別：不截斷（後台要掌握全場，不是保護最後一名的心情），
 * 而且每一列可以彈出那個人的九宮格與浮光牆。
 *
 * 三者分成獨立按鈕而不是一次全攤開：它們是不同的東西——卡片是他怎麼呈現
 * 自己，九宮格是他選了誰，浮光牆是別人怎麼說他——而且浮光牆是私人內容，
 * 要看的人得明確按下去。
 */
export function AdminLeaderboard({ entries }: { entries: Entry[] }) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetail(null);
    setError(null);
    (async () => {
      const res = await fetch(`/api/admin/participants/${opened.id}/detail`);
      if (cancelled) return;
      if (!res.ok) {
        setError("讀取失敗");
        return;
      }
      setDetail(await res.json());
    })();
    return () => {
      cancelled = true;
    };
  }, [opened]);

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
        還沒有人得分。
      </p>
    );
  }

  const bySlot = new Map((detail?.showcase ?? []).map((s) => [s.position, s]));

  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">完整排名</span>
        <span className="text-xs text-faint">
          {entries.length} 人・不含工作人員
        </span>
      </div>

      {/*
        桌機分兩欄。一百人的清單單欄要捲很久，而後台是拿筆電看的——
        寬度本來就在那裡，不用白白留給空白。
      */}
      <ul className="grid gap-1.5 lg:grid-cols-2 lg:gap-2">
        {entries.map((e, i) => (
          <li
            key={e.participantId}
            /* --row 讓每一列依序落下，而不是整片一起出現。 */
            style={{ "--row": i } as React.CSSProperties}
            className="rank-row flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-neon/50 hover:shadow-[0_4px_20px_-6px_rgba(44,232,181,0.35)]"
          >
            <span
              className={`px w-8 shrink-0 text-sm font-bold ${
                e.rank === 1
                  ? "rank-medal-1"
                  : e.rank === 2
                    ? "rank-medal-2"
                    : e.rank === 3
                      ? "rank-medal-3"
                      : "text-faint"
              }`}
            >
              {String(e.rank).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {e.nickname}
            </span>
            <span className="px shrink-0 text-sm text-neon">{e.score}</span>

            <span className="flex w-full gap-2 sm:w-auto sm:flex-1 sm:justify-end">
              <button
                onClick={() =>
                  setOpened({
                    id: e.participantId,
                    nickname: e.nickname,
                    view: "card",
                  })
                }
                className="tap-target flex-1 rounded-lg border-2 border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-neon hover:bg-neon/10 hover:text-neon"
              >
                卡片
              </button>
              <button
                onClick={() =>
                  setOpened({
                    id: e.participantId,
                    nickname: e.nickname,
                    view: "showcase",
                  })
                }
                className="tap-target flex-1 rounded-lg border-2 border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-neon hover:bg-neon/10 hover:text-neon"
              >
                九宮格
              </button>
              <button
                onClick={() =>
                  setOpened({
                    id: e.participantId,
                    nickname: e.nickname,
                    view: "wall",
                  })
                }
                className="tap-target flex-1 rounded-lg border-2 border-line px-3 py-1.5 text-xs font-medium transition-colors hover:border-neon hover:bg-neon/10 hover:text-neon"
              >
                浮光牆
              </button>
            </span>
          </li>
        ))}
      </ul>

      {opened && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-void/85 p-5 backdrop-blur-sm"
          onClick={() => setOpened(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            /* 浮光牆需要空間才漂得起來，九宮格則是固定的三乘三。 */
            className={`card-pop w-full rounded-xl border border-line surface p-5 ${
              opened.view === "wall"
                ? "max-w-md"
                : opened.view === "card"
                  ? "max-w-md"
                  : "max-w-sm"
            }`}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="font-bold">
                {opened.nickname} 的
                {opened.view === "card"
                  ? "卡片"
                  : opened.view === "showcase"
                    ? "九宮格"
                    : "浮光牆"}
              </h3>
              <button
                onClick={() => setOpened(null)}
                className="tap-target rounded-sm border border-line px-2.5 text-xs text-dim transition-colors hover:border-neon/60 hover:text-chalk"
              >
                關閉
              </button>
            </div>

            <div className="mt-4">
              {error ? (
                <p className="text-sm text-flare">{error}</p>
              ) : !detail ? (
                <p className="text-sm text-faint">讀取中…</p>
              ) : opened.view === "card" ? (
                /*
                  用參與者端同一個 CardDisplay，理由跟浮光牆一樣：
                  審核違規頭像或暱稱時，看到的必須是別人看到的那一面。
                  卡面顏色也照本人的選擇呈現，不套後台的介面主題。

                  key 綁 id：換一個人時要重新掛載，動畫才會重播。
                  沒有它的話 React 會沿用同一個 DOM，第二張卡直接跳出來。
                */
                <div className="card-flip" key={opened.id}>
                  <div className="card-flip-inner">
                    <div
                      className="card-flip-face card-flip-back"
                      aria-hidden="true"
                    >
                      <span className="px text-glow-neon text-xs tracking-[0.35em] text-neon">
                        NCUIM
                      </span>
                    </div>
                    <div className="card-flip-face card-shine rounded-xl">
                      <CardDisplay card={detail.card} />
                    </div>
                  </div>
                </div>
              ) : opened.view === "showcase" ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
                    const s = bySlot.get(i);
                    return (
                      <div
                        key={i}
                        className={`grid aspect-square place-items-center overflow-hidden rounded-lg border text-[10px] ${
                          s
                            ? "border-neon bg-slate text-neon"
                            : "border-dashed border-line text-faint"
                        }`}
                      >
                        {s ? (
                          <Avatar
                            src={s.avatarUrl}
                            nickname={s.nickname}
                            className="size-full text-[10px]"
                            rounded="rounded-none"
                          />
                        ) : (
                          <span className="px">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /*
                  用參與者端同一個元件呈現，而不是另外排一份清單。
                  審核時看到的必須是本人看到的那一面牆——排版不同的話，
                  「他說的那則」與「我看到的那則」就對不起來。
                  唯讀模式下隱藏的內容仍留在牆上並標示，那正是要看的東西。
                */
                <FloatingWall
                  impressions={detail.wall}
                  purgeDate={null}
                  readOnly
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
