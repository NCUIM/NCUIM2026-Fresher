import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { getReceivedImpressions } from "@/lib/wall";
import { NavShell } from "@/components/layout/NavShell";
import { FloatingWall } from "@/components/wall/FloatingWall";

export default async function WallPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  /*
    連隱藏的一起取。隱藏是可以還原的，若這裡就把它們濾掉，
    本人再也找不到那則內容，「還原」就是一個到不了的功能。
    濾除的動作交給畫面——它把隱藏的移出漂浮區、收進下方的清單。
  */
  const impressions = await getReceivedImpressions(me.id, {
    includeHidden: true,
  });

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
            {String(impressions.filter((i) => !i.hidden).length).padStart(2, "0")}
          </span>
        </div>
        <p className="text-xs text-faint">
          只有你看得到這面牆。點一則可以隱藏，或回報給主辦方。
        </p>
      </header>

      <FloatingWall impressions={impressions} purgeDate={purgeDate} />
    </NavShell>
  );
}
