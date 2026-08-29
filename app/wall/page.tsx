import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { getReceivedImpressions } from "@/lib/wall";
import { NavShell } from "@/components/layout/NavShell";
import { FloatingWall } from "@/components/wall/FloatingWall";

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
    <NavShell>
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">大家眼中的你</h1>
          <span className="px text-glow-moon text-sm text-moon">
            {String(impressions.length).padStart(2, "0")}
          </span>
        </div>
        <p className="text-xs text-faint">
          只有你看得到這面牆。點一則可以隱藏或回報。
        </p>
      </header>

      <FloatingWall impressions={impressions} purgeDate={purgeDate} />
    </NavShell>
  );
}
