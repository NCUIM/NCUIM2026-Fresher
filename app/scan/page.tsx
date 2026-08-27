import Link from "next/link";
import { getCurrentParticipant } from "@/lib/session";
import { Scanner } from "./Scanner";

/**
 * 掃描頁在未報到與已報到兩種狀態下都可用——同一個相機，掃到什麼就做什麼。
 * 未報到者用它掃報到碼，已報到者用它收集別人。
 */
export default async function ScanPage() {
  const me = await getCurrentParticipant();

  if (me && me.event.status !== "ACTIVE") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-5 text-center">
        <h1 className="text-lg font-bold">活動已結束</h1>
        <p className="text-sm text-gray-500">
          收集功能已關閉，但你仍然可以查看自己的收集成果。
        </p>
        <Link href="/me" className="tap-target flex items-center text-sm text-gray-600 underline">
          回到我的頁面
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <Scanner authenticated={me !== null} />
      <Link
        href={me ? "/me" : "/"}
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        {me ? "回到我的頁面" : "回到首頁"}
      </Link>
    </main>
  );
}
