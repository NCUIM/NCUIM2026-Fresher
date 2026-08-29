import { Avatar } from "@/components/card/Avatar";

/**
 * 九宮格裡一個人的呈現：頭像 ＋ 暱稱。
 *
 * 抽成共用元件是因為 /me 與 /showcase 曾經各畫各的，結果兩邊長得不一樣、
 * 而且 /me 那份還漏掉了頭像與空格位置。同一個東西在兩個地方各寫一次，
 * 就一定會走鐘。
 *
 * 沒有 hook 也沒有事件處理，所以伺服器元件與客戶端元件都能直接用。
 */
export function SlotFace({
  nickname,
  avatarUrl,
  avatarClass = "size-11",
}: {
  nickname: string;
  avatarUrl: string | null;
  avatarClass?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5">
      <Avatar src={avatarUrl} nickname={nickname} className={avatarClass} />
      <span className="w-full truncate px-1 text-center text-[11px] leading-tight text-neon">
        {nickname}
      </span>
    </div>
  );
}

/** 空格。點陣序號讓整面看起來像一副等待集齊的卡冊。 */
export function EmptySlot({ index }: { index: number }) {
  return (
    <span className="px text-xs text-faint">
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}
