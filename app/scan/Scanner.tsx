"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { CardView } from "@/lib/cards";
import { extractEntryCode, extractPersonalCode } from "@/lib/parse-code";
import { CardDisplay } from "@/components/CardDisplay";
import { QrCamera } from "@/components/QrCamera";

type Result =
  | { kind: "collected"; card: CardView; duplicate: boolean }
  | { kind: "message"; title: string; body: string };

/**
 * 單一掃描器，同時處理報到碼與個人碼。
 *
 * 使用者不該需要先判斷自己面前是哪一種 QR，再決定按哪個按鈕——
 * 掃到的內容本身就足以決定要做什麼，判斷交給程式而不是人。
 */
export function Scanner({ authenticated }: { authenticated: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<Result | null>(null);
  const [manual, setManual] = useState("");

  const collect = useCallback(async (personalCode: string) => {
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: "message", title: "無法收集", body: data.error ?? "收集失敗" });
        return;
      }
      setResult({ kind: "collected", card: data.card, duplicate: data.duplicate });
      if (navigator.vibrate) navigator.vibrate(data.duplicate ? 40 : [40, 60, 40]);
    } catch {
      setResult({ kind: "message", title: "無法收集", body: "連線失敗，請確認網路" });
    }
  }, []);

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
        await collect(personalCode);
        return true;
      }

      return false; // 不相關的 QR，安靜地繼續掃
    },
    [authenticated, collect, router],
  );

  function submitManual() {
    const entryCode = extractEntryCode(manual);
    if (entryCode && !authenticated) {
      router.push(`/join/${entryCode}`);
      return;
    }
    const personalCode = extractPersonalCode(manual);
    if (personalCode && authenticated) {
      void collect(personalCode);
      return;
    }
    if (personalCode && !authenticated) {
      setResult({
        kind: "message",
        title: "請先完成報到",
        body: "這是個人卡片的代碼。請先向主辦方取得報到碼。",
      });
      return;
    }
    if (entryCode) {
      router.push(`/join/${entryCode}`);
      return;
    }
    setResult({ kind: "message", title: "代碼格式不正確", body: "請再確認一次。" });
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-center text-xl font-bold">
          {result.kind === "message"
            ? result.title
            : result.duplicate
              ? "你已經收集過這個人了"
              : "收集成功！"}
        </h1>

        {result.kind === "message" ? (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {result.body}
          </p>
        ) : (
          <>
            {result.duplicate && (
              <p className="text-center text-sm text-gray-500">
                重複掃描不會增加分數。
              </p>
            )}
            <CardDisplay card={result.card} />
          </>
        )}

        <button
          onClick={() => setResult(null)}
          className="tap-target rounded-lg bg-gray-900 py-3 font-medium text-white"
        >
          繼續掃描
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">
          {authenticated ? "掃描收集" : "掃描報到碼"}
        </h1>
        <p className="text-sm text-gray-500">
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

      <details className="rounded-lg border border-gray-200 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          掃不到？改用手動輸入
        </summary>
        <div className="mt-3 flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={authenticated ? "對方卡片下方的代碼" : "例如 JOINNCU1"}
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5"
          />
          <button
            onClick={submitManual}
            className="tap-target rounded-lg bg-gray-900 px-4 font-medium text-white"
          >
            前往
          </button>
        </div>
      </details>
    </div>
  );
}
