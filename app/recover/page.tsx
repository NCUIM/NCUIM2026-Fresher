"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function RecoverPage() {
  // useSearchParams 需要 Suspense 邊界，否則整頁會被強制轉為動態渲染。
  return (
    <Suspense>
      <RecoverForm />
    </Suspense>
  );
}

function RecoverForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("error") === "expired";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "無法送出，請再試一次");
        return;
      }
      setSent(true);
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-4xl">📮</p>
        <h1 className="text-xl font-black text-neon">信寄出了</h1>
        <p className="text-sm text-dim">
          如果這個信箱有已驗證的報到紀錄，找回連結已經寄過去了。
          連結只能用一次，30 分鐘後失效。
        </p>
        <p className="text-xs text-faint">
          沒收到信？可能是報到時沒填信箱、填錯了，或是沒點過驗證信。
          這種情況請直接找現場工作人員協助。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <header className="flex flex-col gap-1.5">
        <span className="px text-[11px] tracking-[0.22em] text-neon">RECOVER</span>
        <h1 className="text-2xl font-black">找回你的收集成果</h1>
        <p className="text-sm text-dim">
          輸入報到時填的信箱，我們會寄一個連結給你。
        </p>
      </header>

      {expired && (
        <p className="rounded-lg border border-moon/40 bg-moon/10 px-3 py-2.5 text-sm text-moon">
          剛才那個連結已經失效了。找回連結只能使用一次，且 30 分鐘後過期——
          請在下方重新要求一封新的信。
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoCapitalize="none"
          autoComplete="email"
          required
          className="rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
        />

        {error && (
          <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
        >
          {submitting ? "寄送中…" : "寄送找回連結"}
        </button>
      </form>

      <Link
        href="/"
        className="tap-target flex items-center justify-center text-sm text-faint"
      >
        回到首頁
      </Link>
    </main>
  );
}
