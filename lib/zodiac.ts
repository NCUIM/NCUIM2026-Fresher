/**
 * 星座選項。
 *
 * 用固定清單而非自由輸入：星座只有十二個，開放輸入只會得到
 * 「射手」「射手座」「Sagittarius」三種寫法，之後想做「同星座」
 * 這類玩法時就對不起來了。
 */
export const ZODIAC_SIGNS = [
  { key: "aries", label: "牡羊座", emoji: "♈", range: "3/21–4/19" },
  { key: "taurus", label: "金牛座", emoji: "♉", range: "4/20–5/20" },
  { key: "gemini", label: "雙子座", emoji: "♊", range: "5/21–6/21" },
  { key: "cancer", label: "巨蟹座", emoji: "♋", range: "6/22–7/22" },
  { key: "leo", label: "獅子座", emoji: "♌", range: "7/23–8/22" },
  { key: "virgo", label: "處女座", emoji: "♍", range: "8/23–9/22" },
  { key: "libra", label: "天秤座", emoji: "♎", range: "9/23–10/23" },
  { key: "scorpio", label: "天蠍座", emoji: "♏", range: "10/24–11/22" },
  { key: "sagittarius", label: "射手座", emoji: "♐", range: "11/23–12/21" },
  { key: "capricorn", label: "摩羯座", emoji: "♑", range: "12/22–1/19" },
  { key: "aquarius", label: "水瓶座", emoji: "♒", range: "1/20–2/18" },
  { key: "pisces", label: "雙魚座", emoji: "♓", range: "2/19–3/20" },
] as const;

export const UNIVERSITY_MAX = 20;

const BY_KEY = new Map(ZODIAC_SIGNS.map((z) => [z.key as string, z]));

export function zodiacByKey(key: string | null | undefined) {
  return key ? BY_KEY.get(key) : undefined;
}

export function isValidZodiacKey(key: string): boolean {
  return BY_KEY.has(key);
}
