import Link from "next/link";
import { getCurrentParticipant } from "@/lib/session";
import { performScan, SCAN_FAILURE_MESSAGE } from "@/lib/scan";
import { CardDisplay } from "@/components/CardDisplay";

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
      <Shell title="請先完成報到">
        <p className="text-sm text-gray-500">
          你還沒有在這場活動建立身分。請先掃描主辦方提供的報到 QR Code，完成之後再回來收集這張卡片。
        </p>
      </Shell>
    );
  }

  const outcome = await performScan(me.id, code);

  if (!outcome.ok) {
    return (
      <Shell title="無法收集">
        <p className="text-sm text-gray-500">
          {SCAN_FAILURE_MESSAGE[outcome.reason]}
        </p>
      </Shell>
    );
  }

  return (
    <Shell title={outcome.duplicate ? "你已經收集過這個人了" : "收集成功！"}>
      {outcome.duplicate && (
        <p className="text-sm text-gray-500">
          重複掃描不會增加分數，這張卡片已經在你的收集清單裡。
        </p>
      )}
      <CardDisplay card={outcome.card} />
    </Shell>
  );
}

function Shell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-5 py-8 pb-[calc(2rem+var(--safe-bottom))]">
      <h1 className="text-center text-xl font-bold">{title}</h1>
      {children}
      <nav className="flex flex-col gap-2">
        <Link
          href="/scan"
          className="tap-target flex items-center justify-center rounded-lg bg-gray-900 py-3 font-medium text-white"
        >
          繼續掃描
        </Link>
        <Link
          href="/collection"
          className="tap-target flex items-center justify-center rounded-lg border border-gray-300 py-3 font-medium"
        >
          查看收集清單
        </Link>
      </nav>
    </main>
  );
}
