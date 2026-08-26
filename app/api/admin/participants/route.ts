import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";

/**
 * 參與者清單。
 *
 * 刻意不回傳 sessionToken——後台畫面不需要它，而一旦出現在回應中，
 * 它就會留在瀏覽器快取與任何側錄的流量裡。協助找回身分改由專用的
 * rescue 端點處理。
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }

  const participants = await prisma.participant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nickname: true,
      role: true,
      avatarUrl: true,
      bio: true,
      socialUrl: true,
      email: true,
      createdAt: true,
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

  return NextResponse.json({ participants });
}
