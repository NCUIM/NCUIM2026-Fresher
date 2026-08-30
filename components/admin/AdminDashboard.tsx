"use client";

import { useMemo, useState } from "react";
import { iconByKey } from "@/lib/icons";
import { zodiacByKey } from "@/lib/zodiac";
import { ParticipantDetail } from "./ParticipantDetail";
import { Avatar } from "@/components/card/Avatar";

/**
 * Participant 的完整內容，唯一的例外是 sessionToken。
 *
 * sessionToken 是登入憑證，不是資料——把它端到畫面上，它就會留在瀏覽器
 * 快取、截圖與任何側錄的流量裡，而任何拿到它的人都能冒充本人。
 * 需要幫人重新綁定裝置時走 rescue 端點，那裡換發新的並讓舊的失效。
 */
type Participant = {
  id: string;
  nickname: string;
  realName: string | null;
  personalCode: string;
  role: string;
  bio: string | null;
  socialUrl: string | null;
  avatarUrl: string | null;
  icons: string[];
  zodiac: string | null;
  university: string | null;
  email: string | null;
  emailVerified: boolean;
  createdAt: string | Date;
  team: { number: number; name: string | null } | null;
  _count: {
    scansInitiated: number;
    scansReceived: number;
    collections: number;
    impressionsWritten: number;
    impressionsReceived: number;
    achievements: number;
  };
};

type RoleFilter = "all" | "PARTICIPANT" | "STAFF";
type TeamFilter = "all" | "none" | number;

/** dl 的一列。label 與值分開，讓未填的欄位也看得出它存在。 */
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="whitespace-nowrap text-faint">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

/*
  空欄位仍然列出來，而不是整列隱藏。
  「這個人沒填信箱」是工作人員需要知道的事——那代表他之後換裝置就找不回
  自己的成果；整列消失的話，看的人只會以為自己漏看了。
*/
function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-faint">{children}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="px text-sm font-bold text-chalk">{value}</span>
      <span className="text-faint">{label}</span>
    </div>
  );
}

export function AdminDashboard({
  eventId,
  initial,
  eventName,
  archived,
}: {
  eventId: string;
  initial: Participant[];
  eventName: string;
  archived: boolean;
}) {
  const [participants, setParticipants] = useState(initial);
  const [isArchived, setIsArchived] = useState(archived);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [rescue, setRescue] = useState<{ nickname: string; url: string } | null>(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  // 同時只有一位參與者的私人內容被載入，關掉就卸載。
  const [openDetail, setOpenDetail] = useState<string | null>(null);

  // 組別選項取自實際資料，而不是寫死 1–10：組數是後台可調的。
  const teamNumbers = useMemo(
    () =>
      [...new Set(participants.flatMap((p) => (p.team ? [p.team.number] : [])))].sort(
        (a, b) => a - b,
      ),
    [participants],
  );

  /*
    在瀏覽器端過濾。七十人的資料早就整包在手上了，送回伺服器查一趟
    只會多出一次等待——而現場找人時，每一次輸入都要立刻有反應。

    比對範圍涵蓋姓名與個人碼：工作人員手上可能只有其中一項。
  */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return participants.filter((p) => {
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (teamFilter === "none" && p.team) return false;
      if (typeof teamFilter === "number" && p.team?.number !== teamFilter) return false;
      if (!q) return true;
      return [p.nickname, p.realName, p.email, p.personalCode, p.university, p.bio].some(
        (v) => v?.toLowerCase().includes(q),
      );
    });
  }, [participants, query, roleFilter, teamFilter]);

  async function publish() {
    if (!announcement.trim()) return;
    const res = await fetch("/api/admin/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, body: announcement }),
    });
    setNotice(res.ok ? "公告已發布" : "發布失敗");
    if (res.ok) setAnnouncement("");
  }

  async function issueRescue(p: Participant) {
    const res = await fetch(`/api/admin/participants/${p.id}/rescue`, {
      method: "POST",
    });
    if (!res.ok) {
      setNotice("換發失敗");
      return;
    }
    const data = await res.json();
    setRescue({ nickname: data.nickname, url: data.rescueUrl });
  }

  async function moderate(p: Participant) {
    if (!confirm(`確定要清除「${p.nickname}」的頭像、自我介紹與社群連結？`)) return;
    const res = await fetch(`/api/admin/participants/${p.id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearAvatar: true, clearBio: true, clearSocialUrl: true }),
    });
    if (!res.ok) {
      setNotice("處理失敗");
      return;
    }
    setParticipants((list) =>
      list.map((x) =>
        x.id === p.id ? { ...x, avatarUrl: null, bio: null, socialUrl: null } : x,
      ),
    );
    setNotice(`已清除 ${p.nickname} 的違規內容`);
  }

  async function archive() {
    if (
      !confirm(
        `確定要封存「${eventName}」？\n\n` +
          "封存後所有人都無法再報到或收集，但仍可查看已收集的成果。\n" +
          "若是誤按，可以在同一個位置重新開放。",
      )
    )
      return;
    const res = await fetch("/api/admin/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    if (!res.ok) {
      setNotice("封存失敗");
      return;
    }
    const data = await res.json();
    setIsArchived(true);
    setNotice(
      `活動已封存。資料將保留至 ${new Date(data.purgeAfter).toLocaleDateString("zh-TW")}。`,
    );
  }

  /*
    誤觸最可能發生在活動當天，而那時能處理的人不一定會用終端機。
    這顆按鈕的存在就是為了讓復原不必動到資料庫。
  */
  async function reopen() {
    if (
      !confirm(
        `確定要重新開放「${eventName}」？\n\n` +
          "報到與收集會再次開啟，十四天的保留期限也會一併取消。\n" +
          "活動真正結束後記得再封存一次。",
      )
    )
      return;
    const res = await fetch("/api/admin/archive", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    if (!res.ok) {
      setNotice("重新開放失敗");
      return;
    }
    setIsArchived(false);
    setNotice("活動已重新開放，報到與收集恢復運作。");
  }

  return (
    <div className="flex flex-col gap-6">
      {isArchived && (
        <div className="flex flex-col gap-2 rounded-lg bg-neon px-4 py-3 text-void">
          <p className="text-sm">
            這場活動已封存。報到與收集皆已關閉，查看功能維持可用。
          </p>
          {/* 誤按封存的人第一眼就會看到這裡，不必到頁面下方去找。 */}
          <button
            onClick={reopen}
            className="tap-target self-start rounded-sm border border-void/40 px-3 text-sm font-bold transition-colors hover:bg-void/10"
          >
            重新開放活動
          </button>
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">發布公告</h2>
        <textarea
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          rows={3}
          placeholder="例如：集合時間改為下午兩點"
          className="resize-none rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
        />
        <button
          onClick={publish}
          className="tap-target rounded-lg bg-neon py-3 font-medium text-void"
        >
          發布
        </button>
      </section>

      {notice && (
        <p className="rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">
          {notice}
        </p>
      )}

      {rescue && (
        <div className="flex flex-col gap-2 rounded-xl border border-moon/50 bg-moon/10 p-4">
          <p className="text-sm font-medium text-moon">
            {rescue.nickname} 的找回連結
          </p>
          <p className="text-xs break-all text-moon/80">{rescue.url}</p>
          <p className="text-xs text-moon/70">
            請本人在自己的手機上開啟。舊的連結已同時失效。
          </p>
          <button
            onClick={() => setRescue(null)}
            className="tap-target self-start text-sm text-moon underline"
          >
            關閉
          </button>
        </div>
      )}

      {!isArchived && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">結束活動</h2>
          <button
            onClick={archive}
            className="tap-target rounded-lg border border-flare/60 py-3 text-sm font-medium text-flare"
          >
            封存「{eventName}」
          </button>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">參與者</h2>
          <span className="text-xs text-faint">
            {filtered.length === participants.length
              ? `${participants.length} 人`
              : `顯示 ${filtered.length} / ${participants.length} 人`}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="search"
            placeholder="搜尋姓名、暱稱、信箱、個人碼、學校"
            className="rounded-sm border border-line bg-void px-3 py-2.5 text-sm text-chalk placeholder:text-faint focus:border-neon focus:outline-none"
          />

          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "全部"],
                ["PARTICIPANT", "一般"],
                ["STAFF", "工作人員"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setRoleFilter(value)}
                aria-pressed={roleFilter === value}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  roleFilter === value
                    ? "border-neon bg-neon/15 text-neon"
                    : "border-line text-dim hover:border-neon/50"
                }`}
              >
                {label}
              </button>
            ))}

            <select
              value={String(teamFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setTeamFilter(v === "all" || v === "none" ? v : Number(v));
              }}
              className="rounded-sm border border-line bg-void px-2 py-1 text-xs text-chalk focus:border-neon focus:outline-none"
            >
              <option value="all">全部組別</option>
              {teamNumbers.map((n) => (
                <option key={n} value={n}>
                  第 {n} 組
                </option>
              ))}
              <option value="none">未分組</option>
            </select>

            {(query || roleFilter !== "all" || teamFilter !== "all") && (
              <button
                onClick={() => {
                  setQuery("");
                  setRoleFilter("all");
                  setTeamFilter("all");
                }}
                className="tap-target rounded-sm border border-line px-2.5 text-xs text-dim transition-colors hover:border-neon/60 hover:text-chalk"
              >
                清除條件
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-line px-4 py-6 text-center text-sm text-faint">
            沒有符合條件的參與者
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((p) => (
              <li key={p.id} className="rounded-xl border border-line">
                <details>
                  {/* 收合狀態只放認人需要的：頭像、暱稱、姓名、身分、組別。 */}
                  <summary className="flex cursor-pointer items-center gap-2 p-3">
                    <Avatar
                      src={p.avatarUrl}
                      nickname={p.nickname}
                      className="size-8 text-xs"
                    />

                    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{p.nickname}</span>
                      {/*
                        現場核對身分靠的是這個，不是暱稱。
                        報到前就存在的參與者沒有姓名，標示出來讓工作人員知道
                        要當面問，而不是以為系統壞了。
                      */}
                      {p.realName ? (
                        <span className="text-xs text-dim">{p.realName}</span>
                      ) : (
                        <span className="text-xs text-faint">姓名未填</span>
                      )}
                      {p.role === "STAFF" && (
                        <span className="rounded-full bg-moon px-2 py-0.5 text-[10px] text-void">
                          工作人員
                        </span>
                      )}
                      {p.team && (
                        <span className="rounded-full bg-neon px-2 py-0.5 text-[10px] text-void">
                          第 {p.team.number} 組
                        </span>
                      )}
                    </span>
                  </summary>

                  <div className="flex flex-col gap-3 border-t border-line px-3 py-3">
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                      <Field label="個人碼">
                        <span className="px tracking-wider">{p.personalCode}</span>
                      </Field>
                      <Field label="信箱">
                        {p.email ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="break-all">{p.email}</span>
                            <span
                              className={
                                p.emailVerified ? "text-neon" : "text-moon"
                              }
                            >
                              {p.emailVerified ? "已驗證" : "未驗證"}
                            </span>
                          </span>
                        ) : (
                          <Empty>未填。無法自助找回身分</Empty>
                        )}
                      </Field>
                      <Field label="自我介紹">
                        {p.bio ?? <Empty>未填</Empty>}
                      </Field>
                      <Field label="學校">
                        {p.university ?? <Empty>未填</Empty>}
                      </Field>
                      <Field label="星座">
                        {(() => {
                          const z = zodiacByKey(p.zodiac);
                          return z ? `${z.emoji} ${z.label}` : <Empty>未填</Empty>;
                        })()}
                      </Field>
                      <Field label="圖示">
                        {p.icons.length > 0 ? (
                          <span className="flex flex-wrap gap-1.5">
                            {p.icons.map((key) => {
                              const icon = iconByKey(key);
                              return (
                                <span key={key}>
                                  {icon ? `${icon.emoji} ${icon.label}` : key}
                                </span>
                              );
                            })}
                          </span>
                        ) : (
                          <Empty>未選</Empty>
                        )}
                      </Field>
                      <Field label="社群連結">
                        {p.socialUrl ? (
                          <a
                            href={p.socialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-neon underline"
                          >
                            {p.socialUrl}
                          </a>
                        ) : (
                          <Empty>未填</Empty>
                        )}
                      </Field>
                      <Field label="組別">
                        {p.team ? (
                          `第 ${p.team.number} 組${p.team.name ? `・${p.team.name}` : ""}`
                        ) : (
                          <Empty>未分組</Empty>
                        )}
                      </Field>
                      <Field label="報到時間">
                        {new Date(p.createdAt).toLocaleString("zh-TW")}
                      </Field>
                      <Field label="內部 ID">
                        <span className="px break-all text-faint">{p.id}</span>
                      </Field>
                    </dl>

                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate/40 p-2 text-center text-[11px]">
                      <Stat label="主動掃描" value={p._count.scansInitiated} />
                      <Stat label="被掃描" value={p._count.scansReceived} />
                      <Stat label="持有卡片" value={p._count.collections} />
                      <Stat label="已撰寫" value={p._count.impressionsWritten} />
                      <Stat label="被撰寫" value={p._count.impressionsReceived} />
                      <Stat label="成就" value={p._count.achievements} />
                    </div>

                    {/*
                      再收合一層。短評是私人內容（ADR-0003），不該在後台
                      隨手一滑就整片攤在畫面上——要看的人必須有意識地打開它。
                      也因為如此，資料是展開時才去取的。
                    */}
                    <details
                      onToggle={(e) =>
                        setOpenDetail(
                          (e.currentTarget as HTMLDetailsElement).open ? p.id : null,
                        )
                      }
                      className="rounded-lg border border-line px-3 py-2"
                    >
                      <summary className="cursor-pointer text-xs text-dim">
                        查看浮光牆與九宮格
                      </summary>
                      <div className="mt-2">
                        {openDetail === p.id && (
                          <ParticipantDetail participantId={p.id} />
                        )}
                      </div>
                    </details>

                    <div className="flex gap-2">
                      <button
                        onClick={() => issueRescue(p)}
                        className="tap-target rounded-lg border border-line px-3 py-1.5 text-xs transition-colors hover:border-neon hover:bg-neon/10 hover:text-neon"
                      >
                        協助找回身分
                      </button>
                      <button
                        onClick={() => moderate(p)}
                        className="tap-target rounded-lg border border-flare/60 px-3 py-1.5 text-xs text-flare transition-colors hover:bg-flare/20"
                      >
                        清除違規內容
                      </button>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
