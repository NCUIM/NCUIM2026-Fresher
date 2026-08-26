/**
 * 從掃描結果取出 Personal Code。
 *
 * QR 的內容是一組網址（例如 https://host/c/AB12CD34），這是為了讓手機
 * 原生相機也能直接開啟完成收集。但網頁內建掃描器拿到的是整串網址，
 * 必須取出其中的代碼再送去 API。
 *
 * 也接受純代碼字串，讓手動輸入的補救路徑走同一套邏輯。
 */
export function extractPersonalCode(scanned: string): string | null {
  const raw = scanned.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const segments = url.pathname.split("/").filter(Boolean);
    // 只接受 /c/<code> 這個路徑，避免把任意網址誤判為卡片。
    if (segments.length >= 2 && segments[segments.length - 2] === "c") {
      return segments[segments.length - 1].toUpperCase();
    }
    return null;
  } catch {
    // 不是網址，視為手動輸入的純代碼。
    return /^[A-Za-z0-9]+$/.test(raw) ? raw.toUpperCase() : null;
  }
}
