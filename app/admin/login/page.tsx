"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("帳號或密碼不正確");
        return;
      }
      const data = await res.json().catch(() => null);
      /*
        登入是身分 cookie 從無到有的那一刻，而 App Router 的 Client Cache
        可能還持有「未登入」時的版本。用完整頁面導向，不要 router.push——
        報到流程曾經因為這件事讓人連續送出三次。
      */
      window.location.assign(data?.redirectTo ?? "/admin");
    } catch {
      setError("連線失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5">
      <h1 className="text-xl font-bold">後台登入</h1>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">帳號</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
            required
            className="rounded-sm border border-line bg-void px-3 py-2.5 text-chalk"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">密碼</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="rounded-sm border border-line bg-void px-3 py-2.5 text-chalk"
          />
        </label>

        {error && (
          <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="tap-target rounded-lg bg-neon py-3 font-medium text-void disabled:bg-line"
        >
          {submitting ? "登入中…" : "登入"}
        </button>
      </form>
    </main>
  );
}
