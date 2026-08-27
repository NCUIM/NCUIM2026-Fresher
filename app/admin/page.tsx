import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  const event = await prisma.event.findFirst({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: { name: true, status: true },
  });

  const participants = await prisma.participant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nickname: true,
      role: true,
      avatarUrl: true,
      bio: true,
      socialUrl: true,
      team: { select: { number: true } },
      _count: {
        select: {
          scansInitiated: true,
          collections: true,
          impressionsWritten: true,
        },
      },
    },
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-5 pt-8 pb-[calc(2rem+var(--safe-bottom))]">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">後台</h1>
        <span className="text-sm text-dim">{admin.username}</span>
      </header>

      <Link
        href="/admin/codes"
        className="tap-target flex items-center justify-between rounded-xl border border-line px-4 py-3 font-medium"
      >
        報到 QR Code
        <span className="text-sm font-normal text-dim">投影／列印用 →</span>
      </Link>

      <AdminDashboard
        initial={participants}
        eventName={event?.name ?? "（無活動）"}
        archived={event?.status === "ARCHIVED"}
      />
    </main>
  );
}
