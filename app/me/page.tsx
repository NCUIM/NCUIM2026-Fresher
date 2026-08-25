import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentParticipant } from "@/lib/session";
import { iconByKey } from "@/lib/icons";

export default async function MePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  // QR Code 內容是一組網址而非純代碼——這讓手機原生相機也能完成收集，
  // 作為網頁內建掃描器無法使用時的備援路徑（Q11）。
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const collectUrl = `${proto}://${host}/c/${me.personalCode}`;
  const qrDataUrl = await QRCode.toDataURL(collectUrl, {
    width: 512,
    margin: 1,
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold">{me.nickname}</h1>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
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

      <p className="text-center text-xs text-gray-400">
        {me.event.name}
      </p>
    </main>
  );
}
