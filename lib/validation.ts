import { z } from "zod";
import type { AchievementType, Role } from "@prisma/client";
import { isValidIconKey, REQUIRED_ICON_COUNT } from "./icons";
import { isValidZodiacKey, UNIVERSITY_MAX } from "./zodiac";

export const NICKNAME_MAX = 20;
export const REAL_NAME_MAX = 20;
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
  /*
    姓名為必填，但只給工作人員看。現場核對、簽到表與獎品發放都需要真名，
    而暱稱在那些場合對應不到人。

    它刻意不進入 CardView（見 lib/cards.ts）——那份手寫白名單就是
    對外呈現的唯一出口，姓名不加進去就不會外流到卡片、牆或排行榜上。
  */
  realName: z.string().trim().min(1, "請輸入姓名").max(REAL_NAME_MAX),
  socialUrl: httpsUrl.optional().nullable(),
  /*
    自我介紹為必填。它是卡片上最能製造話題的一欄——沒有它，
    一張卡片只剩暱稱和三個圖示，別人看了不知道能聊什麼。

    資料庫欄位仍為可空：既有的 24 筆裡有 6 筆沒有自我介紹，
    改成 NOT NULL 得先回填才不會讓它們變成不合法的資料。
    在這裡驗證的效果相同——他們下次編輯個人資料時就必須補上。
  */
  bio: z.string().trim().min(1, "請寫一句自我介紹").max(BIO_MAX),
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

/*
  成就類型的字面值。刻意不從 @prisma/client 匯入 enum 取值——
  那是執行期的值，會把整個資料庫驅動帶進瀏覽器套件（SHOWCASE_SIZE 踩過）。
  satisfies 讓型別層仍與 Prisma 的 enum 對齊：那邊增修而這裡沒跟上，編譯就會失敗。
*/
export const ACHIEVEMENT_TYPES = [
  "SCAN_COUNT",
  "COLLECTED_COUNT",
  "EARLY_SCAN",
  "SCAN_ROLE",
  "TEAM_COLLECT",
] as const satisfies readonly AchievementType[];

export const ACHIEVEMENT_ROLES = [
  "PARTICIPANT",
  "STAFF",
] as const satisfies readonly Role[];

/** TEAM_COLLECT 用 -1 表示「全部隊員」，以達成當下的隊伍人數認定。 */
export const TEAM_COLLECT_ALL = -1;

export const achievementSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, "請輸入代號")
      .max(40)
      .regex(/^[a-z0-9-]+$/, "代號只能用小寫英文、數字與連字號"),
    type: z.enum(ACHIEVEMENT_TYPES),
    threshold: z.number().int("門檻必須是整數"),
    points: z.number().int().min(0, "分數不能為負"),
    hidden: z.boolean(),
    title: z.string().trim().min(1, "請輸入名稱").max(30),
    description: z.string().trim().max(60).optional().nullable(),
    targetRole: z.enum(ACHIEVEMENT_ROLES).optional().nullable(),
  })
  .refine(
    (v) => v.type !== "SCAN_ROLE" || Boolean(v.targetRole),
    { message: "掃描特定身分的成就必須指定對象身分", path: ["targetRole"] },
  )
  .refine(
    // -1 只對 TEAM_COLLECT 有意義；其他類型的 0 或負數是永遠達成或永遠達不成。
    (v) => v.threshold >= 1 || (v.type === "TEAM_COLLECT" && v.threshold === TEAM_COLLECT_ALL),
    { message: "門檻至少要是 1（集齊全隊可填 -1）", path: ["threshold"] },
  );

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
