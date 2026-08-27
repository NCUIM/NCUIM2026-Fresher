"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Account = {
  id: string;
  username: string;
  createdAt: string;
  _count: { sessions: number };
};

const field =
  "rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint";

export function AdminAccounts({
  initial,
  currentId,
  usingDefaultPassword,
}: {
  initial: Account[];
  currentId: string;
  usingDefaultPassword: boolean;
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initial);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");

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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "新增失敗");
        return;
      }
      setAccounts((list) => [...list, { ...data, _count: { sessions: 0 } }]);
      setNotice(`已新增管理員 ${data.username}`);
      setNewUsername("");
      setNewUserPassword("");
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
    setAccounts((list) => list.filter((x) => x.id !== a.id));
    setNotice(`已移除 ${data.username}`);
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
              <span className="px font-medium">
                {a.username}
                {a.id === currentId && (
                  <span className="ml-2 text-xs text-neon">（你）</span>
                )}
              </span>
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
