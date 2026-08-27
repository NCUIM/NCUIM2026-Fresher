import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";

/**
 * 可投影或列印的報到 QR Code。
 *
 * 沒有這一頁，主辦方手上只有 JOINNCU1 這樣的字串，無法讓新生掃描——
 * 註冊碼必須被畫成 QR 才進得了活動現場。
 */
export default async function AdminCodesPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const event = await prisma.event.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    include: { entryCodes: { orderBy: { role: "asc" } } },
  });

  if (!event) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-2 px-5 text-center">
        <h1 className="text-lg font-bold">沒有進行中的活動</h1>
        <Link href="/admin" className="text-sm text-gray-600 underline">
          回到後台
        </Link>
      </main>
    );
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";

  const codes = await Promise.all(
    event.entryCodes.map(async (entry) => {
      const url = `${proto}://${host}/join/${entry.code}`;
      return {
        ...entry,
        url,
        qr: await QRCode.toDataURL(url, { width: 900, margin: 1 }),
      };
    }),
  );

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">報到 QR Code</h1>
        <p className="text-sm text-gray-500">{event.name}</p>
      </header>

      <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-medium">投影或列印前請確認網址</p>
        <p className="mt-1 text-amber-800">
          QR 內容取自目前的連線網址（<span className="font-mono">{host}</span>）。
          若你現在是透過隧道或本機位址存取，印出來的碼在活動當天會連不到。
          請在<strong>正式網址</strong>底下開啟這一頁再列印。
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {codes.map((c) => (
          <section
            key={c.id}
            className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 p-6"
          >
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-lg font-bold">{c.label ?? "報到碼"}</h2>
              {c.role === "STAFF" && (
                <span className="rounded-full bg-amber-500 px-3 py-0.5 text-xs font-medium text-white">
                  請勿公開張貼
                </span>
              )}
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.qr}
              alt={`${c.label ?? c.code} 的報到 QR Code`}
              className="aspect-square w-full max-w-[340px]"
            />

            <p className="font-mono text-lg tracking-[0.2em]">{c.code}</p>
            <p className="text-center text-xs break-all text-gray-400">{c.url}</p>
          </section>
        ))}
      </div>

      <p className="text-center text-xs text-gray-500">
        通關碼為 <span className="font-mono">{event.passcode}</span>，
        請於現場口頭或投影公布，不要印在 QR Code 旁邊。
      </p>

      <Link
        href="/admin"
        className="tap-target flex items-center justify-center text-sm text-gray-500"
      >
        回到後台
      </Link>
    </main>
  );
}
