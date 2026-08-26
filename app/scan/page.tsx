import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { Scanner } from "./Scanner";

export default async function ScanPage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  if (me.event.status !== "ACTIVE") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-5 text-center">
        <h1 className="text-lg font-bold">活動已結束</h1>
        <p className="text-sm text-gray-500">
          收集功能已關閉，但你仍然可以查看自己的收集成果。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <Scanner />
    </main>
  );
}
