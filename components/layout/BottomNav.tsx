"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 底部導覽列。
 *
 * 五個項目，順序刻意如此：出示與掃描並列在中間，因為兩人相遇時
 * 一個要出示、一個要掃描，兩者都必須一鍵可達，而且要在拇指最容易
 * 碰到的位置。
 *
 * 公告不放這裡——它有時效性但不是持續使用的功能，改用頁首的未讀標記。
 */
type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** 主要動作，選中時用洋紅而非青綠標示。 */
  primary?: boolean;
};

const ITEMS: NavItem[] = [
  { href: "/me", label: "我的", icon: "◈" },
  { href: "/code", label: "我的碼", icon: "▣" },
  { href: "/scan", label: "掃描", icon: "◎", primary: true },
  { href: "/achievements", label: "成就", icon: "✦" },
  { href: "/wall", label: "牆", icon: "✉" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="主要導覽"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-night/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`tap-target flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
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
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * 有底部導覽列的頁面用這個外框，確保內容不被導覽列蓋住。
 * 直接在頁面寫 padding 很容易漏掉，集中在一處比較不會出錯。
 */
export function NavShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div
        className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-7"
        style={{ paddingBottom: "calc(var(--nav-h) + var(--safe-bottom) + 1rem)" }}
      >
        {children}
      </div>
      <BottomNav />
    </>
  );
}
