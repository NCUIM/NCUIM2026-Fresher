import { redirect } from "next/navigation";
import { peekToken } from "@/lib/recovery";
import { RecoverConfirm } from "@/components/forms/RecoverConfirm";

/**
 * 找回身分的確認頁。
 *
 * ⚠️ 這一頁**只看不用**。權杖的消費與種 cookie 都在 /api/recover/consume，
 * 由使用者按下按鈕觸發。
 *
 * 先前這裡是一支 GET 的 Route Handler，被開啟的當下就直接種下身分 cookie。
 * 那讓任何人都能替自己要一封找回信，再把連結傳給別人——網域是正確的、
 * 連結看起來毫無可疑之處，但對方的瀏覽器會靜默地變成傳連結的那個人。
 * 受害者之後掃到的每一個人、寫的每一則短評，以及編輯個人資料時填進去的
 * 真實姓名與信箱，全部進到攻擊者的帳號裡（session fixation）。
 *
 * 多一次點擊換到的是「這個動作確實是本人要做的」。而對真正的使用者來說，
 * 那一頁還多告訴了他一件有用的事：他正要回到的是哪一個身分。
 */
export const dynamic = "force-dynamic";

export default async function RecoverConfirmPage(
  props: PageProps<"/recover/[token]">,
) {
  const { token } = await props.params;
  const result = await peekToken(token, "RECOVER_SESSION");

  /*
    過期、用過、偽造都導向同一個地方。
    /recover 那一頁已經有 ?error=expired 的說明與重新索取的表單，
    而區分這些狀態對使用者沒有幫助——他要做的事都是「再要一封新的」。
  */
  if (!result.ok) redirect("/recover?error=expired");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6">
      <header className="flex flex-col gap-1.5 text-center">
        <span className="px text-[11px] tracking-[0.22em] text-neon">RECOVER</span>
        <h1 className="text-2xl font-black">回到你的收集成果</h1>
        <p className="text-sm text-dim">
          這個連結會把{" "}
          <strong className="font-bold text-chalk">{result.nickname}</strong>{" "}
          的身分綁定到這台裝置上。
        </p>
      </header>

      <RecoverConfirm token={token} nickname={result.nickname} />

      <p className="text-center text-xs text-faint">
        不是你本人的名字嗎？請不要繼續，直接關閉這一頁，
        並告訴現場工作人員你收到了別人的連結。
      </p>
    </main>
  );
}
