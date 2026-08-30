import { BottomNav } from "./BottomNav";

/**
 * 頁面切換時立刻出現的骨架。
 *
 * 為什麼需要它：這個 app 的每一頁都是動態的（每次切換都要問伺服器）。
 * 沒有 loading.tsx 的話，App Router 在等待伺服器回應的那段時間裡**什麼
 * 都不會做**——舊頁面停在原地，沒有轉圈、沒有任何回饋。以現場的網路，
 * 那是點下去之後半秒以上像當掉。使用者的反應是再按一次。
 *
 * 有了它，Next 會用 Suspense 包住路由，點擊的瞬間就換上這個畫面。
 * 實際的等待時間沒有變，但「有沒有反應」這件事變了——而那正是
 * 「卡卡的」的來源。
 *
 * 底部導覽照樣畫出來（而且不帶徽章數字）：導覽列在切換過程中消失再
 * 出現會造成明顯的跳動，而徽章要等資料才知道，先畫個沒有徽章的版本
 * 比讓整條列消失好得多。
 */
export function PageSkeleton() {
  return (
    <>
      <div
        className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 pt-7"
        style={{ paddingBottom: "calc(var(--nav-h) + var(--safe-bottom) + 1rem)" }}
      >
        {/* 標題列 */}
        <div className="flex items-baseline justify-between">
          <div className="skeleton h-6 w-32 rounded-sm" />
          <div className="skeleton h-4 w-10 rounded-sm" />
        </div>

        {/*
          三塊高度遞減的區塊。不模仿任何一頁的精確版面——各頁差異太大，
          刻意做得像反而會在真正的內容進來時跳得更明顯。這裡要的只是
          「有東西正在來」。
        */}
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-16 rounded-xl" />
      </div>

      <BottomNav pendingImpressions={0} unreadAnnouncements={0} />
    </>
  );
}
