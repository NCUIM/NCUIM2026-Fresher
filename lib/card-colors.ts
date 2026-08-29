/**
 * 卡片底色。報到時自己選，之後別人收集到你時看到的就是這個顏色。
 *
 * 用固定色票而不是自由選色：全彩選擇器在深色介面上很容易被選出
 * 讀不到字的組合，而卡片上要放暱稱與自我介紹。這裡每一組都先配好，
 * 底色與文字色一起定義。
 *
 * 值直接存十六進位而不是 Tailwind 類名——類名要在建置期就能被掃到，
 * 動態組出來的 `bg-${key}` 不會被產生出來。
 */
export type CardColor = {
  key: string;
  label: string;
  /** 卡面底色 */
  bg: string;
  /** 邊框與強調色 */
  accent: string;
};

export const CARD_COLORS: CardColor[] = [
  { key: "midnight", label: "午夜", bg: "#111a2e", accent: "#4a7dff" },
  { key: "neon", label: "霓虹", bg: "#0d2420", accent: "#2ce8b5" },
  { key: "flare", label: "焰紅", bg: "#2a0f1a", accent: "#ff2e63" },
  { key: "moon", label: "月光", bg: "#2a2412", accent: "#ffce5c" },
  { key: "violet", label: "紫電", bg: "#1e1233", accent: "#a066ff" },
  { key: "forest", label: "深林", bg: "#122417", accent: "#4ade80" },
  { key: "slate", label: "石墨", bg: "#1a1d26", accent: "#94a3b8" },
  { key: "rose", label: "薔薇", bg: "#2b1420", accent: "#fb7185" },
];

export const DEFAULT_CARD_COLOR = CARD_COLORS[0];

export function cardColorByKey(key: string | null | undefined): CardColor {
  if (!key) return DEFAULT_CARD_COLOR;
  return CARD_COLORS.find((c) => c.key === key) ?? DEFAULT_CARD_COLOR;
}

export function isValidCardColor(key: string): boolean {
  return CARD_COLORS.some((c) => c.key === key);
}
