"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** 主要動作，選中時用洋紅而非青綠標示。 */
  primary?: boolean;
  /** 待辦數量，顯示為紅點徽章。 */
  badge?: number;
};

/**
 * 底部導覽列。
 *
 * 五個項目，順序刻意如此：出示與掃描並列在中間，因為兩人相遇時
 * 一個要出示、一個要掃描，兩者都必須一鍵可達，而且要在拇指最容易
 * 碰到的位置。
 *
 * 「寫短評」取代了原本的成就位置——寫短評是基礎分入帳的必要條件，
 * 但它先前只有 /me 上的一張提示卡可以進入，很多人整場都不會發現。
 * 成就與排行榜移到 /me 的次要入口。
 *
 * 最後兩項是同一個機制的兩面：「寫短評」是我寫給別人的（所以有待辦徽章），
 * 「浮光牆」是別人寫給我的。
 */
export function BottomNav({
  pendingImpressions = 0,
  unreadAnnouncements = 0,
}: {
  pendingImpressions?: number;
  unreadAnnouncements?: number;
}) {
  const pathname = usePathname();

  const items: NavItem[] = [
    // 公告的未讀掛在「個人頁面」上——公告的入口在 /me，
    // 而集合時間變更這種資訊必須在任何頁面都看得到。
    { href: "/me", label: "個人頁面", icon: "◈", badge: unreadAnnouncements },
    { href: "/code", label: "QRCode", icon: "▣" },
    { href: "/scan", label: "掃描", icon: "◎", primary: true },
    { href: "/write", label: "寫短評", icon: "✎", badge: pendingImpressions },
    { href: "/wall", label: "浮光牆", icon: "✉" },
  ];

  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-night/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {items.map((item) => {
          const active = pathname === item.href;
          const badge = item.badge ?? 0;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={
                  badge > 0 ? `${item.label}，${badge} 項待處理` : item.label
                }
                className={`tap-target relative flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                  active
                    ? item.primary
                      ? "text-flare"
                      : "text-neon"
                    : "text-faint"
                }`}
              >
                <span
                  className={`text-lg leading-none ${
                    active
                      ? item.primary
                        ? "text-glow-flare"
                        : "text-glow-neon"
                      : ""
                  }`}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="text-[10px] leading-none">{item.label}</span>

                {badge > 0 && (
                  <span
                    aria-hidden="true"
                    className="px absolute top-0.5 right-1/2 grid size-4 -translate-x-3 place-items-center rounded-full bg-flare text-[9px] leading-none text-void"
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
