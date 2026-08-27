import Link from "next/link";
import { getCurrentParticipant } from "@/lib/session";
import { performScan, SCAN_FAILURE_MESSAGE } from "@/lib/scan";
import { CollectReveal } from "@/components/card/CollectReveal";
import { NavShell } from "@/components/layout/BottomNav";

/**
 * Personal Code QR 指向的網址，供**手機原生相機**完成收集（Q11 的備援路徑）。
 *
 * 這個 GET 會產生副作用，嚴格說違反 GET 應為安全操作的慣例。之所以接受：
 * 原生相機只能開啟網址，若改成需要按下確認按鈕，這條本來就較慢的備援路徑
 * 會再多一次點擊。風險有限——未帶 session cookie 的請求（爬蟲、連結預覽）
 * 什麼也不會做，而重複開啟同一網址因 pairKey 冪等而無害。
 */
export const dynamic = "force-dynamic";

export default async function CollectPage(props: PageProps<"/c/[code]">) {
  const { code } = await props.params;
  const me = await getCurrentParticipant();

  if (!me) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="px text-[11px] tracking-[0.2em] text-faint">NO IDENTITY</span>
        <h1 className="text-xl font-black">請先完成報到</h1>
        <p className="text-sm text-dim">
          你還沒有在這場活動建立身分。請先掃描主辦方提供的報到 QR Code，
          完成之後再回來收集這張卡片。
        </p>
        <Link
          href="/scan"
          className="tap-target glow-neon flex items-center rounded-sm bg-neon px-6 py-3 font-bold text-void"
        >
          掃描報到碼
        </Link>
      </main>
    );
  }

  const outcome = await performScan(me.id, code);

  return (
    <NavShell>
      {outcome.ok ? (
        <CollectReveal
          card={outcome.card}
          duplicate={outcome.duplicate}
          points={outcome.duplicate ? undefined : me.event.basePoints}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <h1 className="text-center text-xl font-black">無法收集</h1>
          <p className="rounded-xl border border-moon/40 bg-moon/10 px-4 py-3 text-sm text-moon">
            {SCAN_FAILURE_MESSAGE[outcome.reason]}
          </p>
        </div>
      )}

      <Link
        href="/scan"
        className="tap-target glow-neon flex items-center justify-center rounded-sm bg-neon py-3 font-bold text-void"
      >
        繼續掃描
      </Link>
    </NavShell>
  );
}
