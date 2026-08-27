import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { JoinForm } from "@/components/forms/JoinForm";

export default async function JoinPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;

  // 已報到者直接進入自己的頁面，避免重複建立身分。
  const existing = await getCurrentParticipant();
  if (existing) redirect("/me");

  const entry = await prisma.entryCode.findUnique({
    where: { code: code.toUpperCase() },
    include: { event: true },
  });

  if (!entry) {
    return (
      <Notice
        title="註冊碼不存在"
        body="請確認掃描的是本場活動的報到 QR Code。"
      />
    );
  }

  if (entry.event.status !== "ACTIVE") {
    return <Notice title="活動已結束" body="這場活動已經結束，無法再報到。" />;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <JoinForm
        entryCode={entry.code}
        eventName={entry.event.name}
        roleLabel={entry.label}
      />
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-5 text-center">
      <span className="px text-[11px] tracking-[0.2em] text-faint">ERROR</span>
      <h1 className="text-xl font-black">{title}</h1>
      <p className="text-sm text-dim">{body}</p>
    </main>
  );
}
