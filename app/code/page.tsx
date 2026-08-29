import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getCurrentParticipant } from "@/lib/session";
import { getPublicOrigin } from "@/lib/origin";
import { NavShell } from "@/components/layout/NavShell";

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
  const origin = await getPublicOrigin();
  const collectUrl = `${origin}/c/${me.personalCode}`;

  /*
    深色碼、淺色底。**不要反白。**

    這一頁原本用亮碼配深底來融入暗色介面，結果是網頁掃描器完全讀不到——
    手機原生相機能解反白的 QR，ZXing 不行。實測同一組網址：
    黑/白 可解、亮/深 NotFoundException、深/淺 可解。

    症狀特別難查，因為相機會正常開啟、持續掃描，只是永遠不觸發——
    看起來像掃描程式壞了，其實是這張圖本身讀不出來。
  */
  const qrDataUrl = await QRCode.toDataURL(collectUrl, {
    width: 900,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  return (
    <NavShell>
      <header className="flex flex-col items-center gap-1 pt-2">
        <span className="px text-[11px] tracking-[0.2em] text-neon">SCAN ME</span>
        <h1 className="text-xl font-black">{me.nickname}</h1>
        <p className="text-xs text-dim">讓對方掃描這個碼來收集你</p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        {/* 白底是為了可掃描性，霓虹外框保住暗色介面的一致感。 */}
        <div className="glow-neon rounded-xl border border-neon/50 bg-white p-3">
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
