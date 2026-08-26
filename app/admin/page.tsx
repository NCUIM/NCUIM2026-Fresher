import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { AdminDashboard } from "./AdminDashboard";

export default async function AdminPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

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
        <span className="text-sm text-gray-500">{admin.username}</span>
      </header>

      <AdminDashboard initial={participants} />
    </main>
  );
}
