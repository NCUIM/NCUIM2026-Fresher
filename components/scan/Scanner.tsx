"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { CardView } from "@/lib/cards";
import { extractEntryCode, extractPersonalCode } from "@/lib/parse-code";
import { CollectReveal } from "@/components/card/CollectReveal";
import { QrCamera } from "@/components/scan/QrCamera";

type Result =
  | { kind: "collected"; card: CardView; duplicate: boolean; points?: number }
  | { kind: "message"; title: string; body: string };

/**
 * 單一掃描器，同時處理報到碼與個人碼。
 *
 * 使用者不該需要先判斷自己面前是哪一種 QR，再決定按哪個按鈕——
 * 掃到的內容本身就足以決定要做什麼，判斷交給程式而不是人。
 */
export function Scanner({
  authenticated,
  basePoints,
}: {
  authenticated: boolean;
  basePoints?: number;
}) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * 成功時設好 result 並回傳 null，失敗時回傳錯誤訊息交給呼叫端。
   *
   * 錯誤該顯示在哪裡取決於使用者剛才做了什麼：用相機掃的人視線在畫面中央，
   * 用手動輸入的人視線在輸入框上。由這裡直接決定的話，只能二選一。
   */
  const collect = useCallback(
    async (personalCode: string): Promise<string | null> => {
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personalCode }),
        });
        const data = await res.json();
        if (!res.ok) return data.error ?? "收集失敗";

        setResult({
          kind: "collected",
          card: data.card,
          duplicate: data.duplicate,
          points: data.duplicate ? undefined : basePoints,
        });
        if (navigator.vibrate) navigator.vibrate(data.duplicate ? 40 : [40, 60, 40]);
        return null;
      } catch {
        return "連線失敗，請確認網路";
      }
    },
    [basePoints],
  );

  /** 依掃到的內容分派。回傳 true 代表已處理，相機暫停。 */
  const dispatch = useCallback(
    async (text: string) => {
      const entryCode = extractEntryCode(text);
      if (entryCode) {
        // 已報到者前往 /join/[code] 會被自動導回 /me，這裡不需要另外判斷。
        router.push(`/join/${entryCode}`);
        return true;
      }

      const personalCode = extractPersonalCode(text);
      if (personalCode) {
        if (!authenticated) {
          setResult({
            kind: "message",
            title: "請先完成報到",
            body: "這是別人的個人卡片。你需要先掃描主辦方提供的報到 QR Code，建立自己的身分之後才能收集別人。",
          });
          return true;
        }
        // 相機路徑：使用者正盯著畫面，錯誤就顯示在畫面上。
        const error = await collect(personalCode);
        if (error) setResult({ kind: "message", title: "無法收集", body: error });
        return true;
      }

      return false; // 不相關的 QR，安靜地繼續掃
    },
    [authenticated, collect, router],
  );

  /*
    打錯代碼、輸入了另一種碼、長度不對——三種失敗都給同一句話。
    對站在報到隊伍裡的人來說，分辨這三者沒有意義，他要做的事都一樣：
    重打一次。唯一需要分開講的是已經報到過的人，因為那句話要告訴他
    問題不在代碼上，不必再重打。
  */
  const CODE_NOT_FOUND = authenticated ? "查不到這組代碼" : "查不到這組報到碼";

  /**
   * 手動輸入路徑。所有失敗都留在輸入框旁邊，不換頁也不清掉輸入內容——
   * 手輸最常見的錯誤是打錯一兩個字元，重試應該只差幾個按鍵。
   */
  async function submitManual() {
    setManualError(null);

    const raw = manual.trim();
    if (!raw) {
      setManualError("請先輸入代碼");
      return;
    }

    const entryCode = extractEntryCode(raw);
    const personalCode = extractPersonalCode(raw);

    if (personalCode && authenticated) {
      setBusy(true);
      const error = await collect(personalCode);
      setBusy(false);
      if (error) setManualError(error);
      return;
    }

    if (entryCode && authenticated) {
      setManualError("已經報到過了");
      return;
    }

    if (entryCode && !authenticated) {
      /*
        先問過伺服器再導向。直接 push 過去的話，代碼打錯的人會落在
        /join/[code] 的錯誤頁上——那頁沒有返回入口，也沒有輸入框。
      */
      setBusy(true);
      try {
        const res = await fetch(`/api/entry/${entryCode}`);
        if (res.ok) {
          router.push(`/join/${entryCode}`);
          return;
        }
        /*
          活動已封存是另一回事，必須照實說。回「查不到」會讓人反覆
          檢查一個根本沒打錯的代碼。
        */
        if (res.status === 409) {
          const data = await res.json().catch(() => null);
          setManualError(data?.error ?? CODE_NOT_FOUND);
          return;
        }
        setManualError(CODE_NOT_FOUND);
      } catch {
        setManualError("連線失敗，請確認網路");
      } finally {
        setBusy(false);
      }
      return;
    }

    // 未報到卻輸入個人碼，或長度不符任何一種——都走同一句。
    setManualError(CODE_NOT_FOUND);
  }

  if (result) {
    return (
      <div className="flex flex-col gap-5">
        {result.kind === "message" ? (
          <>
            <h1 className="text-center text-xl font-black">{result.title}</h1>
            <p className="rounded-xl border border-moon/40 bg-moon/10 px-4 py-3 text-sm text-moon">
              {result.body}
            </p>
          </>
        ) : (
          <CollectReveal
            card={result.card}
            duplicate={result.duplicate}
            points={result.points}
          />
        )}

        <button
          onClick={() => setResult(null)}
          className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void transition-colors hover:bg-neon/85 active:bg-neon/70"
        >
          繼續掃描
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="px text-[11px] tracking-[0.2em] text-neon">
          {authenticated ? "COLLECT" : "CHECK IN"}
        </span>
        <h1 className="text-xl font-black">
          {authenticated ? "掃描收集" : "掃描報到碼"}
        </h1>
        <p className="text-sm text-dim">
          {authenticated
            ? "對準對方的個人 QR Code。"
            : "對準主辦方投影或張貼的報到 QR Code。"}
        </p>
      </header>

      <QrCamera
        onDecode={dispatch}
        fallbackHint={
          authenticated
            ? "請改用手機內建的相機 App 掃描對方的 QR Code，或用下方的手動輸入。"
            : "請改用手機內建的相機 App 掃描報到 QR Code，或用下方的手動輸入。"
        }
      />

      <details className="rounded-xl border border-line surface px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-dim">
          掃不到？改用手動輸入
        </summary>
        <div className="mt-3 flex gap-2">
          <input
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              // 一開始修改就收掉舊訊息，否則錯誤會停在已經改過的內容旁邊。
              setManualError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitManual();
            }}
            placeholder={authenticated ? "對方卡片下方的代碼" : "例如 JOINNCU1"}
            autoCapitalize="characters"
            autoComplete="off"
            aria-invalid={manualError !== null}
            className="px min-w-0 flex-1 rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint focus:border-neon focus:outline-none"
          />
          <button
            onClick={() => void submitManual()}
            disabled={busy}
            className="tap-target rounded-sm border border-neon px-4 font-bold text-neon transition-colors hover:bg-neon hover:text-void active:bg-neon active:text-void disabled:border-line disabled:bg-transparent disabled:text-faint"
          >
            前往
          </button>
        </div>

        {manualError && (
          <p
            role="alert"
            aria-live="assertive"
            className="mt-2 rounded-sm border border-flare/50 bg-flare/15 px-3 py-2 text-sm text-flare"
          >
            {manualError}
          </p>
        )}
      </details>
    </div>
  );
}
