import { headers } from "next/headers";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentParticipant } from "@/lib/session";
import { NavShell } from "@/components/BottomNav";

/**
 * 出示自己的 QR Code。與 /scan 對稱——兩人相遇時一個出示、一個掃描。
 *
 * 獨立成頁而非塞在個人主頁裡：出示的當下畫面上不該有別的東西干擾，
 * 而且對方要在昏暗場地快速對焦，碼必須夠大。
 */
export default async function CodePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  // QR 內容是網址而非純代碼，讓手機原生相機也能完成收集（Q11 的備援路徑）。
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const collectUrl = `${proto}://${host}/c/${me.personalCode}`;
  const qrDataUrl = await QRCode.toDataURL(collectUrl, {
    width: 900,
    margin: 1,
    color: { dark: "#e9eef9", light: "#060912" },
  });

  return (
    <NavShell>
      <header className="flex flex-col items-center gap-1 pt-2">
        <span className="px text-[11px] tracking-[0.2em] text-neon">SCAN ME</span>
        <h1 className="text-xl font-black">{me.nickname}</h1>
        <p className="text-xs text-dim">讓對方掃描這個碼來收集你</p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <div className="glow-neon rounded-xl border border-neon/50 bg-void p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt="你的個人 QR Code"
            className="aspect-square w-full max-w-[290px]"
          />
        </div>

        <p className="px text-glow-neon text-lg tracking-[0.25em] text-neon">
          {me.personalCode}
        </p>
        <p className="text-center text-xs text-faint">
          掃不到的話，請對方改用手動輸入上面這串代碼
        </p>
      </div>
    </NavShell>
  );
}
