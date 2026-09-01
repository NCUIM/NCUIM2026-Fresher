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
  /** 只有主辦方看得到。 */
  realName: string;
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
      {/*
        flex-1 讓三欄的內容區一樣高（grid 預設就會把列拉齊），
        items-center 再把各自的內容擺到中間——三者的自然高度差很多，
        不置中的話會全部貼齊上緣，右邊那欄下方拖出一大塊空白。
      */}
      <div className="flex flex-1 items-center">
        <div className="w-full">{children}</div>
      </div>
    </section>
  );
}

/*
  落花的位置與節奏。

  刻意寫死而不用 Math.random()：同一個人重複打開時應該是同一場花雨，
  而不是每次都換一套——那會讓人以為畫面在閃。左右各七片，中間 34%–66%
  留空給名字。
*/
const PETALS = [
  { left: 3, size: 10, delay: 0.05, fall: 3.0, drift: 26, spin: 300 },
  { left: 8, size: 7, delay: 0.42, fall: 2.6, drift: -14, spin: -220 },
  { left: 14, size: 11, delay: 0.18, fall: 3.3, drift: 34, spin: 190 },
  { left: 19, size: 8, delay: 0.68, fall: 2.8, drift: -22, spin: 260 },
  { left: 25, size: 9, delay: 0.3, fall: 3.1, drift: 18, spin: -300 },
  { left: 30, size: 6, delay: 0.88, fall: 2.4, drift: 28, spin: 210 },
  { left: 34, size: 8, delay: 0.55, fall: 3.4, drift: -30, spin: -170 },
  { left: 66, size: 9, delay: 0.12, fall: 3.2, drift: 24, spin: -250 },
  { left: 71, size: 7, delay: 0.6, fall: 2.7, drift: -26, spin: 290 },
  { left: 77, size: 11, delay: 0.25, fall: 3.5, drift: 16, spin: 200 },
  { left: 82, size: 8, delay: 0.78, fall: 2.9, drift: -18, spin: -280 },
  { left: 88, size: 10, delay: 0.38, fall: 3.1, drift: 30, spin: 230 },
  { left: 93, size: 6, delay: 0.95, fall: 2.5, drift: -12, spin: -190 },
  { left: 97, size: 9, delay: 0.5, fall: 3.3, drift: 22, spin: 270 },
];

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

  /*
    背光包在外層、掃光包在內層，不能疊在同一個元素上：
    掃光需要 overflow: hidden 才不會溢出，而那會把往外擴散的背光切掉。
  */
  const showcaseBlock = detail && (
    <div className="card-backlight">
      <div className="card-shine grid grid-cols-3 gap-2 rounded-xl">
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
    </div>
  );

  /*
    用參與者端同一個元件呈現，而不是另外排一份清單。
    審核時看到的必須是本人看到的那一面牆——排版不同的話，
    「他說的那則」與「我看到的那則」就對不起來。
    唯讀模式下隱藏的內容仍留在牆上並標示，那正是要看的東西。
  */
  const wallBlock = detail && (
    <div className="card-backlight">
      <div className="card-shine rounded-xl">
        <FloatingWall impressions={detail.wall} purgeDate={null} readOnly />
      </div>
    </div>
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
            className={`card-pop relative my-auto w-full rounded-xl border border-line surface p-5 ${
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
                <div
                  /*
                    --card-accent 提到這一層：姓名的雷擊與三欄的背光都要用
                    它，而姓名是 grid 的兄弟節點，掛在 grid 上它拿不到。
                  */
                  style={
                    {
                      "--card-accent": detail.card.color.accent,
                    } as React.CSSProperties
                  }
                >
                  {/*
                    閃電蓋在整個彈窗上，key 綁 id 讓換人時重播。
                    aria-hidden：它純粹是視覺，讀螢幕的人不需要知道畫面閃了。
                  */}
                  <span
                    key={`flash-${opened.id}`}
                    aria-hidden="true"
                    className="showcase-flash"
                  />

                  {/*
                    姓名放在三欄上方那塊空白。原本那裡只有標題列靠左，
                    右側大半是空的——而這是一張「介紹某個人」的版面，
                    主角的名字本來就該是最大的那一行。
                  */}
                  {/*
                    顯示真實姓名而不是暱稱。這一頁是給主辦方核對「這是誰」
                    用的，而暱稱在標題列已經有了——兩處都放暱稱等於浪費
                    版面上最大的那一行。

                    兩側原本是一大片空白。落花與細線把它填起來，同時
                    把視線收攏到中間的名字上。
                  */}
                  <div className="showcase-crown mb-2" key={`crown-${opened.id}`}>
                    <span aria-hidden="true">
                      {PETALS.map((p, i) => (
                        <i
                          key={i}
                          className="showcase-petal"
                          style={
                            {
                              left: `${p.left}%`,
                              "--size": `${p.size}px`,
                              "--delay": `${p.delay}s`,
                              "--fall": `${p.fall}s`,
                              "--drift": `${p.drift}px`,
                              "--spin": `${p.spin}deg`,
                            } as React.CSSProperties
                          }
                        />
                      ))}
                    </span>
                    <span
                      aria-hidden="true"
                      className="showcase-rule showcase-rule-left"
                    />
                    <span
                      aria-hidden="true"
                      className="showcase-rule showcase-rule-right"
                    />
                    <p className="showcase-name px relative text-center text-2xl font-black text-neon lg:text-4xl">
                      {detail.realName}
                    </p>
                  </div>

                <div
                  /*
                    九宮格與浮光牆等寬，中間的卡片略寬。

                    九宮格是 3×3 的正方格，寬度直接決定格子大小——先前給
                    0.72fr 讓它縮成一排小方塊，右邊卻有大片空白。與牆等寬
                    之後兩側的重量才平衡。

                    背光的顏色由外層的 --card-accent 提供。
                  */
                  className="grid gap-7 lg:grid-cols-[1fr_1.2fr_1fr]"
                >
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
