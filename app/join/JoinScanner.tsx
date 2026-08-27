"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { extractEntryCode, looksLikePersonalCode } from "@/lib/parse-code";
import { QrCamera } from "@/components/QrCamera";

/**
 * 掃描報到碼。與收集掃描分開的原因：
 * 兩者掃到的是不同種類的碼，混在一起時使用者拿到的錯誤訊息會很難懂。
 */
export function JoinScanner() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  const go = useCallback(
    (code: string) => {
      router.push(`/join/${code}`);
    },
    [router],
  );

  const handleDecode = useCallback(
    (text: string) => {
      const code = extractEntryCode(text);
      if (code) {
        go(code);
        return true;
      }
      // 掃到別人的個人碼是很容易發生的誤會，直接說清楚差別。
      if (looksLikePersonalCode(text)) {
        setMessage("這是別人的個人碼，不是報到碼。請找主辦方提供的報到 QR Code。");
        return false;
      }
      return false; // 不相關的 QR，安靜地繼續掃
    },
    [go],
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">掃描報到碼</h1>
        <p className="text-sm text-gray-500">
          對準主辦方投影或張貼的報到 QR Code。
        </p>
      </header>

      <QrCamera
        onDecode={handleDecode}
        fallbackHint="請改用手機內建的相機 App 掃描報到 QR Code，或在下方直接輸入代碼。"
      />

      {message && (
        <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {message}
        </p>
      )}

      <details className="rounded-lg border border-gray-200 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">
          掃不到？直接輸入報到碼
        </summary>
        <div className="mt-3 flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="例如 JOINNCU1"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5"
          />
          <button
            onClick={() => {
              const code = extractEntryCode(manual);
              if (code) go(code);
              else setMessage("代碼格式不正確，請再確認一次。");
            }}
            className="tap-target rounded-lg bg-gray-900 px-4 font-medium text-white"
          >
            前往
          </button>
        </div>
      </details>
    </div>
  );
}
