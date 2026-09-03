"use client";

import { useState } from "react";

/**
 * 找回身分的確認按鈕。
 *
 * 走 POST 而不是讓確認頁自己在渲染時完成綁定：種下身分 cookie 必須是
 * 使用者明確按下的動作，否則傳連結給別人就等於把自己的身分裝進對方的
 * 瀏覽器（見 app/recover/[token]/page.tsx 的說明）。
 *
 * 送 JSON 而不是表單：`application/json` 是 HTML 表單送不出來的內容型別，
 * 跨站的 fetch 要送它則會先觸發預檢而被擋下。這是這支端點的 CSRF 防線，
 * 伺服器那一側會再確認一次（見 app/api/recover/consume/route.ts）。
 */
export function RecoverConfirm({
  token,
  nickname,
}: {
  token: string;
  nickname: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/recover/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        // 權杖可能在使用者停留在這一頁時過期，或已經在別的裝置上用掉了。
        window.location.replace("/recover?error=expired");
        return;
      }

      /*
        整頁導向，不用 router.replace。

        兩個理由。其一，身分 cookie 是這次回應才種下的，整頁載入能保證
        接下來的每一個請求都帶著它，不必去想 App Router 的客戶端快取裡
        還留著什麼。

        其二也是更要緊的：router.refresh() 在這裡會重跑**當前這一頁**的
        伺服器元件，而權杖剛剛已經被消費掉——確認頁的 peekToken 會失敗並
        redirect 到 ?error=expired，跟導向 /me 賽跑。明明成功了卻可能落在
        錯誤頁上，而使用者完全看不出發生了什麼事。

        replace 而不是 assign：不要在上一頁留下這個帶著權杖的網址，
        按上一頁只會回到一個已經失效的連結。
      */
      window.location.replace("/me");
    } catch {
      setError("連線失敗，請確認網路後再試一次");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={confirm}
        disabled={submitting}
        className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
      >
        {submitting ? "綁定中…" : `我是 ${nickname}，回到我的成果`}
      </button>

      <p className="text-center text-xs text-faint">
        按下之後，其他裝置上的舊登入會失效。
      </p>
    </div>
  );
}
