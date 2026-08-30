import { PageSkeleton } from "@/components/layout/PageSkeleton";

/*
  切換到這一頁時立刻顯示的畫面。

  這一頁是動態渲染的，每次進來都要等伺服器。沒有這個檔案的話，
  App Router 會在等待期間讓畫面完全停住——使用者以為沒點到。
*/
export default function Loading() {
  return <PageSkeleton />;
}
