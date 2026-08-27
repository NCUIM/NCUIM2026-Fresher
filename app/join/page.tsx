import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentParticipant } from "@/lib/session";
import { JoinScanner } from "./JoinScanner";

export default async function JoinScanPage() {
  // 已報到者不需要再掃報到碼。
  const me = await getCurrentParticipant();
  if (me) redirect("/me");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <JoinScanner />
      <Link
        href="/"
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        回到首頁
      </Link>
    </main>
  );
}
