"use client";

import { useEffect, useState } from "react";
import {
  ACHIEVEMENT_TYPES,
  TEAM_COLLECT_ALL,
  type achievementSchema,
} from "@/lib/validation";
import type { z } from "zod";

type Achievement = z.infer<typeof achievementSchema> & {
  id: string;
  _count: { earned: number };
};

type Draft = z.infer<typeof achievementSchema>;

/** 每種類型的門檻代表什麼，直接寫在輸入框旁邊——光看「門檻」猜不出單位。 */
const TYPE_INFO: Record<
  (typeof ACHIEVEMENT_TYPES)[number],
  { label: string; thresholdLabel: string; hint: string }
> = {
  SCAN_COUNT: {
    label: "主動掃描人數",
    thresholdLabel: "掃描幾人",
    hint: "自己主動掃描別人的次數。被掃不算。",
  },
  COLLECTED_COUNT: {
    label: "被收集人數",
    thresholdLabel: "被幾人收集",
    hint: "有多少人持有你的卡片。",
  },
  EARLY_SCAN: {
    label: "開場後限時掃描",
    thresholdLabel: "幾分鐘內",
    hint: "活動開始後這段時間內完成第一次掃描。單位是分鐘。",
  },
  SCAN_ROLE: {
    label: "掃描特定身分",
    thresholdLabel: "掃描幾人",
    hint: "掃描到指定身分的人數，需在下方選擇對象身分。",
  },
  TEAM_COLLECT: {
    label: "收集同組隊員",
    thresholdLabel: "收集幾位隊員",
    hint: "填 -1 代表「集齊全隊」，以達成當下的隊伍人數認定。",
  },
};

const EMPTY: Draft = {
  key: "",
  type: "SCAN_COUNT",
  threshold: 5,
  points: 50,
  hidden: false,
  title: "",
  description: "",
  targetRole: null,
};

const field =
  "rounded-sm border border-line bg-void px-3 py-2 text-sm text-chalk placeholder:text-faint focus:border-neon focus:outline-none";

export function AchievementEditor({ eventId }: { eventId: string }) {
  const [list, setList] = useState<Achievement[] | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/achievements?eventId=${eventId}`);
    if (!res.ok) {
      setError("讀取成就清單失敗");
      return;
    }
    const data = await res.json();
    setList(data.achievements);
    setParticipantCount(data.participantCount);
  }

  useEffect(() => {
    void load();
  }, []);

  /*
    代號自動產生。

    它是內部識別字，使用者沒有理由要自己想一個——而先前它是必填、
    又排在門檻與分數下面，結果是「儲存」按鈕看起來沒壞卻按不動，
    跟先前那顆前往按鈕是同一種問題：把系統的需求變成使用者的功課。

    仍然可以手動改，因為同一場活動內不能重複。
  */
  function suggestKey(existing: Achievement[]): string {
    let n = existing.length + 1;
    const taken = new Set(existing.map((a) => a.key));
    while (taken.has(`custom-${n}`)) n += 1;
    return `custom-${n}`;
  }

  function startNew() {
    setDraft({ ...EMPTY, key: suggestKey(list ?? []) });
    setEditingId("new");
    setError(null);
    setNotice(null);
  }

  function startEdit(a: Achievement) {
    setDraft({
      key: a.key,
      type: a.type,
      threshold: a.threshold,
      points: a.points,
      hidden: a.hidden,
      title: a.title,
      description: a.description ?? "",
      targetRole: a.targetRole ?? null,
    });
    setEditingId(a.id);
    setError(null);
    setNotice(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const isNew = editingId === "new";
      const res = await fetch(
        isNew ? "/api/admin/achievements" : `/api/admin/achievements/${editingId}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            eventId,
            description: draft.description?.trim() || null,
            targetRole: draft.type === "SCAN_ROLE" ? draft.targetRole : null,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "儲存失敗");
        return;
      }
      setEditingId(null);
      setNotice(isNew ? "成就已新增" : "成就已更新");
      await load();
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Achievement) {
    if (!confirm(`確定要刪除成就「${a.title}」？`)) return;
    setError(null);
    const res = await fetch(`/api/admin/achievements/${a.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "刪除失敗");
      return;
    }
    setNotice(`已刪除「${a.title}」`);
    await load();
  }

  const info = TYPE_INFO[draft.type];
  // 門檻超過在場人數的成就永遠沒有人拿得到，設定當下就該講。
  const unreachable =
    (draft.type === "SCAN_COUNT" || draft.type === "COLLECTED_COUNT") &&
    participantCount > 0 &&
    draft.threshold > participantCount - 1;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-medium">成就</h2>
        {list && <span className="text-xs text-faint">{list.length} 項</span>}
      </div>

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

      {list === null ? (
        <p className="text-sm text-faint">讀取中…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((a) => (
            <li key={a.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{a.title}</span>
                {a.hidden && (
                  <span className="rounded-full border border-moon px-2 py-0.5 text-[10px] text-moon">
                    隱藏
                  </span>
                )}
                <span className="px text-xs text-neon">{a.points} 分</span>
                <span className="text-xs text-faint">
                  {a._count.earned} 人已達成
                </span>
              </div>
              <p className="mt-1 text-xs text-dim">
                {TYPE_INFO[a.type].label}・門檻{" "}
                {a.threshold === TEAM_COLLECT_ALL ? "全部隊員" : a.threshold}
                {a.targetRole === "STAFF" && "・對象：工作人員"}
              </p>
              {a.description && (
                <p className="mt-0.5 text-xs text-faint">{a.description}</p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => startEdit(a)}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs transition-colors hover:border-neon/50"
                >
                  編輯
                </button>
                <button
                  onClick={() => remove(a)}
                  className="rounded-lg border border-flare/60 px-3 py-1.5 text-xs text-flare transition-colors hover:bg-flare/10"
                >
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editingId === null ? (
        <button
          onClick={startNew}
          className="tap-target rounded-lg border border-neon py-2.5 text-sm font-bold text-neon transition-colors hover:bg-neon hover:text-void"
        >
          新增成就
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-neon/40 bg-neon/5 p-4">
          <h3 className="text-sm font-bold">
            {editingId === "new" ? "新增成就" : "編輯成就"}
          </h3>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">名稱</span>
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="例如：破冰者"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">說明（選填）</span>
            <input
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="例如：主動掃描 5 個人"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">類型</span>
            <select
              value={draft.type}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  type: e.target.value as Draft["type"],
                  targetRole: e.target.value === "SCAN_ROLE" ? "STAFF" : null,
                })
              }
              className={field}
            >
              {ACHIEVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_INFO[t].label}
                </option>
              ))}
            </select>
            <span className="text-xs text-faint">{info.hint}</span>
          </label>

          {draft.type === "SCAN_ROLE" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">對象身分</span>
              <select
                value={draft.targetRole ?? "STAFF"}
                onChange={(e) =>
                  setDraft({ ...draft, targetRole: e.target.value as Draft["targetRole"] })
                }
                className={field}
              >
                <option value="STAFF">工作人員</option>
                <option value="PARTICIPANT">一般參與者</option>
              </select>
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">{info.thresholdLabel}</span>
              <input
                type="number"
                value={draft.threshold}
                onChange={(e) =>
                  setDraft({ ...draft, threshold: Number(e.target.value) })
                }
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-dim">分數</span>
              <input
                type="number"
                min={0}
                value={draft.points}
                onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })}
                className={field}
              />
            </label>
          </div>

          {unreachable && (
            <p className="rounded-sm border border-moon/50 bg-moon/10 px-3 py-2 text-xs text-moon">
              目前活動只有 {participantCount} 人，任何人最多只能掃到{" "}
              {participantCount - 1} 個人。這個門檻可能永遠沒有人達得成。
            </p>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-dim">代號</span>
            <input
              value={draft.key}
              onChange={(e) => setDraft({ ...draft, key: e.target.value })}
              placeholder="例如 scan-5"
              className={`px ${field}`}
            />
            <span className="text-xs text-faint">
              已自動產生，通常不需要更動。小寫英文、數字與連字號，
              同一場活動內不可重複。
            </span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.hidden}
              onChange={(e) => setDraft({ ...draft, hidden: e.target.checked })}
              className="size-4"
            />
            <span>隱藏成就</span>
          </label>
          <span className="-mt-2 text-xs text-faint">
            隱藏成就在達成前只顯示為「隱藏成就」，不透露名稱、條件與進度。
          </span>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="tap-target flex-1 rounded-sm bg-neon py-2.5 text-sm font-bold text-void transition-colors hover:bg-neon/85 disabled:bg-line disabled:text-faint"
            >
              {saving ? "儲存中…" : "儲存"}
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                setError(null);
              }}
              disabled={saving}
              className="tap-target rounded-sm border border-line px-4 text-sm text-dim"
            >
              取消
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-faint">
        修改分數或門檻<strong className="text-dim">不會影響已經達成的人</strong>
        ——達成當下的分值與門檻會被凍結（ADR-0002）。成就一旦公告就是承諾，
        不會事後收回。
      </p>
    </section>
  );
}
