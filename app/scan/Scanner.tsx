"use client";

import { useCallback, useState } from "react";
import type { CardView } from "@/lib/cards";
import { extractPersonalCode } from "@/lib/parse-code";
import { CardDisplay } from "@/components/CardDisplay";
import { QrCamera } from "@/components/QrCamera";

type Result =
  | { kind: "collected"; card: CardView; duplicate: boolean }
  | { kind: "error"; message: string };

export function Scanner() {
  const [result, setResult] = useState<Result | null>(null);
  const [manualCode, setManualCode] = useState("");

  const submitCode = useCallback(async (personalCode: string) => {
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: "error", message: data.error ?? "收集失敗" });
        return;
      }
      setResult({ kind: "collected", card: data.card, duplicate: data.duplicate });
      if (navigator.vibrate) navigator.vibrate(data.duplicate ? 40 : [40, 60, 40]);
    } catch {
      setResult({ kind: "error", message: "連線失敗，請確認網路" });
    }
  }, []);

  const handleDecode = useCallback(
    async (text: string) => {
      const code = extractPersonalCode(text);
      if (!code) return false; // 不是卡片，繼續掃
      await submitCode(code);
      return true;
    },
    [submitCode],
  );

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-center text-xl font-bold">
          {result.kind === "error"
            ? "無法收集"
            : result.duplicate
              ? "你已經收集過這個人了"
              : "收集成功！"}
        </h1>

        {result.kind === "error" ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            {result.message}
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
      <h1 className="text-xl font-bold">掃描收集</h1>

      <QrCamera
        onDecode={handleDecode}
        paused={result !== null}
        fallbackHint="請改用手機內建的相機 App 掃描對方的 QR Code，或用下方的手動輸入。"
      />

      <details className="rounded-lg border border-gray-200 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          掃不到？改用手動輸入
        </summary>
        <div className="mt-3 flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="對方卡片下方的代碼"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5"
          />
          <button
            onClick={() => {
              const code = extractPersonalCode(manualCode);
              if (code) void submitCode(code);
              else setResult({ kind: "error", message: "代碼格式不正確" });
            }}
            className="tap-target rounded-lg bg-gray-900 px-4 font-medium text-white"
          >
            收集
          </button>
        </div>
      </details>
    </div>
  );
}
