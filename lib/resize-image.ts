import { AVATAR_MAX_DIMENSION } from "./image";

/**
 * 在瀏覽器端把照片縮到頭像尺寸後再上傳。
 *
 * 手機拍的照片動輒 3～5MB，在活動現場的擁擠網路下直接上傳會卡很久甚至逾時。
 * 縮到 400px 的 JPEG 之後通常只剩 40～60KB，上傳幾乎是瞬間的事。
 *
 * 這也是伺服器端容量限制得以設得很小的前提——正常流程送上來的檔案本來就小。
 */
export async function resizeToAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(
    1,
    AVATAR_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法處理圖片");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82),
  );
  if (!blob) throw new Error("圖片轉換失敗");
  return blob;
}
