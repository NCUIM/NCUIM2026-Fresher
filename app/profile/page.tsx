import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { ProfileEditor } from "./ProfileEditor";

export default async function ProfilePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">編輯個人資料</h1>
        <p className="text-xs text-gray-500">
          修改後，所有收集過你的人手上的卡片會立刻跟著更新。
        </p>
      </header>

      <ProfileEditor
        initial={{
          nickname: me.nickname,
          bio: me.bio,
          socialUrl: me.socialUrl,
          icons: me.icons,
          avatarUrl: me.avatarUrl,
        }}
      />

      <Link
        href="/me"
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        回到我的頁面
      </Link>
    </main>
  );
}
