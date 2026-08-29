import { randomBytes } from "node:crypto";
import { ENTRY_CODE_LENGTH, PERSONAL_CODE_LENGTH } from "./parse-code";

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

/**
 * Event 層級的註冊碼。短且可唸，供印製或投影。
 *
 * 長度是有意義的：手動輸入時，程式只能靠長度分辨這是註冊碼還是個人碼。
 * 自訂註冊碼若不是 ENTRY_CODE_LENGTH 個字元，手動輸入那條路會認不得它。
 */
export function generateEntryCode(): string {
  return randomFrom(ALPHABET, ENTRY_CODE_LENGTH);
}

/**
 * Participant 的公開碼，供他人掃描。
 * 公開性質，但仍需夠長以避免被窮舉猜測後偽造收集。
 */
export function generatePersonalCode(): string {
  return randomFrom(ALPHABET, PERSONAL_CODE_LENGTH);
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
