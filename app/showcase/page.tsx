import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { getShowcase } from "@/lib/showcase";
import { ShowcaseEditor } from "./ShowcaseEditor";

export default async function ShowcasePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const [slots, collections] = await Promise.all([
    getShowcase(me.id),
    prisma.collection.findMany({
      where: { ownerId: me.id },
      include: { subject: { select: { id: true, nickname: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">我的九宮格</h1>
        <p className="text-xs text-gray-500">
          挑出對你最重要的九個人。被你選中的人，你寫給他的話會在他的牆上更顯眼。
        </p>
      </header>

      <ShowcaseEditor
        candidates={collections.map((c) => c.subject)}
        initialSelected={slots.map((s) => s.subjectId)}
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
