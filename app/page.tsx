import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";

export default async function Home() {
  // 已報到者直接進入自己的頁面。活動當天多數人是從書籤或歷史紀錄回來的，
  // 讓他們再看一次說明頁沒有意義。
  const me = await getCurrentParticipant();
  if (me) redirect("/me");

  const event = await prisma.event.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { name: true },
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-2xl font-bold">
        {event?.name ?? "卡片收集"}
      </h1>

      {event ? (
        <>
          <p className="text-sm text-gray-600">
            請掃描主辦方提供的<strong>報到 QR Code</strong> 開始。
          </p>
          <p className="text-xs text-gray-400">
            已經報到過卻看到這個畫面？可能是瀏覽器資料被清除了。
          </p>
          <a
            href="/recover"
            className="tap-target flex items-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium"
          >
            用信箱找回我的收集成果
          </a>
        </>
      ) : (
        <p className="text-sm text-gray-500">目前沒有進行中的活動。</p>
      )}
    </main>
  );
}
