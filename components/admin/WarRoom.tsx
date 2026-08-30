"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  WarRoomScene,
  achievementLevel,
  type AchievementBurst,
  type SceneEdge,
  type SceneNode,
} from "./WarRoomScene";

type FeedItem = {
  id: string;
  kind: "scan" | "achievement";
  at: string;
  actorId: string;
  targetId: string | null;
  actor: string;
  target: string | null;
  label: string | null;
  points: number;
};

type Rank = {
  rank: number;
  participantId: string;
  nickname: string;
  score: number;
};

type Snapshot = {
  /** 伺服器的時鐘。下一次輪詢用它當游標。 */
  now: string;
  /** 這一包的 edges 是不是只有新增的部分。 */
  incremental: boolean;
  stats: {
    participants: number;
    encounters: number;
    achievements: number;
    /** 這場活動裡最高的成就分值。等級是相對於它算的。 */
    maxAchievementPoints: number;
  };
  nodes: SceneNode[];
  /** 走增量時這裡只有新的相遇；完整的那張網由客戶端累積。 */
  edges: SceneEdge[];
  feed: FeedItem[];
  ranking: Rank[];
};

/** 輪詢間隔。兩秒半在「看起來即時」與「不必要的負載」之間。 */
const POLL_MS = 2500;

/** 新事件的高亮持續時間。太短會錯過，太長會讓整面都在閃。 */
const FLASH_MS = 4000;

/** 主動掃描排行顯示幾名。左欄放得下、又足夠看出誰在帶動現場。 */
const INITIATIVE_TOP = 6;

/*
  左欄寬度的上下限與預設值。

  下限 180 是統計卡上那個兩位數還讀得出來的寬度；上限 520 是再寬下去
  中央的星圖就會被擠到失去意義——這面畫面的主體是那張網，側欄只是註解。
*/
const LEFT_MIN = 180;
const LEFT_MAX = 520;
const LEFT_DEFAULT = 256;

/** 拉過的寬度記在瀏覽器裡。投影用的那台電腦解析度固定，不該每次都重調。 */
const LEFT_WIDTH_KEY = "warroom:left-width";

/**
 * 追蹤「這一輪才新出現的 id」，並在 ms 之後自動退場。
 *
 * 連線與事件牆各需要一份，兩邊的邏輯一字不差。寫兩次的代價不是行數，
 * 而是計時器要在兩處各自記得清掉——漏掉任何一處，切換活動後就會有
 * 殘留的 setTimeout 對著已經換掉的資料呼叫 setState。
 */
function useFlash(ms: number) {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    [],
  );

  const mark = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setFresh((s) => new Set([...s, ...ids]));
      timers.current.push(
        setTimeout(() => {
          setFresh((s) => {
            const next = new Set(s);
            ids.forEach((id) => next.delete(id));
            return next;
          });
        }, ms),
      );
    },
    [ms],
  );

  const clear = useCallback(() => setFresh(new Set()), []);

  return { fresh, mark, clear };
}

/** 統計卡的數字滾到目標值，而不是直接跳。 */
function useRolling(target: number) {
  const [shown, setShown] = useState(target);
  const raf = useRef(0);
  const current = useRef(target);

  useEffect(() => {
    function step() {
      const diff = target - current.current;
      if (Math.abs(diff) < 0.5) {
        current.current = target;
        setShown(target);
        return;
      }
      current.current += diff * 0.18;
      setShown(Math.round(current.current));
      raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return shown;
}

function StatCard({
  label,
  value,
  tone,
  bumping,
}: {
  label: string;
  value: number;
  tone: "neon" | "moon" | "flare";
  bumping: boolean;
}) {
  const shown = useRolling(value);
  const accent =
    tone === "neon"
      ? "border-l-neon text-neon"
      : tone === "moon"
        ? "border-l-moon text-moon"
        : "border-l-flare text-flare";
  return (
    <div
      className={`warroom-panel warroom-stat ${bumping ? "warroom-bump" : ""} flex items-center justify-between border-l-4 px-4 py-3 ${accent}`}
    >
      <span className="text-sm tracking-wider text-dim">{label}</span>
      <b className="px text-glow-neon text-3xl leading-none">
        {String(shown).padStart(2, "0")}
      </b>
    </div>
  );
}

/**
 * 活動戰情室。
 *
 * **用輪詢而不是 SSE 或 WebSocket。** 這是刻意的取捨：七十人的活動、
 * 一次幾百組相遇，整包 JSON 只有幾十 KB，每兩三秒重取一次的成本可以忽略；
 * 而長連線在 Cloud Run 這類環境會遇到閒置逾時、重連與擴縮容時的斷線，
 * 為了一場幾小時的活動去處理那些，代價遠高於收益。
 *
 * 星圖本身在 WarRoomScene 裡。這裡只負責取資料與周邊的面板——把每一幀
 * 的繪製與每 2.5 秒的資料更新分開，兩邊才不會互相牽動。
 */
export function WarRoom({
  events,
  initialEventId,
}: {
  events: { id: string; name: string; status: string }[];
  initialEventId: string;
}) {
  const [eventId, setEventId] = useState(initialEventId);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(true);
  const [clock, setClock] = useState("");
  /** 星圖上被點選的節點。點空白處會變回 null。 */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alert, setAlert] = useState({ n: 0, gold: false });
  /*
    左欄寬度。

    先用預設值渲染、掛載後才讀 localStorage——直接在 useState 的初始值
    裡讀會讓伺服器與瀏覽器算出不同的 HTML，React 會噴 hydration 錯誤。
  */
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(LEFT_WIDTH_KEY));
      if (saved >= LEFT_MIN && saved <= LEFT_MAX) setLeftWidth(saved);
    } catch {
      // 無痕視窗或封鎖網站資料時讀不到，用預設值即可。
    }
  }, []);

  const applyWidth = useCallback((next: number) => {
    const clamped = Math.min(LEFT_MAX, Math.max(LEFT_MIN, Math.round(next)));
    setLeftWidth(clamped);
    try {
      localStorage.setItem(LEFT_WIDTH_KEY, String(clamped));
    } catch {
      // 存不了就算了，這一次的調整仍然生效。
    }
  }, []);

  const seenEdges = useRef<Set<string>>(new Set());
  const seenFeed = useRef<Set<string>>(new Set());
  /*
    累積起來的完整那張網。

    伺服器走增量之後只會送新的相遇，整張網由這裡拼起來。用 Map 而不是
    陣列：伺服器的查詢帶了五秒的重疊視窗，同一筆會重複送到，靠 id 去重。
  */
  const allEdges = useRef<Map<string, SceneEdge>>(new Map());
  /** 上一次成功取得快照時的伺服器時間，下一次當游標送回去。 */
  const cursor = useRef<string | null>(null);
  /** 上一次交給畫面的那個陣列。沒有新相遇時原樣沿用，避免整張圖重算。 */
  const edgeList = useRef<SceneEdge[]>([]);
  /*
    已經收到過至少一份快照。

    這個旗標必須自己記，不能用「看過的集合是不是空的」來推斷：活動剛
    開場時本來就一筆資料都沒有，那個條件會在每一輪都成立，於是全場的
    第一次掃描與第一個成就永遠不會高亮——而那正是最該被看到的兩件事。
  */
  const hasSnapshot = useRef(false);

  const {
    fresh: freshEdges,
    mark: markEdges,
    clear: clearEdges,
  } = useFlash(FLASH_MS);
  const {
    fresh: freshFeed,
    mark: markFeed,
    clear: clearFeed,
  } = useFlash(FLASH_MS);

  /*
    拖曳分隔線。

    監聽掛在 window 而不是分隔線本身：滑鼠拉得比游標快時會離開那條
    只有幾像素寬的線，事件就斷了，手感變成「拉一下就掉」。
  */
  useEffect(() => {
    if (!dragging) return;

    function onMove(e: PointerEvent) {
      const box = shellRef.current?.getBoundingClientRect();
      if (!box) return;
      applyWidth(e.clientX - box.left);
    }
    function onUp() {
      setDragging(false);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    // 拖曳時整頁禁止選取，否則會把側欄的文字一起反白。
    const previous = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.userSelect = previous;
    };
  }, [dragging, applyWidth]);

  // 大螢幕上的時鐘。現場要對時間時，看的是這裡而不是誰的手機。
  useEffect(() => {
    function tick() {
      setClock(
        new Date().toLocaleTimeString("zh-TW", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // 切換活動時重置「看過的」，否則新活動的所有相遇都會被當成新事件一起閃。
  // 游標與累積的網也要一起清掉，不然新場次會拿到上一場的連線。
  useEffect(() => {
    seenEdges.current = new Set();
    seenFeed.current = new Set();
    allEdges.current = new Map();
    edgeList.current = [];
    cursor.current = null;
    hasSnapshot.current = false;
    clearEdges();
    clearFeed();
    setData(null);
    // 選取也要清掉，否則會停在上一場活動裡不存在的那個人身上。
    setSelectedId(null);
  }, [eventId, clearEdges, clearFeed]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        /*
          帶著游標去要增量。沒有游標（首次載入、剛切換活動、上一次失敗）
          就不帶，伺服器會回完整的一份——那也是連線中斷後的復原路徑。
        */
        const query = new URLSearchParams({ eventId });
        if (cursor.current) query.set("since", cursor.current);
        const res = await fetch(`/api/admin/warroom?${query}`);
        if (cancelled) return;
        if (!res.ok) {
          setError("讀取失敗");
          return;
        }
        const snapshot: Snapshot = await res.json();
        if (cancelled) return;
        setError(null);
        cursor.current = snapshot.now;

        // 第一份快照不閃：整面一起亮起來，反而看不出發生了什麼。
        const isFirstSnapshot = !hasSnapshot.current;
        hasSnapshot.current = true;

        const newEdges = snapshot.edges
          .filter((e) => !seenEdges.current.has(e.id))
          .map((e) => e.id);
        const newFeed = snapshot.feed
          .filter((f) => !seenFeed.current.has(f.id))
          .map((f) => f.id);

        snapshot.edges.forEach((e) => seenEdges.current.add(e.id));
        snapshot.feed.forEach((f) => seenFeed.current.add(f.id));

        /*
          把新的相遇併進累積的那張網。

          沒有新的就沿用上一次那個陣列——星圖是以陣列的 identity 判斷
          要不要重建的，每次都給新陣列的話，即使一整分鐘沒事發生，
          一千多條連線也會每 2.5 秒重算一次版面。
        */
        if (!snapshot.incremental) allEdges.current = new Map();
        let added = false;
        for (const e of snapshot.edges) {
          if (!allEdges.current.has(e.id)) {
            allEdges.current.set(e.id, e);
            added = true;
          }
        }
        if (added || edgeList.current.length === 0) {
          edgeList.current = [...allEdges.current.values()].sort(
            (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
          );
        }

        setData({ ...snapshot, edges: edgeList.current });

        if (!isFirstSnapshot) {
          markEdges(newEdges);
          markFeed(newFeed);
          /*
            有事發生時整個畫面的邊緣閃一下——投影幕前的人不會一直盯著右欄。
            成就用金色、掃描用青色：餘光掃到顏色就知道剛剛是哪一種事。
          */
          const gold = snapshot.feed.some(
            (f) => newFeed.includes(f.id) && f.kind === "achievement",
          );
          if (newEdges.length || newFeed.length) {
            setAlert((a) => ({ n: a.n + 1, gold }));
          }
        }
      } catch {
        if (!cancelled) setError("連線中斷，持續重試中");
      }
    }

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId, markEdges, markFeed]);

  /*
    剛解鎖的成就。星圖要的不只是「誰」——還要名稱與分值，才畫得出
    等級對應的爆發強度，並在那個節點上說出突破的是什麼。
  */
  const freshAchievements = useMemo<AchievementBurst[]>(
    () =>
      (data?.feed ?? [])
        .filter((f) => f.kind === "achievement" && freshFeed.has(f.id))
        .map((f) => ({
          id: f.id,
          participantId: f.actorId,
          title: f.label ?? "隱藏成就",
          points: f.points,
        })),
    [data, freshFeed],
  );

  /*
    主動掃描排行。右欄的排行榜看的是分數，那是收集與成就的總和；
    這裡看的是誰主動去掃別人——CONTEXT.md 把 Scan 的歸屬定義為衡量
    主動程度的唯一依據，兩份榜回答的是不同的問題。
  */
  const initiative = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of data?.edges ?? []) {
      counts.set(edge.scannerId, (counts.get(edge.scannerId) ?? 0) + 1);
    }
    const byId = new Map((data?.nodes ?? []).map((n) => [n.id, n.nickname]));
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, nickname: byId.get(id) ?? "—" }))
      .sort((a, b) => b.count - a.count)
      .slice(0, INITIATIVE_TOP);
  }, [data]);

  const maxInitiative = Math.max(1, ...initiative.map((i) => i.count));
  const stats = data?.stats;

  /*
    被點選的那個人，以及他跟誰相遇過。

    星圖那邊已經把相關的線點亮了，但在密集的網裡「亮起來的線通向誰」
    仍然難讀。這裡把名單列出來，並照相遇時間排序——最近的在最上面，
    那通常是主辦方想知道的（「他剛剛跟誰講到話」）。
  */
  const selection = useMemo(() => {
    if (!selectedId || !data) return null;
    const node = data.nodes.find((n) => n.id === selectedId);
    if (!node) return null;

    const nameById = new Map(data.nodes.map((n) => [n.id, n.nickname]));
    const met = data.edges
      .filter((e) => e.scannerId === selectedId || e.scannedId === selectedId)
      .map((e) => {
        const otherId =
          e.scannerId === selectedId ? e.scannedId : e.scannerId;
        return {
          id: e.id,
          nickname: nameById.get(otherId) ?? "—",
          at: e.at,
          // 誰主動的。Scan 只歸屬發起方，那是衡量主動程度的唯一依據。
          initiated: e.scannerId === selectedId,
        };
      })
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    const rank = data.ranking.find((r) => r.participantId === selectedId);
    return { node, met, rank };
  }, [selectedId, data]);

  return (
    <div className="warroom relative flex h-dvh flex-col overflow-hidden bg-void text-chalk">
      {/* 掃描線與緩慢掠過的光束。純氛圍，不擋任何操作。 */}
      <div aria-hidden="true" className="warroom-scanlines" />
      <div aria-hidden="true" className="warroom-beam" />
      {/* 有事發生時邊緣閃一下。key 一換就重播。 */}
      <div
        key={alert.n}
        aria-hidden="true"
        className={`warroom-edge-flash ${alert.gold ? "is-gold" : ""}`}
      />

      <header className="warroom-band relative z-20 flex flex-wrap items-center gap-4 px-6 py-3">
        <span className="warroom-badge grid size-11 place-items-center rounded-full text-xl text-neon">
          ◈
        </span>
        <span className="flex flex-col">
          <h1 className="text-xl font-black tracking-[0.28em] text-chalk">
            活動戰情室
          </h1>
          <span className="px text-[10px] tracking-[0.3em] text-faint">
            LIVE EVENT COCKPIT
          </span>
        </span>

        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          aria-label="選擇活動"
          className="warroom-panel ml-2 rounded-sm px-3 py-1.5 text-sm text-chalk focus:border-neon focus:outline-none"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.status === "ARCHIVED" ? "（已封存）" : ""}
            </option>
          ))}
        </select>

        <span className="ml-auto flex items-center gap-5">
          {error ? (
            <span className="text-xs text-flare">{error}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-faint">
              <span className="warroom-pulse size-2 rounded-full bg-neon" />
              即時
            </span>
          )}
          <b className="px text-glow-neon text-2xl text-neon">{clock}</b>
          <button
            onClick={() => setShowRanking((v) => !v)}
            className="tap-target rounded-sm border border-line px-3 text-xs text-dim transition-colors hover:border-neon/60 hover:text-chalk"
          >
            {showRanking ? "收起排行榜" : "展開排行榜"}
          </button>
          {/*
            退出。這一頁是全螢幕的，沒有底部導覽也沒有側欄——
            沒有這顆按鈕就只剩瀏覽器的上一頁可以離開。
          */}
          <Link
            href="/admin/events"
            className="tap-target rounded-sm border border-line px-3 text-xs text-dim transition-colors hover:border-flare/60 hover:text-flare"
          >
            ✕ 退出
          </Link>
        </span>
      </header>

      <div ref={shellRef} className="relative z-10 flex min-h-0 flex-1">
        {/* 左欄：三張統計卡與主動掃描排行 */}
        <aside
          className="hidden shrink-0 flex-col gap-3 overflow-y-auto p-4 lg:flex"
          style={{ width: leftWidth }}
        >
          <StatCard
            label="報到人數"
            value={stats?.participants ?? 0}
            tone="neon"
            bumping={false}
          />
          <StatCard
            label="相遇組數"
            value={stats?.encounters ?? 0}
            tone="flare"
            bumping={freshEdges.size > 0}
          />
          <StatCard
            label="解鎖成就"
            value={stats?.achievements ?? 0}
            tone="moon"
            bumping={freshAchievements.length > 0}
          />

          <div className="warroom-panel mt-1 flex min-h-0 flex-1 flex-col p-3">
            <h2 className="warroom-title mb-2">主動掃描排行</h2>
            <ul className="flex flex-col gap-1.5 overflow-y-auto">
              {initiative.map((row, i) => (
                <li key={row.id} className="flex items-center gap-2 text-xs">
                  <span className="w-14 shrink-0 truncate text-dim">
                    {row.nickname}
                  </span>
                  <span className="warroom-bar h-2 flex-1">
                    <i
                      className={i === 0 ? "is-lead" : undefined}
                      style={{ width: `${(row.count / maxInitiative) * 100}%` }}
                    />
                  </span>
                  <b className="px w-6 shrink-0 text-right text-chalk">
                    {String(row.count).padStart(2, "0")}
                  </b>
                </li>
              ))}
              {initiative.length === 0 && (
                <li className="py-6 text-center text-xs text-faint">
                  還沒有人開始掃描。
                </li>
              )}
            </ul>
          </div>
        </aside>

        {/*
          分隔線。

          做成 separator 而不是純裝飾：投影時常常是用鍵盤在操作，
          方向鍵能調寬度比「一定要用滑鼠精準抓住三像素」實際得多。
        */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="調整左欄寬度"
          aria-valuenow={leftWidth}
          aria-valuemin={LEFT_MIN}
          aria-valuemax={LEFT_MAX}
          tabIndex={0}
          onPointerDown={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDoubleClick={() => applyWidth(LEFT_DEFAULT)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") applyWidth(leftWidth - 16);
            else if (e.key === "ArrowRight") applyWidth(leftWidth + 16);
            else return;
            e.preventDefault();
          }}
          className={`warroom-resizer hidden lg:block ${dragging ? "is-dragging" : ""}`}
          title="拖曳調整寬度，雙擊還原"
        />

        {/* 中央星圖 */}
        <div className="relative min-w-0 flex-1">
          {!data ? (
            <p className="absolute inset-0 grid place-items-center text-sm text-faint">
              讀取中…
            </p>
          ) : data.nodes.length === 0 ? (
            <p className="absolute inset-0 grid place-items-center text-sm text-faint">
              還沒有人報到。
            </p>
          ) : (
            <WarRoomScene
              nodes={data.nodes}
              edges={data.edges}
              freshEdges={freshEdges}
              achievements={freshAchievements}
              maxAchievementPoints={data.stats.maxAchievementPoints}
              onSelect={setSelectedId}
            />
          )}
        </div>

        {/* 右欄：選取詳情（有選才出現）＋ 事件牆 ＋ 排行榜 */}
        <aside className="flex w-80 shrink-0 flex-col gap-3 p-4">
          {/*
            點選節點後的詳情。

            放在右欄最上方而不是浮在星圖上：浮層會蓋住那張網，而使用者
            點某個節點的目的正是要看那個人在網裡的位置。
          */}
          {selection && (
            <section className="warroom-panel flex max-h-[45%] min-h-0 flex-col p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="warroom-title">已選取</h2>
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="取消選取"
                  className="tap-target rounded-sm px-2 text-xs text-faint transition-colors hover:text-flare"
                >
                  ✕
                </button>
              </div>

              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-base font-bold text-moon">
                  {selection.node.nickname}
                </span>
                {selection.node.role === "STAFF" && (
                  <span className="rounded-full border border-line px-2 text-[10px] text-dim">
                    工作人員
                  </span>
                )}
                <span className="px text-xs text-neon">
                  {selection.node.score} 分
                </span>
                {selection.rank && (
                  <span className="px text-xs text-faint">
                    第 {selection.rank.rank} 名
                  </span>
                )}
                <span className="text-xs text-faint">
                  相遇 {selection.met.length} 人
                </span>
              </div>

              <ul className="min-h-0 flex-1 overflow-y-auto pr-1">
                {selection.met.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-2 border-b border-line/40 py-1 text-xs"
                  >
                    {/*
                      箭頭方向就是誰主動。一次 Scan 讓雙方各得一張卡，
                      但發起方只有一個——那是這面畫面唯一看得出
                      「誰比較主動」的地方。
                    */}
                    <span
                      className="px w-4 shrink-0 text-center text-faint"
                      title={m.initiated ? "他主動掃描對方" : "對方掃描他"}
                    >
                      {m.initiated ? "→" : "←"}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{m.nickname}</span>
                    <time className="px shrink-0 text-[10px] text-faint">
                      {new Date(m.at).toLocaleTimeString("zh-TW", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </li>
                ))}
                {selection.met.length === 0 && (
                  <li className="py-4 text-center text-xs text-faint">
                    還沒有跟任何人相遇。
                  </li>
                )}
              </ul>
            </section>
          )}

          <section className="warroom-panel flex min-h-0 flex-1 flex-col p-3">
            <h2 className="warroom-title mb-2">警報資訊</h2>
            <ul className="min-h-0 flex-1 overflow-y-auto pr-1">
              {(data?.feed ?? []).map((f) => (
                <li
                  key={f.id}
                  className={`warroom-log mb-1.5 px-2 py-1.5 text-xs leading-relaxed ${
                    f.kind === "achievement" ? "is-gold" : ""
                  } ${freshFeed.has(f.id) ? "warroom-flash is-new" : ""}`}
                >
                  <span className="px mr-1.5 text-[10px] text-faint">
                    {new Date(f.at).toLocaleTimeString("zh-TW", {
                      hour12: false,
                    })}
                  </span>
                  {f.kind === "scan" ? (
                    /*
                      寫成「A 掃描 B」而不是「A ⇄ B」。雙箭頭看起來對稱，
                      但對稱的是 Collection（雙方各得一張卡），Scan 只歸屬
                      發起的那一方——投影在牆上時，那個方向就是全場看得到
                      誰比較主動的唯一線索。
                    */
                    <span>
                      <strong>{f.actor}</strong> 掃描 <strong>{f.target}</strong>
                    </span>
                  ) : (
                    <span>
                      {/*
                        星數就是等級，由分值推導。事件牆會捲走，但捲走
                        之前至少要看得出剛剛那一個有多難——三顆星和一顆星
                        在現場是完全不同份量的事。
                      */}
                      <span className="mr-1 text-moon">
                        {"★".repeat(
                          achievementLevel(
                            f.points,
                            stats?.maxAchievementPoints ?? 0,
                          ),
                        )}
                      </span>
                      <strong>{f.actor}</strong> 解鎖「{f.label}」
                      <span className="px ml-1">+{f.points}</span>
                    </span>
                  )}
                </li>
              ))}
              {data && data.feed.length === 0 && (
                <li className="px-4 py-6 text-center text-xs text-faint">
                  還沒有任何動態。
                </li>
              )}
            </ul>
          </section>

          {/*
            收起的是排行榜本身，不是整個右欄——事件牆要一直看得到。
            標題留著，收起後才知道那裡還有東西可以展開。
          */}
          <section
            className={`warroom-panel flex min-h-0 flex-col p-3 ${
              showRanking ? "max-h-[45%]" : ""
            }`}
          >
            <h2 className="warroom-title mb-2">即時排行榜</h2>
            <ul
              className={`min-h-0 flex-1 overflow-y-auto pr-1 ${
                showRanking ? "" : "hidden"
              }`}
            >
              {(data?.ranking ?? []).map((r) => (
                <li
                  key={r.participantId}
                  className="flex items-center gap-3 border-b border-line/40 px-1 py-1.5 text-xs"
                >
                  <span
                    className={`px w-6 shrink-0 font-bold ${
                      r.rank <= 3 ? "text-neon" : "text-faint"
                    }`}
                  >
                    {String(r.rank).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.nickname}</span>
                  <span className="px shrink-0 text-neon">{r.score}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
