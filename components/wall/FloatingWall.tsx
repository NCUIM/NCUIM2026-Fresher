"use client";

import { useEffect, useRef, useState } from "react";
import type { WallImpression } from "@/lib/wall";

/**
 * 由 id 推導出穩定的偽亂數。
 *
 * 每一則落在哪一層、從哪個高度飄過，都不能每次重新整理就換一套——
 * 這面牆是使用者會反覆回來看的東西，認得出「那一句在最前面那層」
 * 才有連續感。用 id 當種子，同一則永遠是同一個樣子。
 */
function seeded(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** 火花數量。太多會在低階手機上掉幀，太少看不出是爆開。 */
const SPARK_COUNT = 10;

/** 卡片放大到彈窗出現之間的間隔，讓放大這件事被看見。 */
const POP_DELAY_MS = 260;

/** 拖住之後停留多久自動放回流中。 */
const STAY_MS = 15000;

/** 超過這個位移才算拖曳；之內都算點擊。 */
const DRAG_THRESHOLD_PX = 8;

/**
 * 景深分層。
 *
 * 近的一層大、清晰、不透明，而且**跑得快**；遠的一層小、模糊、淡，跑得慢。
 * 這個對應關係不能反——近快遠慢是視差的全部內容，反過來會讓整面牆看起來
 * 像在往後倒。
 *
 * speed 是相對倍率而不是秒數：實際時長要由則數推導（見 flowDuration）。
 */
const LAYERS = [
  { size: 22, opacity: 1, blur: 0, heightPct: 88, speed: 0.75 },
  { size: 17, opacity: 0.78, blur: 0.4, heightPct: 72, speed: 1 },
  { size: 14, opacity: 0.6, blur: 0.9, heightPct: 56, speed: 1.4 },
];

/** 目標節奏：整面牆平均每這麼久就有一根新的字柱進場。 */
const APPEAR_EVERY_S = 1;

/*
  單根字柱飛完一趟的上下限。

  下限保護可讀性——一趟 200cqw 裡只有一半在視野內，時長 16 秒代表
  一根字柱在畫面上停留約 8 秒，那是讀完一句 50 字的下限。
  上限保護節奏：則數很多時不能讓一輪拖成兩分鐘。
*/
const MIN_FLOW_S = 16;
const MAX_FLOW_S = 75;

/**
 * 由則數推導某一層的一輪時長。
 *
 * 同一層的每一根平均分佈在一輪裡，所以「一層每隔多久出現一根」＝
 * 時長÷該層則數。三層加起來要達到每秒一根，就讓每一層的時長都與
 * **總則數**成正比——各層則數大致均分，相加後的進場頻率自然回到
 * 每秒一根，而各層之間仍然靠 speed 倍率保有速度差。
 */
function flowDuration(total: number, speed: number): number {
  const ideal = total * APPEAR_EVERY_S * speed;
  return Math.min(MAX_FLOW_S, Math.max(MIN_FLOW_S, ideal));
}

/** 滑鼠視差的最大位移。再大就會讓字柱飄出容器邊緣。 */
const PARALLAX_X = 22;
const PARALLAX_Y = 14;

type Pinned = { x: number; y: number };

/**
 * 浮光牆。
 *
 * 每一則短評是一根直排的字柱，從右緣外等速流進來、左緣外流出去，
 * 分三層景深疊著跑。拖住一根會停在原地十五秒（右側有一條倒數線），
 * 時間到就從當下的位置接回流中；點一下則打開內容，可以隱藏或回報。
 *
 * 為什麼不是靜態的清單：這些話是別人在活動當下寫給你的，散落在時間裡
 * 被你陸續收到。整齊排成一列會把它們變成一份清單；讓它們各自流過，
 * 才像那天現場的樣子。
 *
 * 尊重 prefers-reduced-motion：橫向流過的直排文字對前庭功能敏感的人
 * 最不友善，在該設定下改為靜態的橫向清單（見 globals.css），內容一字不少。
 */
export function FloatingWall({
  impressions,
  purgeDate,
  readOnly = false,
  fill = false,
}: {
  impressions: WallImpression[];
  purgeDate: string | null;
  /*
    滿版：整個視窗就是這面牆，只讓開底部導覽列。

    字柱要有足夠的橫向距離才看得出「流過」；擠在一個小方框裡，一根
    從進場到離場只有兩三秒，那是閃過不是流動。參與者頁用滿版，後台
    的彈窗維持有框的尺寸——那裡本來就是在一個框裡審核。
  */
  fill?: boolean;
  /*
    後台檢視用。呈現與本人看到的完全一致——審核時看到的必須是本人
    看到的那一份，不然「有問題的內容」與「被回報的內容」對不起來。

    差別有二：隱藏的內容照樣留在牆上（只是標示出來），因為那正是
    最需要被看到的；以及不提供隱藏與回報，那是收件人自己的決定。
  */
  readOnly?: boolean;
}) {
  const [items, setItems] = useState(impressions);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 檢舉要二次確認：它會驚動主辦方，而且送出後不能撤回。
  const [confirmingReport, setConfirmingReport] = useState(false);

  const [spark, setSpark] = useState<{ x: number; y: number; key: number } | null>(
    null,
  );

  /** 被拖住的字柱：id → 相對於視差層的位置。 */
  const [pinned, setPinned] = useState<Record<string, Pinned>>({});
  /** 正在倒數的字柱：id → 一個換就會讓倒數線重新掛載的序號。 */
  const [counting, setCounting] = useState<Record<string, number>>({});
  /** 放回流中後的動畫相位，讓它從被放下的位置接著跑，而不是跳回原位。 */
  const [resumed, setResumed] = useState<Record<string, number>>({});

  const driftRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const stayTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // release 會在 setTimeout 裡跑，閉包抓到的是舊的 pinned。用 ref 讀最新值。
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  // 元件卸載時清掉待觸發的計時器，否則會在已卸載的元件上 setState。
  useEffect(() => {
    const pending = timers.current;
    const stays = stayTimers.current;
    return () => {
      pending.forEach(clearTimeout);
      Object.values(stays).forEach(clearTimeout);
    };
  }, []);

  /*
    滑鼠視差。只在有精確指標的裝置上跑——觸控裝置沒有「游標位置」，
    掛上去只會是一個永遠不動的 rAF 迴圈。拖曳中凍結，否則手指按著
    字柱不動，字柱卻因為視差在飄，會覺得抓不住。
  */
  useEffect(() => {
    const el = driftRef.current;
    if (!el) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;

    function onMove(e: PointerEvent) {
      const box = el!.getBoundingClientRect();
      targetX = ((e.clientX - box.left) / box.width - 0.5) * -PARALLAX_X;
      targetY = ((e.clientY - box.top) / box.height - 0.5) * -PARALLAX_Y;
    }

    function loop() {
      if (!dragRef.current) {
        currentX += (targetX - currentX) * 0.05;
        currentY += (targetY - currentY) * 0.05;
        el!.style.transform = `translate(${currentX.toFixed(1)}px, ${currentY.toFixed(1)}px)`;
      }
      frame = requestAnimationFrame(loop);
    }

    window.addEventListener("pointermove", onMove);
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  /** 打開一則的內容：先放火花，再開彈窗。 */
  function openSheet(id: string, center: { x: number; y: number }) {
    setSpark({
      x: center.x,
      y: center.y,
      // key 讓同一根連按兩次也會重播動畫——沒有它，React 會沿用同一個
      // 節點，動畫不會重新開始。
      key: Date.now(),
    });
    timers.current.push(
      setTimeout(() => {
        setSelectedId(id);
        setSpark(null);
      }, POP_DELAY_MS),
    );
  }

  function stopStay(id: string) {
    clearTimeout(stayTimers.current[id]);
    delete stayTimers.current[id];
    setCounting((c) => {
      if (!(id in c)) return c;
      const next = { ...c };
      delete next[id];
      return next;
    });
  }

  /** 放手後開始倒數，時間到自動放回流中。 */
  function startStay(id: string) {
    clearTimeout(stayTimers.current[id]);
    setCounting((c) => ({ ...c, [id]: Date.now() }));
    stayTimers.current[id] = setTimeout(() => release(id), STAY_MS);
  }

  /**
   * 放回流中，從當下的位置接著跑。
   *
   * 直接拿掉 pinned 的話，字柱會瞬移回它「本來應該在」的相位——那個
   * 跳動會把留置這件事的手感整個破壞掉。所以先由當下的 x 反推流動
   * 進行到幾成，再用負的 animation-delay 讓它從那一刻接上。
   */
  function release(id: string) {
    stopStay(id);
    const el = driftRef.current;
    const spot = pinnedRef.current[id];
    if (el && spot) {
      const width = el.getBoundingClientRect().width;
      if (width > 0) {
        // 相位 p 時 translateX = width - 2 * width * p，故 p = (width - x) / 2width。
        const progress = Math.min(Math.max((width - spot.x) / (2 * width), 0), 1);
        setResumed((r) => ({ ...r, [id]: progress }));
      }
    }
    setPinned((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    const el = driftRef.current;
    if (!el) return;
    // 按下就先停住：這樣拖曳不會有「先跑掉一小段再被抓住」的落差，
    // 而點擊時彈窗馬上蓋上來，停住這件事根本看不見。
    const box = el.getBoundingClientRect();
    const rect = e.currentTarget.getBoundingClientRect();
    const spot = { x: rect.left - box.left, y: rect.top - box.top };

    stopStay(id);
    setPinned((p) => ({ ...p, [id]: spot }));
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: spot.x,
      baseY: spot.y,
      moved: false,
    };
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    setPinned((p) => ({
      ...p,
      [drag.id]: { x: drag.baseX + dx, y: drag.baseY + dy },
    }));
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;

    if (drag.moved) {
      startStay(drag.id);
      return;
    }

    // 沒移動就是點擊：放回流中，並打開內容。
    const rect = e.currentTarget.getBoundingClientRect();
    release(drag.id);
    openSheet(drag.id, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }

  // 從 items 找而不是存整個物件，這樣切換隱藏後彈窗內容會跟著更新。
  const selected = items.find((i) => i.id === selectedId) ?? null;
  // 唯讀時不濾掉隱藏的：對審核者而言，那些正是最需要看見的內容。
  const visible = readOnly ? items : items.filter((i) => !i.hidden);
  const hiddenOnes = readOnly ? [] : items.filter((i) => i.hidden);

  /*
    分層與同層內的排隊順序都取自 **全部** 內容，而不是 visible。

    同一層的字柱靠平均分配的負延遲彼此錯開，永遠不會疊在一起。若用
    visible 來分配，隱藏一則會讓同層其餘每一根重新排隊，整面牆瞬間
    洗牌；用全集分配，被隱藏的那一根留下一段空檔，其餘照舊。
  */
  const layerOf = new Map<string, number>();
  const slotOf = new Map<string, number>();
  const layerSize = LAYERS.map(() => 0);
  for (const item of items) {
    const layer = Math.min(
      LAYERS.length - 1,
      Math.floor(seeded(item.id, 10) * LAYERS.length),
    );
    layerOf.set(item.id, layer);
    slotOf.set(item.id, layerSize[layer]);
    layerSize[layer] += 1;
  }

  function patch(id: string, change: Partial<WallImpression>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }

  async function toggleHidden(item: WallImpression) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/impressions/hide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impressionId: item.id, hidden: !item.hidden }),
      });
      if (!res.ok) {
        setError("操作失敗，請再試一次");
        return;
      }
      patch(item.id, { hidden: !item.hidden });
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setBusy(false);
    }
  }

  async function report(item: WallImpression) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/impressions/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ impressionId: item.id }),
      });
      if (!res.ok) {
        setError("回報失敗，請再試一次");
        return;
      }
      patch(item.id, { reported: true });
      setConfirmingReport(false);
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setSelectedId(null);
    setConfirmingReport(false);
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="px text-[11px] tracking-[0.2em] text-faint">EMPTY</span>
        <p className="font-bold">還沒有人寫下對你的印象</p>
        <p className="text-sm text-dim">
          多去認識一些人，他們寫的話會出現在這裡。
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 夜空當底，右上角一道琥珀月光 */}
      <div
        className={`wall-field bg-void ${
          fill ? "wall-field-fill" : "rounded-xl border border-line"
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 72% 16%, rgba(255,206,92,.14), transparent 55%)",
          }}
        />

        {visible.length === 0 ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-faint">
            這面牆上的內容都被你隱藏了。
          </p>
        ) : (
          <div ref={driftRef} className="wall-drift-layer">
            {visible.map((item) => {
              const layerIndex = layerOf.get(item.id) ?? 0;
              const layer = LAYERS[layerIndex];
              const slot = slotOf.get(item.id) ?? 0;
              const total = Math.max(1, layerSize[layerIndex]);
              const duration = flowDuration(items.length, layer.speed);
              const spot = pinned[item.id];

              /*
                同層的每一根平均分配在一整輪裡。負的延遲代表「這一輪已經
                跑掉的部分」，所以載入時它們就已經散在各處，而不是全部
                擠在右緣外排隊等進場。
              */
              const progress = resumed[item.id] ?? slot / total;
              const chars = Array.from(item.text);
              // 長句不能讓最後一個字等太久，逐字的間隔隨字數縮短。
              const charStep = Math.min(0.09, 2.2 / Math.max(1, chars.length));

              const tone = item.featured
                ? "text-moon"
                : readOnly && item.reported
                  ? "text-flare"
                  : readOnly && item.hidden
                    ? "text-dim"
                    : "text-chalk";

              /*
                被拖住的那一根拿掉淡度與模糊，光暈也加強。

                拖住的唯一目的就是把一句話停下來好好讀——留著景深的
                模糊等於這個動作沒有生效。景深是給「還在流的」用的。
              */
              const held = Boolean(spot);

              return (
                <button
                  key={item.id}
                  onPointerDown={(e) => onPointerDown(e, item.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  aria-label={`${item.text} — ${item.authorNickname}`}
                  className={`wall-col ${tone} ${spot ? "wall-col-pinned" : ""}`}
                  style={
                    {
                      fontSize: `${layer.size}px`,
                      height: `${layer.heightPct}%`,
                      top: spot
                        ? `${spot.y}px`
                        : `${seeded(item.id, 11) * (100 - layer.heightPct)}%`,
                      left: spot ? `${spot.x}px` : 0,
                      opacity: held ? 1 : layer.opacity,
                      filter: !held && layer.blur ? `blur(${layer.blur}px)` : undefined,
                      textShadow: item.featured
                        ? `0 0 ${held ? 22 : 16}px rgba(255,206,92,${held ? 0.7 : 0.45})`
                        : `0 0 ${held ? 20 : 14}px rgba(160,190,255,${held ? 0.65 : 0.35})`,
                      "--flow-duration": `${duration}s`,
                      "--flow-delay": `${-progress * duration}s`,
                      "--sway-duration": `${4 + seeded(item.id, 12) * 3}s`,
                      "--sway-from": `${-1.2 + seeded(item.id, 13)}deg`,
                      "--sway-to": `${0.2 + seeded(item.id, 14) * 1.2}deg`,
                    } as React.CSSProperties
                  }
                >
                  <span className="wall-sway" aria-hidden="true">
                    {chars.map((ch, i) => (
                      <span
                        key={i}
                        className="wall-ch"
                        style={{ animationDelay: `${0.35 + i * charStep}s` }}
                      >
                        {ch}
                      </span>
                    ))}
                    <span
                      className="wall-ch opacity-60"
                      style={{
                        animationDelay: `${0.35 + chars.length * charStep}s`,
                        fontSize: "0.75em",
                      }}
                    >
                      　—{item.authorNickname}
                      {readOnly && item.reported && "・已回報"}
                      {readOnly && item.hidden && "・已隱藏"}
                    </span>
                  </span>

                  {/*
                    倒數線。key 一換就重新掛載，動畫因此從頭跑——
                    再次拖住要重新計時，光換 class 是不會重播的。
                  */}
                  {counting[item.id] && (
                    <span
                      key={counting[item.id]}
                      aria-hidden="true"
                      className="wall-stayline"
                      style={
                        { "--stay-duration": `${STAY_MS}ms` } as React.CSSProperties
                      }
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div aria-hidden="true" className="wall-vignette" />
        {fill && (
          <>
            <div aria-hidden="true" className="wall-scrim wall-scrim-top" />
            <div aria-hidden="true" className="wall-scrim wall-scrim-bottom" />
          </>
        )}
      </div>

      {/*
        滿版時牆是 fixed 的，已經脫離版面流。其餘內容要自己建立堆疊
        脈絡疊上去，否則會被牆蓋住——連「已隱藏」那份清單都點不到。
      */}
      <div
        className={
          fill ? "relative z-10 mt-auto flex flex-col gap-4" : "contents"
        }
      >
        {/* 說明文字不吃觸控，否則底部那一整條會擋住從那裡流過的字柱。 */}
        <p className="pointer-events-none text-center text-[11px] text-faint">
          點一下讀全文或隱藏 ｜ 拖住可留置 {STAY_MS / 1000} 秒
        </p>

        {/*
          隱藏的內容收在這裡而不是留在牆上。留在牆上（就算調淡）等於沒有隱藏；
          但完全不列出來，「還原」就變成一個到不了的功能。
        */}
        {hiddenOnes.length > 0 && (
          <details className="rounded-xl border border-line surface px-4 py-3">
            <summary className="cursor-pointer text-sm text-dim">
              已隱藏（{hiddenOnes.length}）
            </summary>
            <ul className="mt-3 flex flex-col gap-1.5">
              {hiddenOnes.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setSelectedId(item.id)}
                    className="w-full rounded-lg border border-line px-3 py-2 text-left"
                  >
                    <p className="truncate text-xs text-faint">{item.text}</p>
                    <p className="mt-0.5 text-[10px] text-faint">
                      — {item.authorNickname}
                      {item.reported && " ・已回報"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {purgeDate && (
          <p className="text-center text-[11px] text-faint">
            這些內容將於 {purgeDate} 刪除，想留下請自行截圖
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare"
          >
            {error}
          </p>
        )}
      </div>

      {/*
        點擊的火花。用 fixed 定位到被點的字柱中心，pointer-events:none
        讓它不會擋住底下的東西——它純粹是回饋，不是可互動的元素。
      */}
      {spark && (
        <div
          key={spark.key}
          aria-hidden="true"
          className="pointer-events-none fixed z-50"
          style={{ left: spark.x, top: spark.y }}
        >
          {Array.from({ length: SPARK_COUNT }, (_, i) => {
            const angle = (360 / SPARK_COUNT) * i + seeded(String(spark.key), i) * 24;
            return (
              <span
                key={i}
                className="wall-spark"
                style={
                  {
                    "--spark-angle": `${angle}deg`,
                    "--spark-distance": `${38 + seeded(String(spark.key), i + 50) * 34}px`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-void/80 px-5 pb-[calc(1.5rem+var(--safe-bottom))]"
          onClick={close}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-line surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/*
              檢舉放在角落而不是與隱藏並列。它是少數情況才用得到的動作，
              擺在同等份量的位置會讓每個只想關掉一則的人都先讀一次「回報」。

              唯讀檢視不提供：隱藏與回報都是收件人自己的決定，
              後台代替他做等於幫他決定要不要在意這句話。
            */}
            {!readOnly && (
              <button
                onClick={() => setConfirmingReport(true)}
                disabled={selected.reported || busy}
                aria-label={selected.reported ? "已回報給主辦方" : "回報給主辦方"}
                className={`absolute top-3 right-3 grid size-8 place-items-center rounded-full border text-base font-black transition-colors ${
                  selected.reported
                    ? "border-line text-faint"
                    : "border-flare/60 text-flare hover:bg-flare/10"
                }`}
              >
                !
              </button>
            )}

            <p className="pr-10 text-base">{selected.text}</p>
            <p className="mt-2 text-sm text-dim">— {selected.authorNickname}</p>
            {selected.reported && (
              <p className="mt-1 text-xs text-faint">已回報給主辦方</p>
            )}

            {confirmingReport ? (
              <div className="mt-5 flex flex-col gap-2 rounded-lg border border-flare/50 bg-flare/10 p-4">
                <p className="text-sm font-bold text-flare">
                  要回報這則內容給主辦方嗎？
                </p>
                <p className="text-xs text-flare/85">
                  主辦方會看到內容與作者。<strong>送出後無法撤回。</strong>
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => report(selected)}
                    disabled={busy}
                    className="tap-target flex-1 rounded-sm bg-flare py-2.5 text-sm font-bold text-void disabled:opacity-60"
                  >
                    {busy ? "送出中…" : "確定回報"}
                  </button>
                  <button
                    onClick={() => setConfirmingReport(false)}
                    disabled={busy}
                    className="tap-target rounded-sm border border-line px-4 text-sm text-dim"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : readOnly ? (
              <div className="mt-5 flex flex-col gap-2">
                <p className="flex flex-wrap gap-2 text-xs">
                  {selected.featured && (
                    <span className="text-neon">在作者的九宮格中</span>
                  )}
                  {selected.reported && (
                    <span className="font-bold text-flare">已回報，需處理</span>
                  )}
                  {selected.hidden && (
                    <span className="text-moon">已被收件人隱藏</span>
                  )}
                </p>
                <button
                  onClick={close}
                  className="tap-target rounded-sm py-2.5 text-sm text-faint"
                >
                  關閉
                </button>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                {/* 開關而不是單向按鈕：隱藏一按就生效，不可逆的話誤觸就沒救了。 */}
                <label className="flex cursor-pointer items-center justify-between rounded-lg border border-line px-4 py-3">
                  <span className="flex flex-col">
                    <span className="text-sm font-medium">
                      {selected.hidden ? "已隱藏" : "顯示在牆上"}
                    </span>
                    <span className="text-xs text-faint">
                      {selected.hidden
                        ? "只有你看不到，作者不會知道"
                        : "關掉就不會出現在浮光牆上"}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={!selected.hidden}
                    disabled={busy}
                    onChange={() => toggleHidden(selected)}
                    className="size-6 shrink-0 accent-neon"
                  />
                </label>

                <button
                  onClick={close}
                  className="tap-target rounded-sm py-2.5 text-sm text-faint"
                >
                  關閉
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
