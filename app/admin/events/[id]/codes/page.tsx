import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, requireEventAccess } from "@/lib/admin-session";
import { getPublicOrigin } from "@/lib/origin";

/**
 * 可投影或列印的報到 QR Code。
 *
 * 沒有這一頁，主辦方手上只有 JOINNCU1 這樣的字串，無法讓新生掃描——
 * 註冊碼必須被畫成 QR 才進得了活動現場。
 */
export default async function AdminCodesPage(
  props: PageProps<"/admin/events/[id]/codes">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await props.params;

  /*
    ⚠️ 這是全站最不可逆的一頁：印出去的 QR 收不回來。
    活動由網址決定，所以列印前網址列本身就能核對是哪一場——
    先前靠「我選定的那一場」，切換過卻忘記就會印錯。
  */
  const allowed = await requireEventAccess(admin, id);
  if (!allowed) notFound();

  const event = await prisma.event.findUnique({
    where: { id: allowed.id },
    include: { entryCodes: { orderBy: { role: "asc" } } },
  });
  if (!event) notFound();

  /*
    與 /admin/display 走同一套來源判斷。先前這裡自己讀標頭，於是
    PUBLIC_ORIGIN 對投影頁有效、對這一頁無效——而這一頁印出來的東西
    是要帶到現場、當天無法更正的，兩者不一致的代價最高。

    另外舊寫法的 proto 預設是 http，在沒有 x-forwarded-proto 的
    https 網域下會印出 http 開頭的網址。
  */
  const origin = await getPublicOrigin();
  const host = origin.replace(/^https?:\/\//, "");

  const codes = await Promise.all(
    event.entryCodes.map(async (entry) => {
      const url = `${origin}/join/${entry.code}`;
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
        <p className="text-sm text-dim">{event.name}</p>
      </header>

      <div className="rounded-xl bg-moon/10 px-4 py-3 text-sm text-moon">
        <p className="font-medium">投影或列印前請確認網址</p>
        <p className="mt-1 text-moon/80">
          QR 會指向 <span className="font-mono">{host}</span>。
          若這不是活動當天要用的網址，印出來的碼到時候會連不到。
          設定 <span className="font-mono">PUBLIC_ORIGIN</span> 可以固定它；
          沒設定時取自你目前的連線網址。
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {codes.map((c) => (
          <section
            key={c.id}
            className="flex flex-col items-center gap-3 rounded-2xl border border-line p-6"
          >
            <div className="flex flex-col items-center gap-1">
              <h2 className="text-lg font-bold">{c.label ?? "報到碼"}</h2>
              {c.role === "STAFF" && (
                <span className="rounded-full bg-moon px-3 py-0.5 text-xs font-medium text-void">
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
            <p className="text-center text-xs break-all text-faint">{c.url}</p>
          </section>
        ))}
      </div>

      <p className="text-center text-xs text-dim">
        通關碼為 <span className="font-mono">{event.passcode}</span>，
        請於現場口頭或投影公布，不要印在 QR Code 旁邊。
      </p>

      <Link
        href={`/admin/events/${event.id}`}
        className="tap-target flex items-center justify-center text-sm text-dim"
      >
        回到後台
      </Link>
    </main>
  );
}
