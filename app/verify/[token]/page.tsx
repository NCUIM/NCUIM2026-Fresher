import Link from "next/link";
import { consumeToken, markEmailVerified } from "@/lib/recovery";

export const dynamic = "force-dynamic";

export default async function VerifyPage(props: PageProps<"/verify/[token]">) {
  const { token } = await props.params;
  const result = await consumeToken(token, "VERIFY_EMAIL");

  if (!result.ok) {
    return (
      <Shell title="連結已失效">
        <p className="text-sm text-gray-500">
          這個連結可能已經用過或過期了。請回到個人資料頁重新寄送一次驗證信。
        </p>
      </Shell>
    );
  }

  await markEmailVerified(result.participantId);

  return (
    <Shell title="信箱已確認 ✓">
      <p className="text-sm text-gray-500">
        之後就算手機出狀況或瀏覽器資料被清除，你都能用這個信箱找回自己的收集成果。
      </p>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      {children}
      <Link
        href="/me"
        className="tap-target flex items-center rounded-lg bg-gray-900 px-6 py-3 font-medium text-white"
      >
        回到我的頁面
      </Link>
    </main>
  );
}
