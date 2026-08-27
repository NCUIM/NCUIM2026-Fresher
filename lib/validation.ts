import { z } from "zod";
import { isValidIconKey, REQUIRED_ICON_COUNT } from "./icons";
import { isValidZodiacKey, UNIVERSITY_MAX } from "./zodiac";

export const NICKNAME_MAX = 20;
export const BIO_MAX = 50;
export const IMPRESSION_MAX = 50;

/**
 * 九宮格格數。放在這裡而不是 lib/showcase.ts，是因為 client component
 * 需要用到它——而 lib/showcase.ts 匯入了 Prisma，從前端取值匯入會把
 * 整個資料庫驅動打包進瀏覽器套件，建置時就會因為找不到 net/dns/fs 而失敗。
 */
export const SHOWCASE_SIZE = 9;

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

/**
 * 信箱為選填。Q20 決定採非阻斷式提醒：沒填或打錯都不影響報到與收集，
 * 只是會在頁面上持續顯示未驗證提示，讓人有一整天的時間發現並修正。
 */
const email = z
  .string()
  .trim()
  .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
    message: "信箱格式不正確",
  });

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
  email: email.optional().nullable(),
  zodiac: z
    .string()
    .refine(isValidZodiacKey, { message: "星座不存在" })
    .optional()
    .nullable(),
  university: z.string().trim().max(UNIVERSITY_MAX).optional().nullable(),
});

export const recoveryRequestSchema = z.object({ email });

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
