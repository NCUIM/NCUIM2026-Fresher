/**
 * 預設頭像。檔案放在 public/avatars/<套組>/<套組>_NN.png。
 *
 * 這個模組沒有任何匯入，客戶端元件可以安全使用——選擇器需要它，
 * 而選擇器是互動元件。
 *
 * 清單寫死而不是在執行期掃目錄：目錄掃描要走伺服器，選擇器就得先發一次
 * 請求才畫得出來；而這份清單只有在有人新增圖檔時才會變，那時本來就要動程式。
 */
export type AvatarSet = { key: string; label: string; count: number };

export const AVATAR_SETS: AvatarSet[] = [
  { key: "anime", label: "動漫", count: 16 },
  { key: "slime-up", label: "史萊姆", count: 15 },
];

/** 依套組與編號組出路徑。編號補零到兩位，與檔名一致。 */
export function presetAvatarPath(set: string, n: number): string {
  return `/avatars/${set}/${set}_${String(n).padStart(2, "0")}.png`;
}

export const PRESET_AVATARS: string[] = AVATAR_SETS.flatMap((s) =>
  Array.from({ length: s.count }, (_, i) => presetAvatarPath(s.key, i + 1)),
);

const PRESET_SET = new Set(PRESET_AVATARS);

/**
 * 是否為我們提供的預設頭像。
 *
 * ⚠️ 存 avatarUrl 前必須通過這個檢查。少了它，任何人都能把 avatarUrl
 * 設成外部網址——那張圖會出現在每一個收集過他的人的卡片上，
 * 等於一個可以隨時抽換內容、而且我們管不到的圖床。
 */
export function isPresetAvatar(url: string): boolean {
  return PRESET_SET.has(url);
}
