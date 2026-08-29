import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { getShowcase, SHOWCASE_SIZE } from "@/lib/showcase";
import { NavShell } from "@/components/layout/NavShell";
import { ShowcaseEditor } from "@/components/forms/ShowcaseEditor";

export default async function ShowcasePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const [slots, collections] = await Promise.all([
    getShowcase(me.id),
    prisma.collection.findMany({
      where: { ownerId: me.id },
      include: {
        subject: { select: { id: true, nickname: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <NavShell>
      {/*
        返回按鈕。底部導覽沒有「九宮格」這一項，進來之後唯一的出路是
        再按一次「個人頁面」——但那看起來像切換分頁，不像返回。
      */}
      <Link
        href="/me"
        className="tap-target -mb-1 inline-flex items-center gap-1 self-start text-sm text-faint"
      >
        ← 回到個人頁面
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black">我的九宮格</h1>
        <p className="text-xs text-faint">
          挑出對你最重要的九個人。被你選中的人，你寫給他的話會在他的牆上更顯眼。
        </p>
      </header>

      {/*
        依 position 還原成固定九格。getShowcase 只回傳有內容的格子，
        直接 map 會把空格壓掉，使用者存過的排法就跑位了。
      */}
      <ShowcaseEditor
        candidates={collections.map((c) => c.subject)}
        initialSelected={Array.from(
          { length: SHOWCASE_SIZE },
          (_, i) => slots.find((s) => s.position === i)?.subjectId ?? null,
        )}
      />
    </NavShell>
  );
}
