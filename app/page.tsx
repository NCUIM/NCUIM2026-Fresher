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

  if (!event) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="px text-[11px] tracking-[0.2em] text-faint">OFFLINE</span>
        <h1 className="text-xl font-black">目前沒有進行中的活動</h1>
        <p className="text-sm text-dim">請等主辦方開放報到後再回來。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-14 pb-[calc(1.5rem+var(--safe-bottom))]">
      {/*
        首頁只講一件事：去報到。
        找回身分是少數人才需要的路徑，放在底部不與主動線競爭注意力。
      */}
      <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
        <div className="flex flex-col gap-3">
          <span className="px text-glow-neon text-[11px] tracking-[0.24em] text-neon">
            CHECK IN
          </span>
          <h1 className="text-3xl font-black">{event.name}</h1>
          <p className="text-sm text-dim">
            掃描主辦方提供的報到 QR Code，開始收集大家的卡片。
          </p>
        </div>

        <Link
          href="/scan"
          className="tap-target glow-neon flex w-full items-center justify-center rounded-sm bg-neon py-3.5 font-bold text-void"
        >
          掃描報到碼
        </Link>
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
