/**
 * 個性化圖示庫。使用者從中挑選三個，純裝飾用途，不具任何功能意義。
 * 採用 emoji 而非圖檔：跨平台可用、零載入成本、不需要儲存空間。
 */
export const ICON_LIBRARY = [
  { key: "music", emoji: "🎵", label: "音樂" },
  { key: "game", emoji: "🎮", label: "遊戲" },
  { key: "movie", emoji: "🎬", label: "電影" },
  { key: "book", emoji: "📚", label: "閱讀" },
  { key: "sport", emoji: "⚽", label: "運動" },
  { key: "food", emoji: "🍜", label: "美食" },
  { key: "coffee", emoji: "☕", label: "咖啡" },
  { key: "travel", emoji: "✈️", label: "旅行" },
  { key: "camera", emoji: "📷", label: "攝影" },
  { key: "art", emoji: "🎨", label: "繪畫" },
  { key: "code", emoji: "💻", label: "程式" },
  { key: "pet", emoji: "🐱", label: "寵物" },
  { key: "plant", emoji: "🌱", label: "植物" },
  { key: "star", emoji: "⭐", label: "追星" },
  { key: "sleep", emoji: "😴", label: "睡覺" },
  { key: "gym", emoji: "🏋️", label: "健身" },
] as const;

export const ICON_KEYS = ICON_LIBRARY.map((i) => i.key);

export const REQUIRED_ICON_COUNT = 3;

const BY_KEY = new Map(ICON_LIBRARY.map((i) => [i.key as string, i]));

export function iconByKey(key: string) {
  return BY_KEY.get(key);
}

export function isValidIconKey(key: string): boolean {
  return BY_KEY.has(key);
}
