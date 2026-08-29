import Link from "next/link";

/**
 * 「這裡可以改」的統一標示：外框 ＋ 鉛筆圖示。
 *
 * 先前的編輯入口是幾個底線文字，散在頁面各處、樣式也不一致——
 * 底線在深色介面裡本來就不顯眼，而且和一般連結長得一樣，
 * 看不出哪些是「會改到自己資料」的動作。
 *
 * 統一成有框的按鈕樣式，是為了讓可編輯的地方在掃視時就跳出來。
 */
export function EditLink({
  href,
  label = "編輯",
  tone = "neutral",
}: {
  href: string;
  label?: string;
  /** neon 用於使用者主動想改的東西，neutral 用於次要入口。 */
  tone?: "neutral" | "neon";
}) {
  return (
    <Link
      href={href}
      className={`tap-target inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-3 py-1 text-xs transition-colors ${
        tone === "neon"
          ? "border-neon text-neon hover:bg-neon hover:text-void"
          : "border-line text-dim hover:border-neon/50 hover:text-chalk"
      }`}
    >
      <span aria-hidden="true">✎</span>
      {label}
    </Link>
  );
}
