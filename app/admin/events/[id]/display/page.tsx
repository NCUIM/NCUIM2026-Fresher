import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin, requireEventAccess } from "@/lib/admin-session";
import { getPublicOrigin } from "@/lib/origin";

/**
 * 現場投影用的報到畫面：一個大 QR、一組大通關碼。
 *
 * 與 /admin/codes 的差別在用途。那一頁是給主辦方列印或存檔的，
 * 這一頁是要打在投影幕上讓全場看的，所以只放報到當下需要的兩件事，
 * 其餘一律拿掉。
 *
 * 這裡把通關碼與 QR 放在一起是刻意的，跟「不要印在一起」並不衝突：
 * 投影幕只有在場的人看得到，而那正是我們要放進來的對象；
 * 印出來張貼的海報則會被不在場的人拍走。
 */
export default async function DisplayPage(
  props: PageProps<"/admin/events/[id]/display">,
) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const { id } = await props.params;

  const allowed = await requireEventAccess(admin, id);
  if (!allowed) notFound();

  const event = await prisma.event.findUnique({
    where: { id: allowed.id },
    include: {
      entryCodes: { where: { role: "PARTICIPANT" }, take: 1 },
      _count: { select: { participants: true } },
    },
  });
  if (!event) notFound();

  const entry = event.entryCodes[0];
  if (!entry) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl font-black">這場活動沒有一般參與者的報到碼</h1>
        <p className="text-sm text-dim">請先於後台建立。</p>
        <Link href={`/admin/events/${event.id}`} className="text-sm text-neon underline">
          回到後台
        </Link>
      </main>
    );
  }

  const origin = await getPublicOrigin();
  const joinUrl = `${origin}/join/${entry.code}`;
  // 投影機容易讓深色場景糊掉，QR 一律深色印在白底上，這樣最好掃。
  const qr = await QRCode.toDataURL(joinUrl, {
    width: 1200,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-8 py-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="px text-glow-neon text-sm tracking-[0.3em] text-neon">
          CHECK IN
        </span>
        <h1 className="text-4xl font-black md:text-5xl">{event.name}</h1>
      </header>

      <div className="flex flex-col items-center gap-8 md:flex-row md:gap-14">
        {/* QR：白底深碼，投影下最容易掃 */}
        <div className="rounded-2xl bg-white p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="報到 QR Code"
            className="aspect-square w-[52vmin] max-w-[420px] min-w-[240px]"
          />
        </div>

        <div className="flex flex-col items-center gap-3 md:items-start">
          <span className="px text-sm tracking-[0.25em] text-faint">PASSCODE</span>
          <p className="px text-glow-neon text-6xl leading-none font-bold tracking-[0.15em] text-neon md:text-7xl">
            {event.passcode}
          </p>
          <p className="mt-2 max-w-xs text-center text-lg text-dim md:text-left">
            用手機相機掃描左邊的 QR Code，
            <br />
            然後輸入上面的通關碼。
          </p>
        </div>
      </div>

      <footer className="flex flex-col items-center gap-1 text-center">
        <p className="px text-sm text-faint">
          已報到 {event._count.participants} 人
        </p>
        <p className="text-xs break-all text-faint/70">{joinUrl}</p>
        <Link href={`/admin/events/${event.id}`} className="mt-2 text-xs text-faint underline">
          回到後台
        </Link>
      </footer>
    </main>
  );
}
