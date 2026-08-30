"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cardColorByKey } from "@/lib/card-colors";

export type SceneNode = {
  id: string;
  nickname: string;
  role: string;
  cardColor: string | null;
  score: number;
};

export type SceneEdge = {
  id: string;
  scannerId: string;
  scannedId: string;
  at: string;
};

/** 一次成就解鎖。名稱與分值都要，畫面上要說出突破的是什麼。 */
export type AchievementBurst = {
  id: string;
  participantId: string;
  title: string;
  points: number;
};

/**
 * 成就的等級，由分值在**該場活動內的相對高度**推導。
 *
 * 用分值而不是另外開一個欄位：分值本來就是主辦方對「這件事有多難」的
 * 判斷，再要他們填一次等級只是同一件事寫兩遍，兩邊還會不同步。
 *
 * 但門檻必須是相對的。分值是逐場自訂的——某一場的範圍是三十到兩百，
 * 換一場可能是五到二十；寫死成「五十分以上算三星」的話，前者九個成就
 * 有七個都是三星，後者則永遠不會出現三星，兩邊的等級都等於沒有分。
 */
export function achievementLevel(points: number, max: number): 1 | 2 | 3 {
  if (max <= 0) return 1;
  const ratio = points / max;
  if (ratio >= 0.66) return 3;
  if (ratio >= 0.33) return 2;
  return 1;
}

/*
  場景的邏輯座標。畫布實際多大由容器決定，內容一律畫在這個尺寸上再
  等比置中——這樣節點的相對位置在投影幕與筆電上完全一致，不會因為
  視窗寬一點就把整張網拉扁。
*/
const SCENE_W = 1280;
const SCENE_H = 860;
const CX = SCENE_W / 2;
const CY = SCENE_H / 2 - 20;

/** 節點半徑的上下限。下限保證零分的人仍看得見。 */
const NODE_MIN_R = 9;
const NODE_MAX_R = 28;

const NEON = "#2be8d8";
const FLARE = "#ff2e63";
const MOON = "#ffce5c";

/** 掃描漣漪的存活時間。 */
const RIPPLE_S = 1.4;

/*
  縮放的上下限。

  節點一多，暱稱在滿版檢視下就小到讀不出來——要看清楚某一叢是誰跟誰，
  只能放大。上限 6 倍足以把單一節點的名字看清楚；下限 0.4 則讓人在
  節點散得很開時退遠一點看整體。
*/
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 6;

/** 成就特效的基礎長度，再依等級加長。等級愈高，愈值得讓全場看久一點。 */
const BURST_BASE_S = 1.8;

function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/**
 * 把第 index 個節點放到同心環上。
 *
 * 用環狀而不是力導向：這面畫面要投在大螢幕上持續播放，位置穩定才看得出
 * 「誰又跟誰連上了」；力導向每次重算都會讓所有節點跳一次。
 */
function ringPosition(count: number, index: number) {
  const ring = Math.floor((Math.sqrt(8 * index + 1) - 1) / 2);
  const ringStart = (ring * (ring + 1)) / 2;
  const ringCount = ring + 1;
  const posInRing = index - ringStart;

  const rings = Math.max(1, Math.floor((Math.sqrt(8 * count + 1) - 1) / 2) + 1);
  const radius = ((ring + 1) / (rings + 0.4)) * (SCENE_W / 2 - 150);
  // 每一環錯開起始角度，避免所有環的節點連成一條直線。
  const angle = (posInRing / ringCount) * Math.PI * 2 + ring * 0.6 - Math.PI / 2;

  return {
    x: CX + Math.cos(angle) * radius,
    y: CY + Math.sin(angle) * radius,
  };
}

type Placed = {
  node: SceneNode;
  x: number;
  y: number;
  /** 半徑。分數愈高愈大。 */
  r: number;
  color: string;
  /** 掃描漣漪，從 1 衰減到 0。 */
  ripple: number;
  rippleColor: string;
  /** 成就特效。等級愈高，環愈多、火花愈多、停留愈久。 */
  burst: {
    /** 已經過的秒數。 */
    t: number;
    life: number;
    level: 1 | 2 | 3;
    title: string;
    points: number;
  } | null;
};

/** 封包只在剛發生的相遇上出現，跑完即丟。 */
type Packet = { t: number; speed: number };

type Link = {
  id: string;
  a: Placed;
  b: Placed;
  pts: { x: number; y: number }[];
  lens: number[];
  total: number;
  /** 只有剛發生的相遇才會有封包。靜止時這裡是空的。 */
  packets: Packet[];
  /** 剛發生的高亮，從 1 衰減到 0。 */
  glow: number;
};

/**
 * 活動戰情室的星圖。
 *
 * 每位參與者是一個圓形節點，半徑由分數決定。**每一對互相持有卡片的人
 * 之間都有一條線**——一次 Scan 會替雙方各建立一筆 Collection，所以線就是
 * 「這兩個人交換過卡片」，全部都畫出來，那張網才是完整的。
 *
 * **靜止時不流動。** 沒有事情發生的時候，線是靜態的實線；只有剛發生的
 * 相遇才會讓那條線跑起虛線流動並射出封包，解鎖成就則是金色的漣漪。
 * 一直在跑的光點會讓畫面永遠像有事在發生，真正發生時反而看不出來。
 *
 * 用 canvas 而不是 DOM：七十個節點加上數百條連線，每一幀都要重畫發光
 * 與封包位置。用 SVG 的話那是數千個節點的屬性更新，主執行緒會被吃光。
 *
 * 資料透過 ref 傳進動畫迴圈而不是 deps：輪詢每 2.5 秒換一次資料，若讓
 * 迴圈跟著重建，動畫會在每次輪詢時斷一下。
 */
export function WarRoomScene({
  nodes,
  edges,
  freshEdges,
  achievements,
  maxAchievementPoints,
}: {
  nodes: SceneNode[];
  edges: SceneEdge[];
  /** 這一輪才出現的相遇。 */
  freshEdges: Set<string>;
  /** 這一輪剛解鎖的成就。每一筆只演一次。 */
  achievements: AchievementBurst[];
  /** 這場活動裡最高的成就分值，用來換算等級。 */
  maxAchievementPoints: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /*
    使用者的視角。放在 ref 而不是 state：它每一幀都被繪製迴圈讀取，
    拖曳時每次移動都 setState 會讓整個元件重畫，畫面反而變頓。
    只有右下角那個百分比需要 React 知道，所以另外開一個輕量的 state。
  */
  const view = useRef({ zoom: 1, panX: 0, panY: 0 });
  const [zoomLabel, setZoomLabel] = useState(1);

  const onViewChange = useCallback((z: number) => setZoomLabel(z), []);

  const resetView = useCallback(() => {
    view.current = { zoom: 1, panX: 0, panY: 0 };
    setZoomLabel(1);
  }, []);

  /** 按鈕用的縮放。以畫面中心為基準，而不是游標。 */
  const zoomBy = useCallback((factor: number) => {
    const v = view.current;
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.zoom * factor));
    if (next === v.zoom) return;
    const box = canvasRef.current?.getBoundingClientRect();
    if (box) {
      const cx = box.width / 2;
      const cy = box.height / 2;
      // 維持畫面中心那一點不動，與滾輪縮放同一套算法。
      v.panX = cx - ((cx - v.panX) / v.zoom) * next;
      v.panY = cy - ((cy - v.panY) / v.zoom) * next;
    }
    v.zoom = next;
    setZoomLabel(next);
  }, []);
  const dataRef = useRef({
    nodes,
    edges,
    freshEdges,
    achievements,
    maxAchievementPoints,
  });
  dataRef.current = {
    nodes,
    edges,
    freshEdges,
    achievements,
    maxAchievementPoints,
  };

  // 已經演過漣漪的 id。沒有這個，同一筆相遇會在每一輪輪詢重新炸一次。
  const playedRef = useRef({ edges: new Set<string>(), nodes: new Set<string>() });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const box = canvas!.getBoundingClientRect();
      width = box.width;
      height = box.height;
      canvas!.width = Math.max(1, Math.round(width * dpr));
      canvas!.height = Math.max(1, Math.round(height * dpr));
      // 等比縮放並置中，兩邊留白而不是把場景拉變形。
      scale = Math.min(width / SCENE_W, height / SCENE_H);
      offsetX = (width - SCENE_W * scale) / 2;
      offsetY = (height - SCENE_H * scale) / 2;
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    /*
      以游標為中心縮放。

      單純把 zoom 乘上去會以畫布左上角為中心，於是想看的那一叢會在放大
      的過程中被推出畫面。這裡先把游標下的場景座標算出來，縮放後再反推
      平移量，讓那一點固定不動——這才是「往那裡放大」該有的手感。
    */
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const box = canvas!.getBoundingClientRect();
      const sx = e.clientX - box.left;
      const sy = e.clientY - box.top;
      const v = view.current;
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, v.zoom * Math.exp(-e.deltaY * 0.0015)),
      );
      if (next === v.zoom) return;
      // 游標下的場景座標，縮放前後必須一致。
      const px = (sx - offsetX - v.panX) / (scale * v.zoom);
      const py = (sy - offsetY - v.panY) / (scale * v.zoom);
      v.panX = sx - offsetX - px * scale * next;
      v.panY = sy - offsetY - py * scale * next;
      v.zoom = next;
      onViewChange(next);
    }

    let panning: { x: number; y: number; panX: number; panY: number } | null =
      null;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      panning = {
        x: e.clientX,
        y: e.clientY,
        panX: view.current.panX,
        panY: view.current.panY,
      };
      canvas!.setPointerCapture(e.pointerId);
      canvas!.style.cursor = "grabbing";
    }
    function onPointerMove(e: PointerEvent) {
      if (!panning) return;
      view.current.panX = panning.panX + (e.clientX - panning.x);
      view.current.panY = panning.panY + (e.clientY - panning.y);
    }
    function onPointerUp() {
      panning = null;
      canvas!.style.cursor = "grab";
    }
    function onDoubleClick() {
      resetView();
    }

    canvas.style.cursor = "grab";
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("dblclick", onDoubleClick);

    /* 漂浮的數位塵。純氛圍，不承載任何資訊。 */
    const dust = Array.from({ length: 44 }, () => ({
      x: Math.random() * SCENE_W,
      y: Math.random() * SCENE_H,
      v: 6 + Math.random() * 16,
      a: 0.08 + Math.random() * 0.26,
      r: 0.6 + Math.random() * 1.4,
    }));

    let placed: Placed[] = [];
    let links: Link[] = [];
    let placedById = new Map<string, Placed>();
    let sweep = 0;
    let dashOffset = 0;
    let raf = 0;
    let last = performance.now();

    /*
      重建節點與連線。只在資料真的換了才做，不是每一幀。

      判斷依據是兩個陣列的**物件identity**，不是內容的雜湊：輪詢每 2.5 秒
      才換一次資料，中間會經過一百多幀，而拼一個含七十個 id 的字串再比對
      是每秒數千次的無謂字串運算。新的快照必然是新的陣列，比對 identity
      就夠，而且是常數時間。
    */
    let lastNodes: SceneNode[] | null = null;
    let lastEdges: SceneEdge[] | null = null;
    function rebuild() {
      const {
        nodes: ns,
        edges: es,
        freshEdges: fe,
        achievements: acs,
        maxAchievementPoints: maxPoints,
      } = dataRef.current;
      const played = playedRef.current;

      if (ns !== lastNodes || es !== lastEdges) {
        lastNodes = ns;
        lastEdges = es;
        const maxScore = Math.max(1, ...ns.map((n) => n.score));
        const previous = placedById;
        placed = ns.map((node, i) => {
          const spot = ringPosition(ns.length, i);
          const t = node.score / maxScore;
          const old = previous.get(node.id);
          return {
            node,
            x: spot.x,
            y: spot.y,
            /*
              分數決定半徑，用相對比例而不是絕對分數——開場時全場都是
              零分，一小時後最高分可能兩百；固定係數會讓前者全部縮成
              一點、後者全部撞上限。以當下最高分為基準，對比才一直看得出來。
            */
            r: NODE_MIN_R + t * (NODE_MAX_R - NODE_MIN_R),
            color: cardColorByKey(node.cardColor).accent,
            ripple: old?.ripple ?? 0,
            rippleColor: old?.rippleColor ?? NEON,
            burst: old?.burst ?? null,
          };
        });
        placedById = new Map(placed.map((p) => [p.node.id, p]));

        /*
          每一組相遇都畫一條線，沒有例外。

          一次 Scan 會替雙方各建立一筆 Collection，所以一條線就代表
          「這兩個人手上有彼此的卡片」。之前只有最近的十幾條看得見、
          其餘壓到幾乎透明，等於把大部分的關係藏起來——而那張網本身
          就是這面畫面要講的事。
        */
        links = es
          .map((edge) => {
            const a = placedById.get(edge.scannerId);
            const b = placedById.get(edge.scannedId);
            if (!a || !b) return null;
            const pts = [
              { x: a.x, y: a.y },
              { x: b.x, y: b.y },
            ];
            const total = Math.hypot(b.x - a.x, b.y - a.y);
            return {
              id: edge.id,
              a,
              b,
              pts,
              lens: [0, total],
              total,
              glow: 0,
              packets: [] as Packet[],
            } satisfies Link;
          })
          .filter((l): l is Link => l !== null);
      }

      // 新的相遇：兩端炸開漣漪，並朝那條線灌一串高能封包。
      for (const edge of dataRef.current.edges) {
        if (!fe.has(edge.id) || played.edges.has(edge.id)) continue;
        played.edges.add(edge.id);
        const link = links.find((l) => l.id === edge.id);
        if (link) {
          link.glow = 1;
          for (let i = 1; i <= 7; i++) {
            link.packets.push({ t: -i * 0.05, speed: 0.6 });
          }
        }
        for (const id of [edge.scannerId, edge.scannedId]) {
          const p = placedById.get(id);
          if (p) {
            p.ripple = 1;
            p.rippleColor = NEON;
          }
        }
      }

      /*
        解鎖成就：金色的爆發，等級愈高愈盛大，並在節點上打出成就名稱。

        與相遇分開顏色與形狀——投影在牆上時，「有人又交換了卡片」和
        「有人破了一個成就」是兩件不同份量的事，看的人要能不假思索地分開。
      */
      for (const a of acs) {
        if (played.nodes.has(a.id)) continue;
        played.nodes.add(a.id);
        const p = placedById.get(a.participantId);
        if (!p) continue;
        const level = achievementLevel(a.points, maxPoints);
        p.burst = {
          t: 0,
          life: BURST_BASE_S + level * 0.6,
          level,
          title: a.title,
          points: a.points,
        };
      }
    }

    /** 正 n 邊形的路徑。工作人員的六角形用它畫。 */
    function polygonPath(x: number, y: number, radius: number, sides: number) {
      ctx!.beginPath();
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius;
        if (i === 0) ctx!.moveTo(px, py);
        else ctx!.lineTo(px, py);
      }
      ctx!.closePath();
    }

    /**
     * 一個參與者＝一個圓；工作人員＝六角形加一圈外環。
     *
     * 用形狀而不是顏色區分身分——顏色已經被卡片底色用掉了，再疊一種
     * 語意上去，投影時誰也分不出哪個顏色代表什麼。形狀在餘光裡也認得出。
     */
    function drawNode(p: Placed) {
      const active = p.ripple > 0 || p.burst !== null;
      const staff = p.node.role === "STAFF";
      ctx!.save();
      ctx!.shadowColor = p.color;
      ctx!.shadowBlur = active ? 24 : 7;
      ctx!.fillStyle = rgba(p.color, active ? 0.38 : 0.16);
      ctx!.strokeStyle = p.color;
      ctx!.lineWidth = active ? 2.4 : 1.5;
      if (staff) polygonPath(p.x, p.y, p.r + 2, 6);
      else {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      }
      ctx!.fill();
      ctx!.stroke();
      if (staff) {
        polygonPath(p.x, p.y, p.r + 7, 6);
        ctx!.strokeStyle = rgba(p.color, 0.4);
        ctx!.lineWidth = 1;
        ctx!.stroke();
        // 中心一顆小菱形，遠看就是「這個是幹部」。
        ctx!.beginPath();
        polygonPath(p.x, p.y, p.r * 0.42, 4);
        ctx!.fillStyle = rgba(p.color, 0.85);
        ctx!.fill();
      }
      ctx!.restore();
    }

    /**
     * 成就解鎖的爆發。
     *
     * 等級決定環的數量、火花的密度與停留時間。三個環一起從內往外推，
     * 彼此錯開相位，看起來才是「炸開」而不是一個圈在放大。
     */
    function drawBurst(p: Placed, burst: NonNullable<Placed["burst"]>) {
      const progress = Math.min(1, burst.t / burst.life);
      const fade = 1 - progress;
      const { level } = burst;

      ctx!.save();
      // 多重環，每一環延後 0.16 個進度出發。
      for (let i = 0; i < level; i++) {
        const ringProgress = Math.min(1, Math.max(0, progress * 1.5 - i * 0.16));
        if (ringProgress <= 0) continue;
        ctx!.strokeStyle = rgba(MOON, (1 - ringProgress) * 0.85);
        ctx!.lineWidth = 1 + (1 - ringProgress) * 2.5;
        ctx!.shadowColor = MOON;
        ctx!.shadowBlur = 20;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r * (1 + ringProgress * (2.4 + level * 0.9)), 0, Math.PI * 2);
        ctx!.stroke();
      }

      // 放射狀火花。等級愈高愈多、飛得愈遠。
      const sparks = 6 * level;
      const reach = p.r * (2 + level * 1.4) * Math.min(1, progress * 1.8);
      ctx!.strokeStyle = rgba(MOON, fade * 0.9);
      ctx!.lineWidth = 1.5;
      ctx!.shadowColor = MOON;
      ctx!.shadowBlur = 12;
      for (let i = 0; i < sparks; i++) {
        const angle = (i / sparks) * Math.PI * 2 + burst.t * 0.6;
        const inner = p.r + reach * 0.55;
        ctx!.beginPath();
        ctx!.moveTo(p.x + Math.cos(angle) * inner, p.y + Math.sin(angle) * inner);
        ctx!.lineTo(p.x + Math.cos(angle) * (inner + 10), p.y + Math.sin(angle) * (inner + 10));
        ctx!.stroke();
      }

      /*
        成就名稱往上浮並淡出。

        這是整個特效唯一帶資訊的部分——右欄的事件牆會捲走，但正在看
        星圖的人不會同時盯著右欄。突破的是什麼，要在事發的那個點上說。
      */
      const rise = 26 + progress * 34;
      ctx!.globalAlpha = Math.min(1, fade * 2.2);
      ctx!.textAlign = "center";
      ctx!.shadowColor = MOON;
      ctx!.shadowBlur = 14;
      ctx!.fillStyle = MOON;
      ctx!.font = `bold ${13 + level * 2}px "Microsoft JhengHei", "PingFang TC", sans-serif`;
      ctx!.fillText(burst.title, p.x, p.y - p.r - rise);
      ctx!.font = '11px Consolas, monospace';
      ctx!.fillText(`+${burst.points}`, p.x, p.y - p.r - rise + 15);
      ctx!.restore();
    }

    function pathPoint(link: Link, t: number) {
      const d = (((t % 1) + 1) % 1) * link.total;
      let i = 1;
      while (i < link.lens.length - 1 && link.lens[i] < d) i++;
      const p0 = link.pts[i - 1];
      const p1 = link.pts[i];
      const seg = (d - link.lens[i - 1]) / (link.lens[i] - link.lens[i - 1] || 1);
      return { x: p0.x + (p1.x - p0.x) * seg, y: p0.y + (p1.y - p0.y) * seg };
    }

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      rebuild();

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      ctx!.save();
      /*
        兩層變換疊在一起：外層是把 1280×860 的場景等比塞進畫布並置中
        （resize 算出來的），內層是使用者自己的縮放與平移。分開之後，
        視窗大小改變不會把使用者拉到的視角弄丟。
      */
      ctx!.translate(offsetX + view.current.panX, offsetY + view.current.panY);
      ctx!.scale(scale * view.current.zoom, scale * view.current.zoom);

      // 地面的透視格線
      ctx!.save();
      ctx!.strokeStyle = "rgba(43,232,216,.05)";
      ctx!.lineWidth = 1;
      // 從中心放射的分隔線，讓同心圈讀起來像一面雷達而不是靶紙。
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        ctx!.beginPath();
        ctx!.moveTo(CX, CY);
        ctx!.lineTo(CX + Math.cos(angle) * 430, CY + Math.sin(angle) * 430);
        ctx!.stroke();
      }
      for (let r = 1; r <= 5; r++) {
        ctx!.beginPath();
        ctx!.arc(CX, CY, r * 82, 0, Math.PI * 2);
        ctx!.stroke();
      }
      ctx!.restore();

      if (!reduceMotion) {
        for (const p of dust) {
          p.y -= p.v * dt;
          if (p.y < 40) {
            p.y = SCENE_H - 10;
            p.x = Math.random() * SCENE_W;
          }
          ctx!.fillStyle = rgba(NEON, p.a);
          ctx!.fillRect(p.x, p.y, p.r, p.r);
        }

        // 中央的雷達掃描。整場的心跳，證明畫面是活的而不是凍住的截圖。
        sweep += dt * 0.55;
        ctx!.save();
        ctx!.translate(CX, CY);
        ctx!.rotate(sweep);
        const cone = ctx!.createLinearGradient(0, 0, 460, 0);
        cone.addColorStop(0, rgba(NEON, 0));
        cone.addColorStop(1, rgba(NEON, 0.1));
        ctx!.fillStyle = cone;
        ctx!.beginPath();
        ctx!.moveTo(0, 0);
        ctx!.arc(0, 0, 460, -0.42, 0);
        ctx!.closePath();
        ctx!.fill();
        ctx!.restore();
      }

      // 連線先畫，節點後畫——否則線會蓋在圓上。
      dashOffset -= dt * 26;
      for (const link of links) {
        if (link.glow > 0) link.glow = Math.max(0, link.glow - dt / RIPPLE_S);
        const hot = link.glow > 0;
        const color = hot ? FLARE : NEON;
        ctx!.save();
        /*
          靜止的線是實線，不跑虛線流動。

          會爬的虛線讓畫面永遠像有事在發生，於是真正有事發生時反而
          看不出來。安靜的時候就該是安靜的——那條線只是在說「這兩個
          人交換過卡片」，不是在說「現在正在交換」。
        */
        if (hot) {
          ctx!.setLineDash([7, 11]);
          ctx!.lineDashOffset = dashOffset * 2.4;
          ctx!.shadowColor = color;
          ctx!.shadowBlur = 10;
        }
        ctx!.strokeStyle = rgba(color, hot ? 0.25 + link.glow * 0.6 : 0.2);
        ctx!.lineWidth = hot ? 1.8 : 1;
        ctx!.beginPath();
        ctx!.moveTo(link.pts[0].x, link.pts[0].y);
        for (const p of link.pts) ctx!.lineTo(p.x, p.y);
        ctx!.stroke();
        ctx!.restore();

        if (reduceMotion) continue;

        for (let i = link.packets.length - 1; i >= 0; i--) {
          const packet = link.packets[i];
          packet.t += dt * packet.speed;
          // 用過即丟。沒有常駐的封包，安靜時線上就什麼都不跑。
          if (packet.t > 1.05) {
            link.packets.splice(i, 1);
            continue;
          }
          if (packet.t < 0) continue;
          const head = pathPoint(link, packet.t);
          const tail = pathPoint(link, packet.t - 0.045);
          ctx!.save();
          ctx!.strokeStyle = rgba(FLARE, 0.85);
          ctx!.lineWidth = 2;
          ctx!.shadowColor = FLARE;
          ctx!.shadowBlur = 12;
          ctx!.beginPath();
          ctx!.moveTo(tail.x, tail.y);
          ctx!.lineTo(head.x, head.y);
          ctx!.stroke();
          ctx!.fillStyle = "#ffffff";
          ctx!.beginPath();
          ctx!.arc(head.x, head.y, 2.1, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.restore();
        }
      }

      // 大的先畫，小的後畫——重疊時小的不會被整個蓋掉。
      const ordered = [...placed].sort((m, n) => n.r - m.r);
      for (const p of ordered) {
        if (p.ripple > 0) {
          p.ripple = Math.max(0, p.ripple - dt / RIPPLE_S);
          const progress = 1 - p.ripple;
          ctx!.save();
          ctx!.strokeStyle = rgba(p.rippleColor, p.ripple * 0.85);
          ctx!.lineWidth = 1 + p.ripple * 2;
          ctx!.shadowColor = p.rippleColor;
          ctx!.shadowBlur = 18;
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.r * (1 + progress * 2.4), 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.restore();
        }

        if (p.burst) {
          p.burst.t += dt;
          drawBurst(p, p.burst);
          if (p.burst.t >= p.burst.life) p.burst = null;
        }

        drawNode(p);

        ctx!.save();
        ctx!.font = '12px "Microsoft JhengHei", "PingFang TC", sans-serif';
        ctx!.textAlign = "center";
        ctx!.fillStyle =
          p.ripple > 0 || p.burst ? "#ffffff" : "rgba(170,205,235,.85)";
        ctx!.shadowColor = p.burst ? MOON : p.color;
        ctx!.shadowBlur = p.ripple > 0 || p.burst ? 12 : 5;
        ctx!.fillText(p.node.nickname, p.x, p.y + p.r + 14);
        ctx!.restore();
      }

      ctx!.restore();
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("dblclick", onDoubleClick);
    };
  }, [onViewChange, resetView]);

  return (
    <div className="relative size-full">
      <canvas
        ref={canvasRef}
        className="size-full touch-none"
        role="img"
        aria-label={`參與者連線圖，${nodes.length} 人、${edges.length} 組相遇`}
      />

      {/*
        縮放控制。

        滾輪與拖曳已經夠用，但投影時常常是別人在操作，而「這裡可以放大」
        不會有人主動去試——擺出按鈕才看得見這個功能存在。百分比同時也是
        現在有沒有被拉歪的唯一線索。
      */}
      <div className="absolute right-3 bottom-3 flex items-center gap-1">
        <button
          onClick={() => zoomBy(1 / 1.3)}
          aria-label="縮小"
          className="warroom-panel tap-target size-9 text-lg text-dim transition-colors hover:text-neon"
        >
          −
        </button>
        <button
          onClick={resetView}
          className="warroom-panel px tap-target px-3 text-xs text-dim transition-colors hover:text-neon"
          title="回到完整檢視（畫面上雙擊亦可）"
        >
          {Math.round(zoomLabel * 100)}%
        </button>
        <button
          onClick={() => zoomBy(1.3)}
          aria-label="放大"
          className="warroom-panel tap-target size-9 text-lg text-dim transition-colors hover:text-neon"
        >
          ＋
        </button>
      </div>
    </div>
  );
}
