"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Account = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  _count: { sessions: number };
  assignments?: { event: { id: string; name: string } }[];
};

type EventOption = { id: string; name: string; status: string };

const field =
  "rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint";

export function AdminAccounts({
  initial,
  currentId,
  usingDefaultPassword,
  eventOptions,
}: {
  initial: Account[];
  currentId: string;
  usingDefaultPassword: boolean;
  eventOptions: EventOption[];
}) {
  const router = useRouter();
  /*
    直接用 props，不另外放進 state。
    useState(initial) 只在第一次渲染取值，router.refresh() 之後不會更新——
    新增帳號的指派關係就永遠不會出現在清單上。
  */
  const accounts = initial;

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  /*
    預設是主持人，不是總管理員。
    多給的權限沒有人會發現，少給的立刻就會被反應——所以預設值要往低的那邊放。
  */
  const [newRole, setNewRole] = useState<"SUPER" | "HOST">("HOST");
  const [newUserPassword, setNewUserPassword] = useState("");
  /*
    建立時就一併指派。分成兩步的話，中間那個「已建立但沒有任何活動」的狀態
    是會被忘記的——而那個帳號登入後看不到任何東西，對方只會回報「壞掉了」。
  */
  const [newEventIds, setNewEventIds] = useState<string[]>([]);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "修改失敗");
        return;
      }
      setNotice(data.message);
      setCurrentPassword("");
      setNewPassword("");
      // 密碼改完會撤銷所有工作階段，稍後導回登入頁。
      setTimeout(() => router.push("/admin/login"), 2500);
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setBusy(false);
    }
  }

  async function addAdmin() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newUserPassword,
          role: newRole,
          // 總管理員的權限來自 role，不需要指派。
          eventIds: newRole === "HOST" ? newEventIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "新增失敗");
        return;
      }
      setNotice(
        newRole === "HOST" && newEventIds.length > 0
          ? `已新增主持人 ${data.username}，並指派 ${newEventIds.length} 場活動`
          : `已新增管理員 ${data.username}`,
      );
      setNewUsername("");
      setNewUserPassword("");
      setNewEventIds([]);
      // 重新取伺服器資料，指派關係才會一起顯示出來。
      router.refresh();
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setBusy(false);
    }
  }

  async function removeAdmin(a: Account) {
    if (!confirm(`確定要移除管理員「${a.username}」？他所有裝置上的登入會同時失效。`))
      return;
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/accounts/${a.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "移除失敗");
      return;
    }
    setNotice(`已移除 ${data.username}`);
    router.refresh();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-bold">管理員帳號</h2>

      {usingDefaultPassword && (
        <p className="rounded-lg border border-flare/50 bg-flare/10 px-4 py-3 text-sm text-flare">
          你還在使用種子檔的預設密碼。任何看過這個專案的人都知道它，
          活動開始前請務必更換。
        </p>
      )}

      {/* 帳號清單 */}
      <ul className="flex flex-col gap-2">
        {accounts.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-3 rounded-lg border border-line surface px-4 py-3"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="flex flex-wrap items-center gap-2">
                <span className="px font-medium">{a.username}</span>
                {a.role === "SUPER" ? (
                  <span className="rounded-full bg-neon px-2 py-0.5 text-[10px] text-void">
                    總管理員
                  </span>
                ) : (
                  <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-dim">
                    活動主持人
                  </span>
                )}
                {a.id === currentId && (
                  <span className="text-xs text-neon">（你）</span>
                )}
              </span>
              {/* 主持人管得到哪幾場，是這份清單最需要一眼看出的資訊 */}
              {a.role === "HOST" && (
                <span className="text-xs text-dim">
                  {a.assignments && a.assignments.length > 0
                    ? a.assignments.map((x) => x.event.name).join("、")
                    : "未指派任何活動——他登入後看不到東西"}
                </span>
              )}
              <span className="text-xs text-faint">
                {a._count.sessions > 0
                  ? `${a._count.sessions} 個裝置已登入`
                  : "目前沒有登入中的裝置"}
              </span>
            </div>
            {a.id !== currentId && (
              <button
                onClick={() => removeAdmin(a)}
                className="rounded-sm border border-flare/50 px-3 py-1.5 text-xs text-flare"
              >
                移除
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* 改自己的密碼 */}
      <div className="flex flex-col gap-2 rounded-lg border border-line surface p-4">
        <h3 className="text-sm font-bold">修改我的密碼</h3>
        <p className="text-xs text-faint">
          需要輸入目前的密碼。改完之後所有裝置都會登出，包含這一台。
        </p>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="目前的密碼"
          autoComplete="current-password"
          className={field}
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="新密碼（至少 8 個字元）"
          autoComplete="new-password"
          className={field}
        />
        <button
          onClick={changePassword}
          disabled={busy || !currentPassword || newPassword.length < 8}
          className="tap-target rounded-sm border border-neon py-2.5 text-sm font-bold text-neon disabled:border-line disabled:text-faint"
        >
          更新密碼
        </button>
      </div>

      {/* 新增管理員 */}
      <div className="flex flex-col gap-2 rounded-lg border border-line surface p-4">
        <h3 className="text-sm font-bold">新增管理員</h3>
        <p className="text-xs text-faint">
          不開放自行註冊——後台握有全體參與者的個資，只能由現有管理員新增。
        </p>
        <input
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          placeholder="帳號（英數字與 . _ -）"
          autoCapitalize="none"
          autoComplete="off"
          className={field}
        />
        <input
          type="password"
          value={newUserPassword}
          onChange={(e) => setNewUserPassword(e.target.value)}
          placeholder="密碼（至少 8 個字元）"
          autoComplete="new-password"
          className={field}
        />
        <select
          value={newRole}
          onChange={(e) => setNewRole(e.target.value as "SUPER" | "HOST")}
          className={field}
        >
          <option value="HOST">活動主持人（只能管被指派的那一場）</option>
          <option value="SUPER">總管理員（可管所有活動與帳號）</option>
        </select>

        {/*
          選了總管理員時這一區維持在畫面上，只是鎖住。

          整塊隱藏的話版面會跳動，而且看的人不會知道「指派」這個概念存在；
          留著並說明為什麼不能填，比讓它消失更清楚。
        */}
        <fieldset
          disabled={newRole === "SUPER"}
          className={`flex flex-col gap-1.5 rounded-sm border px-3 py-2.5 ${
            newRole === "SUPER"
              ? "border-line/50 opacity-50"
              : "border-line"
          }`}
        >
          <legend className="px-1 text-xs text-dim">指派活動</legend>

          {eventOptions.length === 0 ? (
            <span className="text-xs text-moon">
              目前還沒有任何活動，請先建立活動。
            </span>
          ) : (
            eventOptions.map((e) => (
              <label
                key={e.id}
                className={`flex items-center gap-2 text-sm ${
                  newRole === "SUPER" ? "" : "cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={newRole === "HOST" && newEventIds.includes(e.id)}
                  onChange={(ev) =>
                    setNewEventIds((cur) =>
                      ev.target.checked
                        ? [...cur, e.id]
                        : cur.filter((x) => x !== e.id),
                    )
                  }
                  className="size-4"
                />
                <span className="flex-1 truncate">{e.name}</span>
                {e.status === "ARCHIVED" && (
                  <span className="text-[10px] text-faint">已封存</span>
                )}
              </label>
            ))
          )}
        </fieldset>

        {newRole === "SUPER" ? (
          <span className="-mt-1 text-xs text-faint">
            總管理員本來就能操作所有活動，不需要也不能指派。
          </span>
        ) : (
          eventOptions.length > 0 &&
          newEventIds.length === 0 && (
            /*
              一場都沒選就是個看不到任何東西的帳號。這不是錯誤——之後可以再指派——
              但一定要在按下新增之前就講，否則對方登入後只會回報「壞掉了」。
            */
            <span className="-mt-1 text-xs text-moon">
              沒有選任何活動的話，他登入後看不到任何東西。
            </span>
          )
        )}
        <button
          onClick={addAdmin}
          disabled={busy || newUsername.length < 3 || newUserPassword.length < 8}
          className="tap-target rounded-sm border border-neon py-2.5 text-sm font-bold text-neon disabled:border-line disabled:text-faint"
        >
          新增
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">{notice}</p>
      )}

      <button
        onClick={logout}
        className="tap-target rounded-sm border border-line py-2.5 text-sm text-dim"
      >
        登出
      </button>
    </section>
  );
}
