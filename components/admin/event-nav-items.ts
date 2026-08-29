/**
 * 單一活動後台的功能清單。
 *
 * 抽出來讓頂端的卡片選單與浮動側欄共用同一份——兩處各寫一次的話，
 * 新增頁面時一定會漏掉其中一邊，而漏掉的那邊使用者根本到不了。
 */
export type EventNavKey =
  | "overview"
  | "leaderboard"
  | "display"
  | "codes"
  | "logs";

export type EventNavItem = {
  key: EventNavKey;
  href: string;
  label: string;
  hint: string;
};

export function eventNavItems(eventId: string): EventNavItem[] {
  const base = `/admin/events/${eventId}`;
  return [
    { key: "overview", href: base, label: "總覽", hint: "設定・成就・參與者" },
    { key: "leaderboard", href: `${base}/leaderboard`, label: "排行榜", hint: "完整排名" },
    { key: "display", href: `${base}/display`, label: "投影畫面", hint: "現場大螢幕" },
    { key: "codes", href: `${base}/codes`, label: "報到碼", hint: "列印用" },
    { key: "logs", href: `${base}/logs`, label: "系統紀錄", hint: "寄信結果" },
  ];
}
