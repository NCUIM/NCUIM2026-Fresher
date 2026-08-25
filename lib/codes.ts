import { randomBytes } from "node:crypto";

// 去除易混淆字元（0/O、1/I/L），因為 Entry Code 可能需要口頭唸出或手動輸入。
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomFrom(alphabet: string, length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Event 層級的註冊碼。短且可唸，供印製或投影。 */
export function generateEntryCode(): string {
  return randomFrom(ALPHABET, 8);
}

/**
 * Participant 的公開碼，供他人掃描。
 * 公開性質，但仍需夠長以避免被窮舉猜測後偽造收集。
 */
export function generatePersonalCode(): string {
  return randomFrom(ALPHABET, 12);
}

/**
 * 私密身分憑證，存於 HttpOnly cookie。
 * 絕不可與 personalCode 相同——見 ADR-0001。
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * 兩個 participant id 排序後串接，作為 Scan 的去重鍵。
 * 讓 A→B 與 B→A 被視為同一次相遇（Q29 的冪等要求）。
 */
export function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}
