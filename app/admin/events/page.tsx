import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";

/**
 * 選擇要操作哪一場活動。
 *
 * 兩種身分都能用，但看到的清單不同：總管理員看得到全部，
 * 主持人只看得到被指派的。**這個 where 條件就是隔離本身**——
 * 不是靠畫面上少畫幾個項目，而是資料庫根本不回傳。
 */
export default async function EventPickerPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const events = await prisma.event.findMany({
    where:
      admin.role === "SUPER"
        ? {}
        : { hosts: { some: { adminId: admin.id } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      _count: { select: { participants: true } },
    },
  });

  // 主持人只被指派一場時，選單沒有意義，直接送他進去。
  if (admin.role === "HOST" && events.length === 1) {
    redirect(`/admin/events/${events[0].id}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-black">選擇活動</h1>
          <span className="px text-sm text-dim">{admin.username}</span>
        </div>
        <p className="text-xs text-faint">
          {admin.role === "SUPER"
            ? `共 ${events.length} 場`
            : `你被指派了 ${events.length} 場`}
        </p>
      </header>

      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-faint">
          {admin.role === "SUPER"
            ? "還沒有任何活動。請到總管理後台建立。"
            : "你還沒有被指派任何活動，請聯絡總管理員。"}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`/admin/events/${e.id}`}
                className="tap-target flex flex-col rounded-xl border border-line px-4 py-3 transition-colors hover:border-neon/50"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{e.name}</span>
                  {e.status === "ACTIVE" ? (
                    <span className="rounded-full bg-neon px-2 py-0.5 text-[10px] text-void">
                      進行中
                    </span>
                  ) : (
                    <span className="rounded-full border border-moon px-2 py-0.5 text-[10px] text-moon">
                      已封存
                    </span>
                  )}
                </span>
                <span className="mt-1 text-xs text-faint">
                  {e._count.participants} 人・
                  {new Date(e.startsAt).toLocaleDateString("zh-TW")} 開始
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {admin.role === "SUPER" && (
        <Link
          href="/admin"
          className="tap-target flex items-center justify-center text-sm text-dim"
        >
          回到總管理後台
        </Link>
      )}
    </main>
  );
}
