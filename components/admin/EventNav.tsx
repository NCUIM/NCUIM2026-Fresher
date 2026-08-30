import Link from "next/link";
import { eventNavItems, type EventNavKey } from "./event-nav-items";
import { EventMenu } from "./EventMenu";

/**
 * 單一活動後台的功能選單。
 *
 * 兩種形態並存：頂端的卡片格在剛進頁面時一目了然；右下角的浮動按鈕
 * 則在捲到頁面深處時仍然構得到——後台的頁面很長，捲到一半想換頁
 * 不該還要先捲回最上面。
 */
export function EventNav({
  eventId,
  eventName,
  current,
  mailProblems = 0,
}: {
  eventId: string;
  eventName: string;
  current: EventNavKey;
  /** 有寄信失敗時讓紀錄那一項亮起來——沒有人會主動去翻紀錄頁。 */
  mailProblems?: number;
}) {
  const items = eventNavItems(eventId);

  return (
    <>
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item) => {
          const active = item.key === current;
          const alert = item.key === "logs" && mailProblems > 0;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`tap-target flex flex-col items-start rounded-lg border-2 px-3 py-2 transition-colors ${
                active
                  ? "border-neon bg-neon/10"
                  : alert
                    ? "border-flare/60 bg-flare/10 hover:bg-flare/15"
                    : "border-line hover:border-neon/60 hover:bg-slate"
              }`}
            >
              <span
                className={`flex items-center gap-1.5 text-sm font-bold ${
                  active ? "text-neon" : alert ? "text-flare" : ""
                }`}
              >
                {item.label}
                {alert && (
                  <span className="rounded-full bg-flare px-1.5 text-[10px] text-void">
                    {mailProblems}
                  </span>
                )}
              </span>
              <span className="text-[11px] text-faint">{item.hint}</span>
            </Link>
          );
        })}
      </nav>

      <EventMenu
        eventId={eventId}
        eventName={eventName}
        current={current}
        mailProblems={mailProblems}
      />
    </>
  );
}
