"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EventRow = {
  id: string;
  name: string;
  status: string;
  startsAt: string;
  publicLeaderboard: boolean;
  scanningOpen: boolean;
  archivedAt: string | null;
  purgeAfter: string | null;
  teamCount: number;
  basePoints: number;
  leaderboardTopN: number;
  _count: { participants: number; teams: number; achievements: number };
  hosts: { admin: { id: string; username: string } }[];
};

type HostOption = { id: string; username: string };

const field =
  "rounded-sm border border-line bg-void px-3 py-2 text-sm text-chalk placeholder:text-faint focus:border-neon focus:outline-none";

/*
  預設值取「下一個整點或半點」，而不是此刻。

  活動不會在 14:37 開始。給一個已經對齊的時間，多數情況直接按下去就對了，
  不用先把分鐘改掉——而「早鳥」這類限時成就正是從這個時間起算的。
*/
function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() > 30 ? 60 : 30);
  return d;
}

/** 幾天後的某一個整點。給快捷鍵用。 */
function atHour(daysAhead: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** 把選到的時間唸出來確認。datetime-local 的原生顯示看不出星期幾。 */
function describeDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "時間格式不正確";
  return d.toLocaleString("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** datetime-local 需要 YYYY-MM-DDTHH:mm，且必須是本地時間而非 UTC。 */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function EventOverview({
  initial,
  hostOptions,
}: {
  initial: EventRow[];
  hostOptions: HostOption[];
}) {
  const router = useRouter();
  /*
    直接用 props，不要 useState(initial)。

    useState 的初始值只在第一次渲染取用。router.refresh() 確實會重新執行
    伺服器元件並傳進新的 initial，但 state 不會跟著換——結果是建立、封存、
    刪除、指派主持人全都「成功了但畫面沒變」，使用者只好自己按 F5。
  */
  const events = initial;
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    name: "",
    passcode: "",
    startsAt: toLocalInput(nextHalfHour()),
    teamCount: 10,
    publicLeaderboard: false,
    basePoints: 10,
    leaderboardTopN: 10,
  });

  async function createEvent() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          startsAt: new Date(draft.startsAt).toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "建立失敗");
        return;
      }
      setCreating(false);
      setNotice(`已建立「${draft.name}」，並自動產生註冊碼、分組與成就。`);
      router.refresh();
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setBusy(false);
    }
  }

  /*
    暫停掃描而不封存。

    活動當天的實際流程是「人陸續進場報到 → 主持人說明規則 → 宣布開始」，
    中間那段時間報到必須開著、收集必須關著。封存做不到這件事，它把兩者
    一起關掉。

    沒有二次確認：這是會在活動中來回切換的開關，不是一次性的破壞動作，
    每次都跳確認框只會讓人養成無視它的習慣——而封存那顆確實需要確認。
  */
  async function toggleScanning(e: EventRow) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/events/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scanningOpen: !e.scanningOpen }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("切換掃描狀態失敗");
      return;
    }
    setNotice(
      e.scanningOpen
        ? `已暫停「${e.name}」的收集，報到仍然開著`
        : `已開放「${e.name}」的收集`,
    );
    router.refresh();
  }

  async function toggleArchive(e: EventRow) {
    const archiving = e.status === "ACTIVE";
    if (
      !confirm(
        archiving
          ? `確定要封存「${e.name}」？\n\n` +
              "報到與收集會關閉，短評也不能再修改，但大家仍然看得到已收集的成果。\n" +
              "若是誤按，可以在同一個位置重新開放。"
          : `確定要重新開放「${e.name}」？\n\n` +
              "報到、收集與短評會再次開啟，十四天的保留期限也會一併取消。",
      )
    )
      return;

    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/archive", {
      method: archiving ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: e.id }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(archiving ? "封存失敗" : "重新開放失敗");
      return;
    }
    setNotice(archiving ? `已封存「${e.name}」` : `已重新開放「${e.name}」`);
    router.refresh();
  }

  async function remove(e: EventRow) {
    if (
      !confirm(
        `確定要刪除「${e.name}」？\n\n` +
          "這個動作無法復原，該活動的註冊碼、分組與成就設定都會一併消失。",
      )
    )
      return;

    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/events/${e.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "刪除失敗");
      return;
    }
    setNotice(`已刪除「${e.name}」`);
    router.refresh();
  }

  async function saveHosts(e: EventRow, hostIds: string[]) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/events/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostIds }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("指派失敗");
      return;
    }
    setAssigning(null);
    setNotice(`已更新「${e.name}」的主持人。`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {notice && (
        <p className="rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">{notice}</p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-flare/50 bg-flare/15 px-3 py-2 text-sm text-flare"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {events.map((e) => {
          return (
            <li key={e.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{e.name}</span>
                {e.status === "ACTIVE" ? (
                  <span className="rounded-full bg-neon px-2 py-0.5 text-[10px] text-void">
                    進行中
                  </span>
                ) : (
                  <span className="rounded-full border border-moon px-2 py-0.5 text-[10px] text-moon">
                    已封存
                  </span>
                )}
                {/*
                  掃描被暫停時一定要看得見。這個狀態下報到照常運作，
                  所以「大家都進得來卻掃不了」的回報會先被當成程式壞掉，
                  而不是有人按了這顆按鈕。
                */}
                {e.status === "ACTIVE" && !e.scanningOpen && (
                  <span className="rounded-full border border-flare px-2 py-0.5 text-[10px] text-flare">
                    收集暫停
                  </span>
                )}
                {/* 哪幾場是對外公開的，要在清單上就看得出來。 */}
                {e.publicLeaderboard && (
                  <span className="rounded-full border border-moon px-2 py-0.5 text-[10px] text-moon">
                    排行榜公開
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-dim">
                {e._count.participants} 人・{e._count.teams} 組・
                {e._count.achievements} 項成就・基礎分 {e.basePoints}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                開始 {new Date(e.startsAt).toLocaleString("zh-TW")}
                {e.purgeAfter &&
                  `・保留至 ${new Date(e.purgeAfter).toLocaleDateString("zh-TW")}`}
              </p>
              <p className="mt-0.5 text-xs text-faint">
                主持人：
                {e.hosts.length > 0
                  ? e.hosts.map((h) => h.admin.username).join("、")
                  : "未指派"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {/*
                  用連結而不是按鈕。活動現在寫在網址裡，所以這一步就是單純的
                  導覽——上一頁能還原、可以在新分頁開、也能把網址傳給另一位主持人。
                */}
                <Link
                  href={`/admin/events/${e.id}`}
                  className="tap-target rounded-lg border border-neon px-3 py-1.5 text-xs font-bold text-neon transition-colors hover:bg-neon hover:text-void"
                >
                  進入後台
                </Link>
                <button
                  onClick={() => setAssigning(assigning === e.id ? null : e.id)}
                  className="tap-target rounded-lg border border-line px-3 py-1.5 text-xs transition-colors hover:border-neon hover:bg-neon/10 hover:text-neon"
                >
                  指派主持人
                </button>
                {/* 封存的活動沒有「暫停收集」可言，那顆按鈕會誤導。 */}
                {e.status === "ACTIVE" && (
                  <button
                    onClick={() => toggleScanning(e)}
                    disabled={busy}
                    className={`tap-target rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
                      e.scanningOpen
                        ? "border-line hover:border-flare hover:bg-flare/10 hover:text-flare"
                        : "border-flare text-flare hover:bg-flare/10"
                    }`}
                  >
                    {e.scanningOpen ? "暫停收集" : "開放收集"}
                  </button>
                )}
                <button
                  onClick={() => toggleArchive(e)}
                  disabled={busy}
                  className="tap-target rounded-lg border border-moon/60 px-3 py-1.5 text-xs text-moon transition-colors hover:bg-moon/10 disabled:opacity-50"
                >
                  {e.status === "ACTIVE" ? "封存" : "重新開放"}
                </button>
                {/*
                  有參與者的活動不提供刪除按鈕。後端也會擋，但在畫面上就
                  不給這顆按鈕更好——避免有人按下去、看到錯誤、才開始思考
                  自己剛剛差點做了什麼。
                */}
                {e._count.participants === 0 ? (
                  <button
                    onClick={() => remove(e)}
                    disabled={busy}
                    className="tap-target rounded-lg border border-flare/60 px-3 py-1.5 text-xs text-flare transition-colors hover:bg-flare/10 disabled:opacity-50"
                  >
                    刪除
                  </button>
                ) : (
                  <span className="self-center text-[11px] text-faint">
                    有參與者，需先封存並清除個資才能刪除
                  </span>
                )}
              </div>

              {assigning === e.id && (
                <HostPicker
                  options={hostOptions}
                  selected={e.hosts.map((h) => h.admin.id)}
                  busy={busy}
                  onSave={(ids) => saveHosts(e, ids)}
                  onCancel={() => setAssigning(null)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {creating ? (
        <div className="flex flex-col gap-3 rounded-xl border border-neon/40 bg-neon/5 p-4">
          <h3 className="text-sm font-bold">建立新活動</h3>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">活動名稱</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="例如：NCUIM 2027 新生歡迎會"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">通關碼</span>
            <input
              value={draft.passcode}
              onChange={(e) => setDraft({ ...draft, passcode: e.target.value })}
              placeholder="現場公布，不要與上一場相同"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">開始時間</span>
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
              /*
                色彩配置告訴瀏覽器這是深色介面，原生的日曆圖示與彈出面板
                才會跟著變深色。少了它，那個圖示在深色底上幾乎看不見。
              */
              style={{ colorScheme: "dark" }}
              className={field}
            />

            {/*
              快捷鍵。活動的開始時間幾乎都是「今天等一下」或「明天下午」，
              用原生選擇器要點四五次才選得到同一個值。
            */}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[
                { label: "現在", at: () => new Date() },
                { label: "今天 14:00", at: () => atHour(0, 14) },
                { label: "明天 14:00", at: () => atHour(1, 14) },
                { label: "明天 09:00", at: () => atHour(1, 9) },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setDraft({ ...draft, startsAt: toLocalInput(preset.at()) })
                  }
                  className="tap-target rounded-sm border border-line px-2.5 text-xs text-dim transition-colors hover:border-neon hover:text-neon"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-neon">{describeDate(draft.startsAt)}</span>
            <span className="text-xs text-faint">
              「早鳥」這類限時成就是從這個時間起算的。
            </span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">組數</span>
              <input
                type="number"
                min={0}
                value={draft.teamCount}
                onChange={(e) =>
                  setDraft({ ...draft, teamCount: Number(e.target.value) })
                }
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">基礎分</span>
              <input
                type="number"
                min={0}
                value={draft.basePoints}
                onChange={(e) =>
                  setDraft({ ...draft, basePoints: Number(e.target.value) })
                }
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">排行名次</span>
              <input
                type="number"
                min={1}
                value={draft.leaderboardTopN}
                onChange={(e) =>
                  setDraft({ ...draft, leaderboardTopN: Number(e.target.value) })
                }
                className={field}
              />
            </label>
          </div>

          {/*
            公開排行榜。預設關閉，而且把後果直接寫在旁邊——這個開關的
            影響範圍是「全世界」，不該只用一個沒有說明的核取方塊帶過。
          */}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-4 py-3">
            <input
              type="checkbox"
              checked={draft.publicLeaderboard}
              onChange={(e) =>
                setDraft({ ...draft, publicLeaderboard: e.target.checked })
              }
              className="mt-0.5 size-5 shrink-0 accent-neon"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">開放站外讀取排行榜</span>
              <span className="text-xs text-faint">
                打開後任何人都能讀到這場的名次、暱稱與分數（不含真實姓名與
                信箱），給系網或現場大螢幕嵌入用。封存後自動停止，
                之後也可以隨時關掉。
              </span>
            </span>
          </label>

          <span className="text-xs text-faint">
            組數填 0 代表不分組。建立後會自動產生一般與工作人員兩組註冊碼、
            分組與預設成就。
          </span>

          <div className="flex gap-2">
            <button
              onClick={createEvent}
              disabled={busy || !draft.name.trim() || !draft.passcode.trim()}
              className="tap-target flex-1 rounded-sm bg-neon py-2.5 text-sm font-bold text-void transition-colors hover:bg-neon/85 disabled:bg-line disabled:text-faint"
            >
              {busy ? "建立中…" : "建立活動"}
            </button>
            <button
              onClick={() => setCreating(false)}
              disabled={busy}
              className="tap-target rounded-sm border border-line px-4 text-sm text-dim"
            >
              取消
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="tap-target rounded-lg border border-neon py-2.5 text-sm font-bold text-neon transition-colors hover:bg-neon hover:text-void"
        >
          建立新活動
        </button>
      )}
    </div>
  );
}

function HostPicker({
  options,
  selected,
  busy,
  onSave,
  onCancel,
}: {
  options: HostOption[];
  selected: string[];
  busy: boolean;
  onSave: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const [ids, setIds] = useState<string[]>(selected);

  if (options.length === 0) {
    return (
      <p className="mt-3 rounded-sm border border-moon/50 bg-moon/10 px-3 py-2 text-xs text-moon">
        目前沒有主持人帳號。請先到後台的「管理員帳號」新增一個身分為主持人的帳號。
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-sm border border-line p-3">
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ids.includes(o.id)}
            onChange={(e) =>
              setIds((cur) =>
                e.target.checked ? [...cur, o.id] : cur.filter((x) => x !== o.id),
              )
            }
            className="size-4"
          />
          <span>{o.username}</span>
        </label>
      ))}
      <div className="flex gap-2">
        <button
          onClick={() => onSave(ids)}
          disabled={busy}
          className="tap-target rounded-sm bg-neon px-3 py-1.5 text-xs font-bold text-void disabled:bg-line"
        >
          儲存指派
        </button>
        <button
          onClick={onCancel}
          className="tap-target rounded-sm border border-line px-3 py-1.5 text-xs text-dim"
        >
          取消
        </button>
      </div>
    </div>
  );
}
