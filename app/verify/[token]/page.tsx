import Link from "next/link";
import { consumeToken, markEmailVerified } from "@/lib/recovery";

export const dynamic = "force-dynamic";

export default async function VerifyPage(props: PageProps<"/verify/[token]">) {
  const { token } = await props.params;
  const result = await consumeToken(token, "VERIFY_EMAIL");

  if (!result.ok) {
    return (
      <Shell kicker="EXPIRED" title="連結已失效" tone="moon">
        <p className="text-sm text-dim">
          這個連結可能已經用過或過期了。請回到個人資料頁重新寄送一次驗證信。
        </p>
      </Shell>
    );
  }

  await markEmailVerified(result.participantId);

  return (
    <Shell kicker="VERIFIED" title="信箱已確認" tone="neon">
      <p className="text-sm text-dim">
        之後就算手機出狀況或瀏覽器資料被清除，你都能用這個信箱找回自己的收集成果。
      </p>
    </Shell>
  );
}

function Shell({
  kicker,
  title,
  tone,
  children,
}: {
  kicker: string;
  title: string;
  tone: "neon" | "moon";
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span
        className={`px text-[11px] tracking-[0.22em] ${
          tone === "neon" ? "text-glow-neon text-neon" : "text-moon"
        }`}
      >
        {kicker}
      </span>
      <h1 className="text-2xl font-black">{title}</h1>
      {children}
      <Link
        href="/me"
        className="tap-target glow-neon mt-2 flex items-center rounded-sm bg-neon px-6 py-3 font-bold text-void"
      >
        回到我的頁面
      </Link>
    </main>
  );
}
