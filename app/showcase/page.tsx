import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { getShowcase } from "@/lib/showcase";
import { NavShell } from "@/components/BottomNav";
import { ShowcaseEditor } from "./ShowcaseEditor";

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
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-black">我的九宮格</h1>
        <p className="text-xs text-faint">
          挑出對你最重要的九個人。被你選中的人，你寫給他的話會在他的牆上更顯眼。
        </p>
      </header>

      <ShowcaseEditor
        candidates={collections.map((c) => c.subject)}
        initialSelected={slots.map((s) => s.subjectId)}
      />
    </NavShell>
  );
}
