import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

/** 匯出供 Route Handler 直接在回應上設定 cookie 時使用。 */
export const SESSION_COOKIE = "pid";
const COOKIE_NAME = SESSION_COOKIE;

/**
 * 身分憑證存於 HttpOnly cookie 而非 localStorage，理由有二：
 *
 * 1. HttpOnly 讓 JavaScript 讀不到，XSS 無法竊取身分。
 * 2. ITP 的七天清除針對的是「script-writable storage」——localStorage、
 *    IndexedDB 與經由 document.cookie 寫入的 cookie。由伺服器設定的
 *    HttpOnly cookie 不屬於此類，存活時間較長。這不代表能完全免疫，
 *    ADR-0001 所述的 email 找回機制仍須補上，但用 cookie 是嚴格較優的選擇。
 */
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 天，涵蓋活動後的 14 天查看期

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * ⚠️ 只能在 Route Handler 或 Server Function 中呼叫。
 * Next.js 不允許在 Server Component 渲染期間設定 cookie——不會報錯，
 * 但 Set-Cookie 不會送出，症狀是「看起來成功了，實際上沒登入」。
 */
export async function setSessionCookie(sessionToken: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sessionToken, sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** 取得目前登入的 Participant，未登入則回傳 null。 */
/**
 * 目前登入的 Participant。
 *
 * 用 React 的 cache 包起來：一次請求裡不管被呼叫幾次，資料庫只查一次。
 *
 * 這不是可有可無的最佳化。這個函式散在三十個檔案裡，而伺服器元件是
 * 各自獨立取資料的——外框 NavShell 要它、頁面本身要它、頁面裡的元件
 * 也要它。實測 /me 一次載入打了七次 Participant 查詢，全部是同一列。
 * 資料庫在新加坡、函式在別的區域時，每一次都是一趟跨海往返。
 *
 * cache 的範圍是「單一請求」，所以不會有跨使用者拿到別人資料的問題。
 */
export const getCurrentParticipant = cache(async () => {
  const token = await getSessionToken();
  if (!token) return null;

  return prisma.participant.findUnique({
    where: { sessionToken: token },
    include: { event: true, team: true },
  });
});
