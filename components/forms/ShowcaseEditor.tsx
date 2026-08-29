"use client";

import { useRef, useState } from "react";
// 從 lib/validation 取值，不從 lib/showcase——後者匯入 Prisma，
// 在 client component 中會把資料庫驅動打包進瀏覽器套件。
import { SHOWCASE_SIZE } from "@/lib/validation";
import { EmptySlot, SlotFace } from "@/components/showcase/SlotFace";

type Candidate = { id: string; nickname: string; avatarUrl: string | null };

/** 拖動中的狀態。from 是來源：某個格子的索引，或候選清單。 */
type Dragging = {
  id: string;
  from: number | "list";
  x: number;
  y: number;
};

/** 超過這個距離才算拖動，否則視為點擊——手指按住時本來就會有微小位移。 */
const DRAG_THRESHOLD = 8;

/**
 * 頭像，沒有就退回暱稱首字。
 *
 * 九宮格是拿來回想「這九個人是誰」的，臉比名字快得多——
 * 而且暱稱在格子裡被截斷後常常認不出來。
 */
function Avatar({
  person,
  className,
}: {
  person: Candidate;
  className: string;
}) {
  if (person.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.avatarUrl}
        alt=""
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-full bg-void text-sm text-faint`}
    >
      {person.nickname.slice(0, 1)}
    </span>
  );
}

export function ShowcaseEditor({
  candidates,
  initialSelected,
}: {
  candidates: Candidate[];
  initialSelected: (string | null)[];
}) {
  /*
    固定長度九格，null 代表留空。

    先前用的是緊密陣列，位置由順序決定，因此無法表達「第五格放一個人、
    其餘留白」這種排法——而那正是拖拉擺放的意義所在。
  */
  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const next: (string | null)[] = Array(SHOWCASE_SIZE).fill(null);
    initialSelected.slice(0, SHOWCASE_SIZE).forEach((id, i) => {
      next[i] = id ?? null;
    });
    return next;
  });

  const [drag, setDrag] = useState<Dragging | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 按下的起點，用來判斷這次是點擊還是拖動。
  const origin = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const used = new Set(slots.filter((s): s is string => s !== null));
  const full = used.size >= SHOWCASE_SIZE;

  function place(id: string, from: number | "list", to: number | "remove") {
    setMessage(null);
    setSlots((current) => {
      const next = [...current];

      if (from !== "list") next[from] = null;
      if (to === "remove") return next;

      const displaced = next[to];
      next[to] = id;

      /*
        目標格原本有人時：從格子拖來就對調，從清單拖來則把原本的人擠掉。
        對調比「擠掉」更符合直覺——使用者想的是「這兩個換位置」。
      */
      if (displaced && displaced !== id && from !== "list") {
        next[from] = displaced;
      }

      // 從清單拖入同一個人時，要清掉他原本所在的格子，避免重複。
      if (from === "list") {
        for (let i = 0; i < next.length; i++) {
          if (i !== to && next[i] === id) next[i] = null;
        }
      }
      return next;
    });
  }

  /** 點擊：清單裡的人放進第一個空格，格子裡的人移除。 */
  function tap(id: string, from: number | "list") {
    if (from !== "list") {
      place(id, from, "remove");
      return;
    }
    if (used.has(id)) {
      const at = slots.indexOf(id);
      place(id, at, "remove");
      return;
    }
    const empty = slots.indexOf(null);
    if (empty === -1) {
      setMessage(`九格都滿了，先移除一個再放`);
      return;
    }
    place(id, "list", empty);
  }

  function onPointerDown(
    e: React.PointerEvent,
    id: string,
    from: number | "list",
  ) {
    // 只理會主要按鍵／單指，右鍵與多指手勢交給瀏覽器。
    if (e.button !== 0) return;
    origin.current = { x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id, from, x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !origin.current) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    if (!origin.current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    origin.current.moved = true;
    setDrag({ ...drag, x: e.clientX, y: e.clientY });
  }

  function onPointerUp(e: React.PointerEvent) {
    const current = drag;
    const start = origin.current;
    setDrag(null);
    origin.current = null;
    if (!current || !start) return;

    // 沒有移動超過門檻就是點擊。
    if (!start.moved) {
      tap(current.id, current.from);
      return;
    }

    /*
      用 elementFromPoint 做落點判定，而不是自己維護每一格的座標。
      九宮格下方的候選清單可以捲動，快取起來的座標會過期；
      浮動預覽設了 pointer-events: none，所以不會擋到判定。
    */
    const target = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-slot]");

    if (!target) {
      // 丟到格子外面＝從九宮格移除。從清單拖出去的則什麼也不做。
      if (current.from !== "list") place(current.id, current.from, "remove");
      return;
    }

    const to = Number((target as HTMLElement).dataset.slot);
    if (Number.isNaN(to)) return;
    place(current.id, current.from, to);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/showcase", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: slots }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }
      setMessage("已儲存");
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setSaving(false);
    }
  }

  const dragged = drag ? byId.get(drag.id) : null;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-faint">
        拖曳卡片擺到想要的位置，也可以直接點選。空格可以留著。
      </p>

      <div className="grid grid-cols-3 gap-2">
        {slots.map((id, i) => {
          const person = id ? byId.get(id) : null;
          const isDragging = drag?.from === i;
          return (
            <div
              key={i}
              data-slot={i}
              className={`grid aspect-square place-items-center rounded-lg border p-1 transition-colors ${
                person
                  ? "border-neon bg-slate"
                  : "border-dashed border-line"
              } ${isDragging ? "opacity-30" : ""}`}
            >
              {person ? (
                <div
                  onPointerDown={(e) => onPointerDown(e, person.id, i)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  // touch-action:none 讓瀏覽器不要把這個手勢當成捲動搶走。
                  style={{ touchAction: "none" }}
                  className="w-full cursor-grab active:cursor-grabbing"
                >
                  <SlotFace
                    nickname={person.nickname}
                    avatarUrl={person.avatarUrl}
                  />
                </div>
              ) : (
                <EmptySlot index={i} />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-center justify-between text-sm font-bold">
          <span>從收集到的人裡挑選</span>
          <span className={`px text-xs ${full ? "text-moon" : "text-faint"}`}>
            {used.size}/{SHOWCASE_SIZE}
          </span>
        </p>

        {candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-8 text-center text-sm text-faint">
            還沒有收集到任何人。
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {candidates.map((c) => {
              const picked = used.has(c.id);
              return (
                <li key={c.id}>
                  <div
                    onPointerDown={(e) => onPointerDown(e, c.id, "list")}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    style={{ touchAction: "none" }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={picked}
                    onKeyDown={(e) => {
                      // 鍵盤使用者拖不了，但點選那條路要留著。
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        tap(c.id, "list");
                      }
                    }}
                    className={`tap-target flex w-full cursor-grab items-center gap-3 rounded-lg border px-3 py-2.5 text-left active:cursor-grabbing ${
                      picked
                        ? "border-neon bg-neon/10 text-neon"
                        : "border-line text-chalk"
                    }`}
                  >
                    <Avatar person={c} className="size-8" />
                    <span className="flex-1 truncate">{c.nickname}</span>
                    <span className="px text-sm">{picked ? "✓" : "＋"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {message && (
        <p className="rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">{message}</p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="tap-target glow-neon sticky bottom-[var(--safe-bottom)] rounded-sm bg-neon py-3 font-bold text-void transition-colors hover:bg-neon/85 disabled:bg-line disabled:text-faint disabled:shadow-none"
      >
        {saving ? "儲存中…" : "儲存九宮格"}
      </button>

      {/*
        跟著指標移動的預覽。pointer-events:none 是必要的——
        否則 elementFromPoint 會打到這張預覽而不是底下的格子，落點永遠判定失敗。
      */}
      {dragged && drag && (
        <div
          className="pointer-events-none fixed z-50 flex flex-col items-center gap-1 rounded-lg border border-neon bg-slate p-2 opacity-90 shadow-lg"
          style={{
            left: drag.x,
            top: drag.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="w-[72px]">
            <SlotFace
              nickname={dragged.nickname}
              avatarUrl={dragged.avatarUrl}
            />
          </div>
        </div>
      )}
    </div>
  );
}
