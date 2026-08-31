"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 投影畫面上的即時報到人數。
 *
 * 為什麼要輪詢而不是伺服器端渲染一次：這一頁會在投影幕上開著整場活動，
 * 而報到就是那段時間裡唯一在變的東西。一個不動的數字會讓人以為系統掛了
 * ——現場沒有人會想到要按重新整理。
 *
 * 五秒一次。人在看著數字跳，太慢會覺得沒反應；而報到尖峰也不過每分鐘
 * 幾個人，再快只是多打幾次資料庫。單一螢幕約 0.2 req/s。
 */
const POLL_MS = 5000;

/** 數字跳動後的高亮時間。夠久到能被注意到，短到不會蓋掉下一次。 */
const FLASH_MS = 1200;

export function CheckInCount({
  eventId,
  initial,
}: {
  eventId: string;
  /** 伺服器端算好的初值，避免畫面先閃一個 0 再跳到正確值。 */
  initial: number;
}) {
  const [count, setCount] = useState(initial);
  const [flash, setFlash] = useState(false);
  const previous = useRef(initial);

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const res = await fetch(`/api/admin/events/${eventId}`, {
          // 投影頁會開很久，不要讓瀏覽器拿舊的回應充數。
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: { participants?: number } = await res.json();
        if (!alive || typeof data.participants !== "number") return;
        setCount(data.participants);
      } catch {
        // 現場網路不穩是常態，靜默略過等下一次即可。
      }
    }

    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [eventId]);

  /*
    只在「變多」時高亮。人數理論上不會減少，但主辦方清掉壓測資料時會，
    而那不是值得在投影幕上慶祝的事。
  */
  useEffect(() => {
    if (count > previous.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), FLASH_MS);
      previous.current = count;
      return () => clearTimeout(timer);
    }
    previous.current = count;
  }, [count]);

  return (
    <span
      className={
        flash
          ? "text-glow-neon text-neon transition-colors duration-300"
          : "transition-colors duration-1000"
      }
    >
      {count}
    </span>
  );
}
