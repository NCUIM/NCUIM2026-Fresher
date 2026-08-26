"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CardView } from "@/lib/cards";
import { extractPersonalCode } from "@/lib/parse-code";
import { CardDisplay } from "@/components/CardDisplay";

type Result =
  | { kind: "collected"; card: CardView; duplicate: boolean }
  | { kind: "error"; message: string };

/** 相機不可用的原因，決定要顯示哪一種補救說明。 */
type CameraProblem = "denied" | "insecure" | "unsupported" | "failed";

export function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const busyRef = useRef(false);

  const [result, setResult] = useState<Result | null>(null);
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [manualCode, setManualCode] = useState("");

  const submitCode = useCallback(async (personalCode: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
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
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    // 掃到結果並顯示卡片時暫停相機，避免持續重複觸發。
    if (result) return;

    // getUserMedia 只在安全來源可用。localhost 算安全來源，但用手機連
    // 區域網路位址（http://192.168.x.x）不是——見 ADR-0004。
    if (!window.isSecureContext) {
      setProblem("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem("unsupported");
      return;
    }

    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    reader
      // 必須用 decodeFromConstraints 指定 facingMode: "environment"。
      // decodeFromVideoDevice 傳 undefined 會挑預設裝置，在手機上通常是
      // 前鏡頭，拿來掃別人的 QR Code 完全不能用。
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (decoded) => {
          if (!decoded || busyRef.current) return;
          const code = extractPersonalCode(decoded.getText());
          if (code) void submitCode(code);
        },
      )
      .then((controls) => {
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setProblem(null);
      })
      .catch((e: unknown) => {
        const name = e instanceof Error ? e.name : "";
        setProblem(name === "NotAllowedError" ? "denied" : "failed");
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [result, submitCode]);

  function scanAgain() {
    setResult(null);
  }

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
          onClick={scanAgain}
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

      {problem ? (
        <CameraFallback problem={problem} />
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            className="aspect-square w-full object-cover"
            muted
            playsInline
          />
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
        </div>
      )}

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

function CameraFallback({ problem }: { problem: CameraProblem }) {
  const messages: Record<CameraProblem, { title: string; body: string }> = {
    denied: {
      title: "沒有相機權限",
      body: "請在瀏覽器設定中允許使用相機，或改用手機內建的相機 App 掃描對方的 QR Code。",
    },
    insecure: {
      title: "此連線無法使用相機",
      body: "瀏覽器只允許在 https 網站使用相機。請改用手機內建的相機 App 掃描。",
    },
    unsupported: {
      title: "這個瀏覽器不支援相機掃描",
      body: "從 LINE 或 Instagram 開啟時常會遇到這個狀況。請改用手機內建的相機 App 掃描對方的 QR Code，或用下方的手動輸入。",
    },
    failed: {
      title: "相機啟動失敗",
      body: "請改用手機內建的相機 App 掃描對方的 QR Code，或用下方的手動輸入。",
    },
  };
  const { title, body } = messages[problem];

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-amber-50 px-4 py-4">
      <p className="font-medium text-amber-900">{title}</p>
      <p className="text-sm text-amber-800">{body}</p>
    </div>
  );
}
