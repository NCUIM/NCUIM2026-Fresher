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

/**
 * 「展示」裡的一欄。
 *
 * 三欄共用同一組欄頭，是為了讓它們讀起來像同一件事的三個面向，
 * 而不是三個各自為政的區塊——那條漸淡的細線就是在做這件事。
 */
function Panel({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <span className="px text-[10px] tracking-[0.3em] text-neon/80">
          {label}
        </span>
        <span className="text-xs text-faint">{title}</span>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-line to-transparent"
        />
      </header>
      {children}
    </section>
  );
}

type Opened = {
  id: string;
  nickname: string;
  /** 名次與分數帶進彈窗，開著時仍看得出這是誰、排第幾。 */
  rank: number;
  score: number;
  view: "card" | "showcase" | "wall" | "all";
};

const VIEW_LABEL: Record<Opened["view"], string> = {
  card: "卡片",
  showcase: "九宮格",
  wall: "浮光牆",
  all: "全部",
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

  /*
    三個區塊抽出來，因為「展示」會把它們排在一起，而單獨的三顆按鈕
    各自只顯示一個——同樣的東西寫兩次，改了一邊忘了另一邊，後台看到的
    就會跟參與者看到的不一致，而那正是這一頁存在的理由。
  */
  /*
    key 綁 id：換一個人時要重新掛載，翻牌動畫才會重播。
    沒有它的話 React 會沿用同一個 DOM，第二張卡直接跳出來。

    --card-accent 把卡片主人選的顏色交給 CSS，背光才會是他的顏色而不是
    固定的霓虹綠——卡面顏色是他對外呈現的一部分。
  */
  const renderCard = (size: "normal" | "large") =>
    detail && (
      <div
        key={`card-${opened?.id}-${size}`}
        className="card-flip card-backlight"
        style={
          { "--card-accent": detail.card.color.accent } as React.CSSProperties
        }
      >
        <div className="card-flip-inner">
          <div className="card-flip-face card-flip-back" aria-hidden="true">
            <span className="px text-glow-neon text-xs tracking-[0.35em] text-neon">
              NCUIM
            </span>
          </div>
          <div className="card-flip-face card-shine rounded-xl">
            <CardDisplay card={detail.card} size={size} />
          </div>
        </div>
      </div>
    );

  const showcaseBlock = detail && (
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
              <span className="px">{String(i + 1).padStart(2, "0")}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  /*
    用參與者端同一個元件呈現，而不是另外排一份清單。
    審核時看到的必須是本人看到的那一面牆——排版不同的話，
    「他說的那則」與「我看到的那則」就對不起來。
    唯讀模式下隱藏的內容仍留在牆上並標示，那正是要看的東西。
  */
  const wallBlock = detail && (
    <FloatingWall impressions={detail.wall} purgeDate={null} readOnly />
  );

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
              {/*
                「展示」用實心的霓虹邊框跟其餘三顆分開：它不是第四種內容，
                而是「一次看完」——放在最前面，讓多數情況一顆就夠。
              */}
              <button
                onClick={() =>
                  setOpened({
                    id: e.participantId,
                    nickname: e.nickname,
                    rank: e.rank,
                    score: e.score,
                    view: "all",
                  })
                }
                className="tap-target flex-1 rounded-lg border-2 border-neon/70 bg-neon/10 px-3 py-1.5 text-xs font-bold text-neon transition-colors hover:bg-neon hover:text-void"
              >
                展示
              </button>
              <button
                onClick={() =>
                  setOpened({
                    id: e.participantId,
                    nickname: e.nickname,
                    rank: e.rank,
                    score: e.score,
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
                    rank: e.rank,
                    score: e.score,
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
                    rank: e.rank,
                    score: e.score,
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
          /*
            上緣對齊而不是垂直置中。置中在內容比視窗高時會把上緣切掉，
            而且捲不回去——「展示」三欄一起顯示時一定會遇到。
            內容不高時由 my-auto 補回置中的視覺效果。
          */
          className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-void/85 p-5 backdrop-blur-sm"
          onClick={() => setOpened(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            /* 浮光牆需要空間才漂得起來，九宮格則是固定的三乘三。 */
            className={`card-pop my-auto w-full rounded-xl border border-line surface p-5 ${
              opened.view === "all"
                ? "max-w-6xl"
                : opened.view === "showcase"
                  ? "max-w-sm"
                  : "max-w-md"
            }`}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
              <h3 className="flex flex-wrap items-baseline gap-2.5">
                <span className="px text-sm font-bold text-neon">
                  {String(opened.rank).padStart(2, "0")}
                </span>
                <span className="text-base font-black">{opened.nickname}</span>
                <span className="px text-sm text-neon">{opened.score}</span>
                <span className="text-xs text-faint">
                  {VIEW_LABEL[opened.view]}
                </span>
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
              ) : opened.view === "all" ? (
                /*
                  由左至右：他選了誰 → 他是誰 → 別人怎麼說他。
                  三欄寬度不等分，因為它們要的空間不同——九宮格是正方形，
                  給太寬只會把格子撐成巨大的方塊；浮光牆最需要橫向空間，
                  字柱才漂得開。
                */
                <div className="grid gap-7 lg:grid-cols-[0.72fr_1.28fr_1.15fr]">
                  <Panel label="SHOWCASE" title="九宮格">
                    {showcaseBlock}
                  </Panel>
                  <Panel label="CARD" title="個人卡片">
                    {renderCard("large")}
                  </Panel>
                  <Panel label="WALL" title="浮光牆">
                    {wallBlock}
                  </Panel>
                </div>
              ) : opened.view === "card" ? (
                renderCard("normal")
              ) : opened.view === "showcase" ? (
                showcaseBlock
              ) : (
                wallBlock
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
