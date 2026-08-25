import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "pid";

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

export async function setSessionCookie(sessionToken: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
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
export async function getCurrentParticipant() {
  const token = await getSessionToken();
  if (!token) return null;

  return prisma.participant.findUnique({
    where: { sessionToken: token },
    include: { event: true, team: true },
  });
}
