"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { useCallback, useEffect, useRef, useState } from "react";

/** 相機不可用的原因，決定要顯示哪一種補救說明。 */
type CameraProblem = "denied" | "insecure" | "unsupported" | "failed";

type Phase = "idle" | "starting" | "running" | "failed";

type Props = {
  /** 掃到內容時呼叫。回傳 true 代表已接受，元件會停止掃描。 */
  onDecode: (text: string) => boolean | Promise<boolean>;
  /** 相機不可用時，補充說明要引導使用者做什麼。 */
  fallbackHint: string;
};

/**
 * QR 掃描相機。報到掃描與收集掃描共用同一份實作——兩者的相機權限處理、
 * 失敗分類與備援提示完全相同，分開寫只會讓其中一邊的修正漏掉另一邊。
 *
 * 刻意由使用者點按啟動，不在頁面載入時自動開啟：
 * iOS 對未經使用者動作的相機請求較不友善，而且權限對話框若沒跳出來，
 * 使用者只會看到一片空白，不知道要去哪裡允許權限。
 */
export function QrCamera({ onDecode, fallbackHint }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const busyRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  // 手機上沒有主控台可看，失敗時把真正的錯誤名稱留在畫面上，
  // 否則只能靠猜的。折疊起來，一般使用者不會被打擾。
  const [diagnostic, setDiagnostic] = useState<string | null>(null);

  // 卸載時務必關閉相機，否則鏡頭指示燈會一直亮著。
  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      busyRef.current = false;
    };
  }, []);

  const start = useCallback(async () => {
    setProblem(null);
    setPhase("starting");

    // getUserMedia 只在安全來源可用。localhost 算安全來源，但用手機連
    // 區域網路位址（http://192.168.x.x）不是——見 ADR-0004。
    if (!window.isSecureContext) {
      setProblem("insecure");
      setDiagnostic(`不是安全來源：${window.location.origin}`);
      setPhase("failed");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setProblem("unsupported");
      setDiagnostic(
        `此瀏覽器沒有 getUserMedia。UA：${navigator.userAgent.slice(0, 120)}`,
      );
      setPhase("failed");
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setProblem("failed");
      setPhase("failed");
      return;
    }

    /*
      iOS Safari 的自動播放政策看的是 HTML attribute，而 React 只會把
      muted 設成 DOM property。少了這個 attribute，串流接上了但影片播不起來，
      畫面一片黑而且不會拋任何錯——四種失敗提示一個都不會出現。
      這是 React 與 iOS 之間長期存在的落差，必須自己補上。
    */
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.muted = true;

    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        // 必須指定 facingMode: "environment"。讓函式庫自選會挑到預設裝置，
        // 在手機上通常是前鏡頭，拿來掃別人的碼完全不能用。
        { video: { facingMode: { ideal: "environment" } } },
        video,
        (decoded) => {
          if (!decoded || busyRef.current) return;
          busyRef.current = true;
          void Promise.resolve(onDecode(decoded.getText())).then((accepted) => {
            if (!accepted) busyRef.current = false;
          });
        },
      );
      controlsRef.current = controls;
      setPhase("running");
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "";
      const message = e instanceof Error ? e.message : String(e);
      setDiagnostic(`${name || "UnknownError"}：${message.slice(0, 160)}`);
      // NotAllowedError = 使用者拒絕或系統層級封鎖；
      // NotFoundError = 這台裝置沒有相機。兩者的補救方式不同。
      setProblem(
        name === "NotAllowedError" || name === "SecurityError"
          ? "denied"
          : name === "NotFoundError" || name === "OverconstrainedError"
            ? "unsupported"
            : "failed",
      );
      setPhase("failed");
    }
  }, [onDecode]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-void">
        {/*
          video 永遠留在 DOM 中，只是視情況隱藏——
          ZXing 需要一個已存在的元素才能接上串流，
          等按下按鈕才建立元素會來不及。
        */}
        <video
          ref={videoRef}
          className={`aspect-square w-full object-cover ${
            phase === "running" ? "" : "hidden"
          }`}
          autoPlay
          muted
          playsInline
        />

        {phase === "running" && (
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-neon/70" />
        )}

        {phase !== "running" && (
          <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 px-6 text-center">
            {phase === "starting" ? (
              <>
                <span className="px text-[11px] tracking-[0.2em] text-neon">
                  STARTING
                </span>
                <p className="text-sm text-dim">
                  正在啟動相機…
                  <br />
                  若跳出權限詢問請選擇「允許」
                </p>
              </>
            ) : phase === "failed" && problem ? (
              <CameraFallback
                problem={problem}
                hint={fallbackHint}
                onRetry={start}
                diagnostic={diagnostic}
              />
            ) : (
              <>
                <span className="text-4xl">◎</span>
                <button
                  onClick={start}
                  className="tap-target glow-neon rounded-sm bg-neon px-6 py-3 font-bold text-void"
                >
                  開啟相機
                </button>
                <p className="text-xs text-faint">會向你要求相機權限</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CameraFallback({
  problem,
  hint,
  onRetry,
  diagnostic,
}: {
  problem: CameraProblem;
  hint: string;
  onRetry: () => void;
  diagnostic: string | null;
}) {
  const titles: Record<CameraProblem, string> = {
    denied: "沒有相機權限",
    insecure: "這個連線無法使用相機",
    unsupported: "這個瀏覽器不支援相機掃描",
    failed: "相機啟動失敗",
  };
  const causes: Record<CameraProblem, string> = {
    denied: "請在瀏覽器設定中允許使用相機，然後再試一次。",
    insecure: "瀏覽器只允許在 https 網站使用相機。",
    unsupported: "從 LINE 或 Instagram 開啟時常會遇到這個狀況。",
    failed: "",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-bold text-moon">{titles[problem]}</p>
      <p className="text-xs text-moon/80">
        {causes[problem]}
        {causes[problem] && " "}
        {hint}
      </p>
      {problem !== "insecure" && (
        <button
          onClick={onRetry}
          className="tap-target mt-1 rounded-sm border border-moon px-4 py-2 text-sm text-moon"
        >
          再試一次
        </button>
      )}

      {diagnostic && (
        <details className="mt-1 w-full">
          <summary className="cursor-pointer text-[11px] text-faint">
            技術細節
          </summary>
          <p className="px mt-1 text-left text-[10px] leading-relaxed break-all text-faint">
            {diagnostic}
          </p>
        </details>
      )}
    </div>
  );
}
