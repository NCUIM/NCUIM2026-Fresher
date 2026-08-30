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
    濾除的動作交給畫面——它把隱藏的移出浮光區、收進下方的清單。
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
      {/*
        牆是滿版的 fixed，標題疊在它上面。

        頂部**只留一行**：兩行的說明文字會與流過的字柱糾纏成一團，誰都
        讀不清楚。操作說明因此全部移到底部那一行，那裡有遮罩護著。

        z-10 與 pointer-events-none 缺一不可：少了前者標題會被牆蓋住，
        少了後者標題那塊區域會吃掉觸控，剛好流到上緣的字柱就抓不動。
      */}
      <header className="pointer-events-none relative z-10 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-black">大家眼中的你</h1>
        <span className="flex items-baseline gap-2 text-[11px] text-faint">
          只有你看得到
          <span className="px text-glow-moon text-sm text-moon">
            {String(impressions.filter((i) => !i.hidden).length).padStart(2, "0")}
          </span>
        </span>
      </header>

      <FloatingWall impressions={impressions} purgeDate={purgeDate} fill />
    </NavShell>
  );
}
