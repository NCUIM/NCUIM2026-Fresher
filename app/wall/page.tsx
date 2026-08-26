import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { getReceivedImpressions } from "@/lib/wall";
import { FloatingWall } from "./FloatingWall";

export default async function WallPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const impressions = await getReceivedImpressions(me.id);

  // 明確告知刪除日期，讓使用者自行決定要不要截圖保存（ADR-0003）。
  const purgeDate = me.event.purgeAfter
    ? me.event.purgeAfter.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 bg-gradient-to-b from-sky-50 to-white px-5 pt-8 pb-[calc(1.5rem+var(--safe-bottom))]">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">大家眼中的你</h1>
        <span className="text-sm text-gray-500">{impressions.length} 則</span>
      </header>
      <p className="text-xs text-gray-500">
        只有你看得到這面牆。點一則可以隱藏或回報。
      </p>

      <FloatingWall impressions={impressions} purgeDate={purgeDate} />

      <Link
        href="/me"
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        回到我的頁面
      </Link>
    </main>
  );
}
