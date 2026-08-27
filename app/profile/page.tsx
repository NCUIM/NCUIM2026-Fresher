import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { NavShell } from "@/components/layout/BottomNav";
import { ProfileEditor } from "@/components/forms/ProfileEditor";

export default async function ProfilePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  return (
    <NavShell>
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black">編輯個人資料</h1>
        <p className="text-xs text-faint">
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
          email: me.email,
          emailVerified: me.emailVerified,
          zodiac: me.zodiac,
          university: me.university,
        }}
      />
    </NavShell>
  );
}
