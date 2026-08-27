import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { iconByKey } from "@/lib/icons";
import { computeScore, pendingImpressions } from "@/lib/score";
import { listAnnouncements } from "@/lib/announcements";
import { getShowcase } from "@/lib/showcase";
import { SHOWCASE_SIZE } from "@/lib/validation";
import { NavShell } from "@/components/layout/BottomNav";

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
      {/* 身分 */}
      <header className="flex flex-col items-center gap-2 pt-2">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatarUrl}
            alt=""
            className="size-20 rounded-full border border-neon/60 object-cover"
          />
        ) : (
          <div className="grid size-20 place-items-center rounded-full border border-neon/60 bg-void text-2xl text-neon">
            {me.nickname.slice(0, 1)}
          </div>
        )}

        <h1 className="text-2xl font-black">{me.nickname}</h1>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {me.role === "STAFF" && (
            <span className="px rounded-sm border border-moon px-2 py-0.5 text-[10px] text-moon">
              STAFF
            </span>
          )}
          {me.team && (
            <span className="px rounded-sm border border-neon px-2 py-0.5 text-[10px] text-neon">
              TEAM {String(me.team.number).padStart(2, "0")}
            </span>
          )}
        </div>

        <div className="flex gap-2 text-2xl">
          {me.icons.map((key) => (
            <span key={key}>{iconByKey(key)?.emoji}</span>
          ))}
        </div>
        {me.bio && <p className="text-center text-sm text-dim">{me.bio}</p>}

        <Link href="/profile" className="text-xs text-faint underline">
          編輯個人資料
        </Link>
      </header>

      {/* 分數 */}
      <Link
        href="/achievements"
        className="glow-neon flex flex-col items-center gap-0.5 rounded-xl border border-neon/50 surface py-4"
      >
        <span className="px text-[10px] tracking-[0.2em] text-faint">SCORE</span>
        <span className="px text-glow-neon text-4xl leading-none text-neon">
          {score.total}
        </span>
      </Link>

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
          <Link href="/showcase" className="text-xs text-neon underline">
            編輯
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: SHOWCASE_SIZE }, (_, i) => {
            const slot = showcase[i];
            return slot ? (
              <Link
                key={slot.subjectId}
                href="/showcase"
                className="grid aspect-square place-items-center rounded-lg border border-neon/60 bg-slate p-1 text-center text-[11px] leading-tight text-neon"
              >
                {slot.card.nickname}
              </Link>
            ) : (
              <span
                key={i}
                className="px grid aspect-square place-items-center rounded-lg border border-dashed border-line text-[11px] text-faint"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
            );
          })}
        </div>
      </section>

      {/* 收集到的卡片 */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-bold">
            收集到的卡片
            <span className="px ml-2 text-sm text-neon">
              {String(collections.length).padStart(2, "0")}
            </span>
          </h2>
          {collections.length > 0 && (
            <Link href="/collection" className="text-xs text-neon underline">
              查看全部
            </Link>
          )}
        </div>

        {collections.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-faint">
            還沒有收集到任何人
            <br />
            去掃描別人的 QR Code 吧
          </p>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {collections.map((c) => (
              <li key={c.id}>
                <Link
                  href="/collection"
                  className="flex flex-col items-center gap-1"
                >
                  {c.subject.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.subject.avatarUrl}
                      alt=""
                      className="aspect-square w-full rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <span className="grid aspect-square w-full place-items-center rounded-lg border border-line bg-slate text-lg text-dim">
                      {c.subject.nickname.slice(0, 1)}
                    </span>
                  )}
                  <span className="w-full truncate text-center text-[10px] text-dim">
                    {c.subject.nickname}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 次要入口 */}
      <div className="grid grid-cols-2 gap-2 pt-1">
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

      <p className="text-center text-[11px] text-faint">{me.event.name}</p>
    </NavShell>
  );
}
