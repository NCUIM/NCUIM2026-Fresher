/**
 * 從掃描結果取出 Personal Code。
 *
 * QR 的內容是一組網址（例如 https://host/c/AB12CD34），這是為了讓手機
 * 原生相機也能直接開啟完成收集。但網頁內建掃描器拿到的是整串網址，
 * 必須取出其中的代碼再送去 API。
 *
 * 也接受純代碼字串，讓手動輸入的補救路徑走同一套邏輯。
 */
/**
 * 兩種代碼的長度。定義在這裡而不是 lib/codes.ts，是因為本檔案沒有任何
 * 匯入，客戶端元件可以安全取用；lib/codes.ts 匯入了 node:crypto，
 * 從瀏覽器端取值會把它打包進去。產生代碼的那一端反過來引用這裡。
 */
export const ENTRY_CODE_LENGTH = 8;
export const PERSONAL_CODE_LENGTH = 12;

function extractAfterSegment(
  scanned: string,
  segment: string,
  plainLength: number,
): string | null {
  const raw = scanned.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    // 檢查倒數第二段，避免把任意網址誤判成本系統的代碼。
    if (parts.length >= 2 && parts[parts.length - 2] === segment) {
      return parts[parts.length - 1].toUpperCase();
    }
    return null;
  } catch {
    /*
      不是網址，視為手動輸入的純代碼。

      這裡沒有路徑可看，只能靠長度區分兩種代碼。少了這道檢查，
      兩個 extract 函式對同一串輸入會回傳**完全相同的值**，
      呼叫端就無從得知使用者輸入的是報到碼還是個人碼——
      下面那句「明確區分才能給出精準提示」的承諾在手動輸入時會落空。
    */
    if (raw.length !== plainLength) return null;
    return /^[A-Za-z0-9]+$/.test(raw) ? raw.toUpperCase() : null;
  }
}

/** 從掃描結果取出 Personal Code（收集用，網址形如 /c/<code>）。 */
export function extractPersonalCode(scanned: string): string | null {
  return extractAfterSegment(scanned, "c", PERSONAL_CODE_LENGTH);
}

/**
 * 從掃描結果取出 Entry Code（報到用，網址形如 /join/<code>）。
 *
 * 兩者刻意分開判斷：掃到別人的個人碼卻被當成報到碼（或反過來）會產生
 * 難以理解的錯誤，明確區分才能給出「這是收集用的碼，不是報到碼」這種提示。
 */
export function extractEntryCode(scanned: string): string | null {
  return extractAfterSegment(scanned, "join", ENTRY_CODE_LENGTH);
}

/** 判斷掃到的是不是個人碼——用於在報到頁給出更精準的提示。 */
export function looksLikePersonalCode(scanned: string): boolean {
  return extractPersonalCode(scanned) !== null && !scanned.includes("/join/");
}
