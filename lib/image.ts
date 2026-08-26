export const MAX_AVATAR_BYTES = 512 * 1024;

/** 前端會把照片壓到約 400px 寬，實際大小通常在 50KB 上下。 */
export const AVATAR_MAX_DIMENSION = 400;

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * 以檔案開頭的位元組判斷實際格式。
 *
 * 不能只信 Content-Type——那是上傳端自己宣告的，任何檔案都能標成 image/jpeg。
 * 檢查魔術位元組才能確保存進資料庫、之後又被當成影像送給所有人的東西
 * 真的是影像。
 */
export function sniffImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  // RIFF....WEBP
  const ascii = (i: number) => String.fromCharCode(bytes[i]);
  if (
    ascii(0) + ascii(1) + ascii(2) + ascii(3) === "RIFF" &&
    ascii(8) + ascii(9) + ascii(10) + ascii(11) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function isAllowedImageType(type: string | null): type is string {
  return type !== null && ALLOWED.has(type);
}
