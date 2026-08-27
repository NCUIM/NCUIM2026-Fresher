"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

/** 相機不可用的原因，決定要顯示哪一種補救說明。 */
type CameraProblem = "denied" | "insecure" | "unsupported" | "failed";

type Props = {
  /** 掃到內容時呼叫。回傳 true 代表已接受，元件會暫停掃描。 */
  onDecode: (text: string) => boolean | Promise<boolean>;
  /** 暫停掃描（例如正在顯示結果時）。 */
  paused?: boolean;
  /** 相機不可用時，補充說明要引導使用者做什麼。 */
  fallbackHint: string;
};

/**
 * QR 掃描相機。報到掃描與收集掃描共用同一份實作——兩者的相機權限處理、
 * 失敗分類與備援提示完全相同，分開寫只會讓其中一邊的修正漏掉另一邊。
 */
export function QrCamera({ onDecode, paused = false, fallbackHint }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const busyRef = useRef(false);
  const [problem, setProblem] = useState<CameraProblem | null>(null);

  useEffect(() => {
    if (paused) return;

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
      // 必須指定 facingMode: "environment"。讓函式庫自選會挑到預設裝置，
      // 在手機上通常是前鏡頭，拿來掃別人的碼完全不能用。
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (decoded) => {
          if (!decoded || busyRef.current) return;
          busyRef.current = true;
          void Promise.resolve(onDecode(decoded.getText())).then((accepted) => {
            if (!accepted) busyRef.current = false;
          });
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
      busyRef.current = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [paused, onDecode]);

  if (problem) {
    return <CameraFallback problem={problem} hint={fallbackHint} />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        className="aspect-square w-full object-cover"
        muted
        playsInline
      />
      <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
    </div>
  );
}

function CameraFallback({
  problem,
  hint,
}: {
  problem: CameraProblem;
  hint: string;
}) {
  const titles: Record<CameraProblem, string> = {
    denied: "沒有相機權限",
    insecure: "此連線無法使用相機",
    unsupported: "這個瀏覽器不支援相機掃描",
    failed: "相機啟動失敗",
  };
  const causes: Record<CameraProblem, string> = {
    denied: "請在瀏覽器設定中允許使用相機。",
    insecure: "瀏覽器只允許在 https 網站使用相機。",
    unsupported: "從 LINE 或 Instagram 開啟時常會遇到這個狀況。",
    failed: "",
  };

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-amber-50 px-4 py-4">
      <p className="font-medium text-amber-900">{titles[problem]}</p>
      <p className="text-sm text-amber-800">
        {causes[problem]}
        {causes[problem] && " "}
        {hint}
      </p>
    </div>
  );
}
