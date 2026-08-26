import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { toCardView } from "@/lib/cards";
import { CardDisplay } from "@/components/CardDisplay";

export default async function CollectionPage(
  props: PageProps<"/collection">,
) {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const { filter } = await props.searchParams;
  const teamOnly = filter === "team";

  const collections = await prisma.collection.findMany({
    where: {
      ownerId: me.id,
      // 「只看隊員」：限定同組，用於追蹤組別成就的進度。
      ...(teamOnly && me.teamId ? { subject: { teamId: me.teamId } } : {}),
    },
    include: { subject: { include: { team: true } } },
    // Q47：依收集時間倒序，剛認識的人排在最前面。
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">收集清單</h1>
        <span className="text-sm text-gray-500">{collections.length} 張</span>
      </header>

      {me.teamId && (
        <nav className="flex gap-2">
          <FilterTab href="/collection" active={!teamOnly} label="全部" />
          <FilterTab href="/collection?filter=team" active={teamOnly} label="只看隊員" />
        </nav>
      )}

      {collections.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          {teamOnly
            ? "還沒有收集到同組的隊員。到現場問問看誰跟你同一組吧！"
            : "還沒有收集到任何人，去掃描別人的 QR Code 吧！"}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {collections.map((c) => (
            <li key={c.id}>
              <CardDisplay card={toCardView(c.subject)} />
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/scan"
        className="tap-target sticky bottom-[var(--safe-bottom)] flex items-center justify-center rounded-lg bg-gray-900 py-3 font-medium text-white"
      >
        掃描收集
      </Link>
    </main>
  );
}

function FilterTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`tap-target flex items-center rounded-full px-4 text-sm ${
        active ? "bg-gray-900 text-white" : "border border-gray-300"
      }`}
    >
      {label}
    </Link>
  );
}
