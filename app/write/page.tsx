import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { pendingImpressions } from "@/lib/score";
import { WriteQueue } from "./WriteQueue";

export default async function WritePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const pending = await pendingImpressions(me.id);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <WriteQueue initial={pending} />
      <Link
        href="/me"
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        回到我的頁面
      </Link>
    </main>
  );
}
