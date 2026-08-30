import Image from "next/image";
import Link from "next/link";
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-14 pb-[calc(1.5rem+var(--safe-bottom))]">
      {/*
        首頁只講一件事：去報到。
        找回身分是少數人才需要的路徑，放在底部不與主動線競爭注意力。
      */}
      <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
        {/*
          原圖是 1254px 見方、1MB。用 next/image 讓它產生對應尺寸的版本，
          手機在現場只會下載 144px 那一張——這裡的網路要分給全場的人。

          alt 留空：緊接著就是活動名稱，讀螢幕軟體再唸一次吉祥物只是雜訊。
        */}
        <Image
          src="/icon.png"
          alt=""
          width={144}
          height={144}
          priority
          className="size-36 drop-shadow-[0_0_32px_rgba(90,120,255,0.35)]"
        />

        {/*
          沒有進行中的活動時，維持同一個版面，只換掉中間那一段。

          原本這裡整頁退化成一句「目前沒有進行中的活動」，連吉祥物與
          找回身分的入口都不見了——而「已經報到過但看不到資料」的人
          最可能就是在活動封存之後回來的，那正是他最需要找回入口的時候。
        */}
        <div className="flex flex-col gap-3">
          <span
            className={`px text-[11px] tracking-[0.24em] ${
              event ? "text-glow-neon text-neon" : "text-faint"
            }`}
          >
            {event ? "CHECK IN" : "OFFLINE"}
          </span>
          <h1 className="text-3xl font-black">
            {event ? event.name : "目前沒有進行中的活動"}
          </h1>
          <p className="text-sm text-dim">
            {event
              ? "掃描主辦方提供的報到 QR Code，開始收集大家的卡片。"
              : "請等主辦方開放報到後再回來。"}
          </p>
        </div>

        {event ? (
          <Link
            href="/scan"
            className="tap-target glow-neon flex w-full items-center justify-center rounded-sm bg-neon py-3.5 font-bold text-void"
          >
            掃描報到碼
          </Link>
        ) : (
          <span className="flex w-full items-center justify-center rounded-sm border border-line py-3.5 text-sm text-faint">
            尚未開放報到
          </span>
        )}
      </div>

      <div className="flex flex-col items-center gap-1 border-t border-line pt-5">
        <p className="text-xs text-faint">已經報到過，但這裡看不到你的資料？</p>
        <Link
          href="/recover"
          className="tap-target flex items-center text-sm text-dim underline"
        >
          用信箱找回收集成果
        </Link>
      </div>
    </main>
  );
}
