import Link from "next/link";
import { getCurrentParticipant } from "@/lib/session";
import { NavShell } from "@/components/layout/BottomNav";
import { Scanner } from "@/components/scan/Scanner";

/**
 * 掃描頁在未報到與已報到兩種狀態下都可用——同一個相機，掃到什麼就做什麼。
 * 未報到者用它掃報到碼，已報到者用它收集別人。
 */
export default async function ScanPage() {
  const me = await getCurrentParticipant();

  if (me && me.event.status !== "ACTIVE") {
    return (
      <NavShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <span className="px text-[11px] tracking-[0.2em] text-faint">CLOSED</span>
          <h1 className="text-xl font-black">活動已結束</h1>
          <p className="text-sm text-dim">
            收集功能已關閉，但你仍然可以查看自己的收集成果。
          </p>
        </div>
      </NavShell>
    );
  }

  // 未報到者沒有底部導覽（他們還沒有身分，導覽列上的頁面都進不去）
  if (!me) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-7 pb-[calc(2rem+var(--safe-bottom))]">
        <Scanner authenticated={false} />
        <Link
          href="/"
          className="tap-target flex items-center justify-center text-sm text-faint"
        >
          回到首頁
        </Link>
      </main>
    );
  }

  return (
    <NavShell>
      <Scanner authenticated basePoints={me.event.basePoints} />
    </NavShell>
  );
}
