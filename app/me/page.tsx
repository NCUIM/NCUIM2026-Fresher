import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentParticipant } from "@/lib/session";
import { iconByKey } from "@/lib/icons";
import { computeScore, pendingImpressions } from "@/lib/score";

export default async function MePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const [score, pending] = await Promise.all([
    computeScore(me.id),
    pendingImpressions(me.id),
  ]);

  // QR Code 內容是一組網址而非純代碼——這讓手機原生相機也能完成收集，
  // 作為網頁內建掃描器無法使用時的備援路徑（Q11）。
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const collectUrl = `${proto}://${host}/c/${me.personalCode}`;
  const qrDataUrl = await QRCode.toDataURL(collectUrl, { width: 512, margin: 1 });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold">{me.nickname}</h1>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {me.role === "STAFF" && (
            <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white">
              工作人員
            </span>
          )}
          {me.team && (
            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs text-white">
              {me.team.name ?? `第 ${me.team.number} 組`}
            </span>
          )}
        </div>
        <div className="flex gap-2 text-2xl">
          {me.icons.map((key) => (
            <span key={key}>{iconByKey(key)?.emoji}</span>
          ))}
        </div>
        {me.bio && <p className="text-center text-sm text-gray-600">{me.bio}</p>}
      </header>

      <section className="flex items-center justify-center gap-1 rounded-2xl bg-gray-900 py-4 text-white">
        <span className="text-3xl font-bold">{score.total}</span>
        <span className="self-end pb-1 text-sm text-gray-300">分</span>
      </section>

      {pending.length > 0 && (
        <Link
          href="/write"
          className="flex flex-col gap-0.5 rounded-2xl bg-amber-50 px-4 py-3"
        >
          <span className="font-medium text-amber-900">
            還有 {pending.length} 個人等你寫下印象
          </span>
          <span className="text-sm text-amber-800">
            寫完才會計分，點這裡去補完
          </span>
        </Link>
      )}

      <section className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-medium">讓別人掃描這個碼來收集你</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrDataUrl}
          alt="你的個人 QR Code"
          className="aspect-square w-full max-w-[260px]"
        />
        <p className="font-mono text-sm tracking-widest text-gray-500">
          {me.personalCode}
        </p>
      </section>

      <nav className="flex flex-col gap-2">
        <Link
          href="/scan"
          className="tap-target flex items-center justify-center rounded-lg bg-gray-900 py-3 font-medium text-white"
        >
          掃描收集
        </Link>
        <Link
          href="/collection"
          className="tap-target flex items-center justify-center rounded-lg border border-gray-300 py-3 font-medium"
        >
          收集清單
        </Link>
      </nav>

      <p className="text-center text-xs text-gray-400">{me.event.name}</p>
    </main>
  );
}
