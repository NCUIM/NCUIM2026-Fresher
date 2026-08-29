import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { computeScore, pendingImpressions } from "@/lib/score";
import { listAnnouncements } from "@/lib/announcements";
import { getShowcase } from "@/lib/showcase";
import { toCardView } from "@/lib/cards";
import { CardDisplay } from "@/components/card/CardDisplay";
import { NavShell } from "@/components/layout/NavShell";
import { ShowcaseGrid } from "@/components/showcase/ShowcaseGrid";
import { EditLink } from "@/components/layout/EditLink";

/**
 * 個人主頁：身分、分數、九宮格、收集到的卡片。
 *
 * 九宮格與收集清單顯示在這裡而非各自獨立——它們是「我的成果」的兩面，
 * 分開放會讓人得記住哪個功能在哪一頁。編輯與完整瀏覽仍有各自的頁面。
 *
 * 個人 QR 不放這裡：它已經獨立成 /code，出示時畫面不該有別的東西干擾。
 */
export default async function MePage() {
  const me = await getCurrentParticipant();
  if (!me) redirect("/");

  const [score, pending, announcements, showcase, collections] =
    await Promise.all([
      computeScore(me.id),
      pendingImpressions(me.id),
      listAnnouncements(me.eventId, me.id),
      getShowcase(me.id),
      prisma.collection.findMany({
        where: { ownerId: me.id },
        include: { subject: { select: { id: true, nickname: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return (
    <NavShell>
      {/*
        最上方直接放自己的卡牌，而不是另外排一組頭像＋暱稱＋圖示。

        這一頁先前手工重刻了一次卡片的內容，於是卡片改版時兩邊就會走鐘；
        更重要的是，使用者在這裡看到的必須**就是別人收集到的那一張**——
        底色與頭像都是他自己選的，要能立刻確認選出來的效果。
      */}
      <header className="flex flex-col items-center gap-3 pt-2">
        <div className="w-full max-w-sm">
          <CardDisplay card={toCardView(me)} eventName={me.event.name} />
        </div>
        <EditLink href="/profile" label="編輯個人資料" />
      </header>

      {/*
        首次進入的引導。用「還沒收集到任何人」當判斷條件，
        不需要另外記錄是否為第一次——沒有收集紀錄本身就是第一次的狀態，
        而且如果有人一直沒開始，這段提示會一直留著。
      */}
      {collections.length === 0 ? (
        <section className="flex flex-col gap-3 rounded-xl border border-neon/50 surface p-5">
          <h2 className="font-bold text-neon">接下來怎麼玩</h2>
          <ol className="flex flex-col gap-2.5 text-sm text-dim">
            <li className="flex gap-3">
              <span className="px shrink-0 text-neon">01</span>
              <span>
                找到一個人，其中一個出示<strong className="text-chalk">QRCode</strong>、
                另一個用<strong className="text-chalk">掃描</strong>——一次就雙方互相收集。
              </span>
            </li>
            <li className="flex gap-3">
              <span className="px shrink-0 text-neon">02</span>
              <span>
                趁還記得，<strong className="text-chalk">寫下對他的印象</strong>。
                寫完分數才會入帳。
              </span>
            </li>
            <li className="flex gap-3">
              <span className="px shrink-0 text-neon">03</span>
              <span>
                收集愈多解愈多成就。別人寫給你的話會出現在
                <strong className="text-chalk">牆</strong>上，只有你看得到。
              </span>
            </li>
          </ol>
          <Link
            href="/scan"
            className="tap-target glow-neon flex items-center justify-center rounded-sm bg-neon py-3 font-bold text-void"
          >
            開始掃描
          </Link>
        </section>
      ) : (
        /* 分數 */
        <Link
          href="/achievements"
          className="glow-neon flex flex-col items-center gap-0.5 rounded-xl border border-neon/50 surface py-4"
        >
          <span className="px text-[10px] tracking-[0.2em] text-faint">SCORE</span>
          <span className="px text-glow-neon text-4xl leading-none text-neon">
            {score.total}
          </span>
        </Link>
      )}

      {/* 待撰寫提示 */}
      {pending.length > 0 && (
        <Link
          href="/write"
          className="flex flex-col gap-0.5 rounded-xl border border-flare/50 bg-flare/10 px-4 py-3"
        >
          <span className="font-bold text-flare">
            還有 {pending.length} 個人等你寫下印象
          </span>
          <span className="text-sm text-dim">寫完才會計分</span>
        </Link>
      )}

      {/* 未驗證信箱提示 */}
      {(!me.email || !me.emailVerified) && (
        <Link
          href="/profile"
          className="flex flex-col gap-0.5 rounded-xl border border-moon/40 bg-moon/10 px-4 py-3"
        >
          <span className="font-bold text-moon">
            {me.email ? "信箱尚未驗證" : "還沒填寫信箱"}
          </span>
          <span className="text-sm text-dim">
            {me.email
              ? "到信箱點擊驗證連結，否則之後無法自己找回成果"
              : "填了信箱，換手機時才能自己找回收集成果"}
          </span>
        </Link>
      )}

      {/* 九宮格 */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">我的九宮格</h2>
          <EditLink href="/showcase" tone="neon" />
        </div>
        {/* 依 position 排格子，空格由元件自行補上（getShowcase 只回傳有內容的）。 */}
        <ShowcaseGrid slots={showcase} eventName={me.event.name} />
      </section>

      {/*
        收集到的卡片不在這裡展開，只留一個入口。

        個人頁已經有分數、九宮格、公告與各種提示；卡片一多，這一頁就變成
        一面需要一直捲的長牆，而每一區都被壓縮到看不清楚。卡片本身有專屬
        的頁面，那裡才有足夠的空間讓它們像卡片。
      */}
      <Link
        href="/collection"
        className="tap-target flex items-center justify-between rounded-xl border border-line surface px-4 py-3.5 transition-colors hover:border-neon/50"
      >
        <span className="flex flex-col">
          <span className="font-bold">收集到的卡片</span>
          <span className="text-xs text-faint">
            {collections.length === 0
              ? "還沒有收集到任何人，去掃描別人的 QR Code 吧"
              : "點開看每一張的完整內容"}
          </span>
        </span>
        <span className="px text-glow-neon shrink-0 text-lg text-neon">
          {String(collections.length).padStart(2, "0")}
        </span>
      </Link>

      {/* 次要入口 */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        <Link
          href="/achievements"
          className="tap-target flex items-center justify-center rounded-lg border border-line py-3 text-sm"
        >
          成就
        </Link>
        <Link
          href="/leaderboard"
          className="tap-target flex items-center justify-center rounded-lg border border-line py-3 text-sm"
        >
          排行榜
        </Link>
        <Link
          href="/announcements"
          className="tap-target relative flex items-center justify-center rounded-lg border border-line py-3 text-sm"
        >
          活動公告
          {announcements.unreadCount > 0 && (
            <span className="px absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-flare text-[10px] text-void">
              {announcements.unreadCount}
            </span>
          )}
        </Link>
      </div>

    </NavShell>
  );
}
