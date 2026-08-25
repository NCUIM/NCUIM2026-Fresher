import { z } from "zod";
import { isValidIconKey, REQUIRED_ICON_COUNT } from "./icons";

export const NICKNAME_MAX = 20;
export const BIO_MAX = 50;
export const IMPRESSION_MAX = 50;

/** 只接受 https，避免在卡片上放出混合內容或不安全連結。 */
const httpsUrl = z
  .string()
  .trim()
  .refine(
    (v) => {
      try {
        return new URL(v).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "請提供 https 開頭的網址" },
  );

export const profileSchema = z.object({
  nickname: z.string().trim().min(1, "請輸入暱稱").max(NICKNAME_MAX),
  socialUrl: httpsUrl.optional().nullable(),
  bio: z.string().trim().max(BIO_MAX).optional().nullable(),
  icons: z
    .array(z.string())
    .length(REQUIRED_ICON_COUNT, `請選擇 ${REQUIRED_ICON_COUNT} 個圖示`)
    .refine((keys) => keys.every(isValidIconKey), { message: "圖示不存在" })
    .refine((keys) => new Set(keys).size === keys.length, {
      message: "圖示不可重複",
    }),
});

export const joinSchema = profileSchema.extend({
  entryCode: z.string().trim().min(1),
  passcode: z.string().trim().min(1, "請輸入活動通關碼"),
});

export const impressionSchema = z.object({
  subjectId: z.string().min(1),
  text: z.string().trim().min(1, "請寫下一段話").max(IMPRESSION_MAX),
});

/** 把 zod 的錯誤攤平成單一訊息，方便直接顯示在表單上。 */
export function firstErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "輸入內容有誤";
}
