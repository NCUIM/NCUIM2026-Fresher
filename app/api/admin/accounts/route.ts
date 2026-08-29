import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin-session";
import { hashPassword } from "@/lib/password";
import { firstErrorMessage } from "@/lib/validation";

const createSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "帳號至少 3 個字元")
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, "帳號只能使用英數字與 . _ -"),
  password: z.string().min(8, "密碼至少 8 個字元").max(128),
  role: z.enum(["SUPER", "HOST"]).default("HOST"),
  /** 建立主持人時可一併指派活動，省去再跑一趟指派流程。 */
  eventIds: z.array(z.string()).optional(),
});

/**
 * 帳號管理僅限總管理員。
 *
 * 主持人若能新增帳號，就能造一個 SUPER 給自己，權限分級等於不存在。
 */
const SUPER_ONLY = { error: "只有總管理員可以管理帳號" };

/** 列出所有管理員。不回傳任何雜湊——畫面上沒有需要，回傳只會多一個外洩點。 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }
  if (admin.role !== "SUPER") {
    return NextResponse.json(SUPER_ONLY, { status: 403 });
  }

  const admins = await prisma.admin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      _count: { select: { sessions: true } },
      assignments: {
        select: { event: { select: { id: true, name: true, status: true } } },
      },
    },
  });

  return NextResponse.json({ admins, currentId: admin.id });
}

/**
 * 新增管理員。
 *
 * 不開放自行註冊，只有已登入的管理員能新增——後台握有全體參與者的個資，
 * 開放註冊等於把它交給任何人。
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "需要管理員權限" }, { status: 401 });
  }
  if (admin.role !== "SUPER") {
    return NextResponse.json(SUPER_ONLY, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const exists = await prisma.admin.findUnique({
    where: { username: parsed.data.username },
  });
  if (exists) {
    return NextResponse.json({ error: "這個帳號已經存在" }, { status: 409 });
  }

  const created = await prisma.admin.create({
    data: {
      username: parsed.data.username,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      // SUPER 的權限來自 role，不需要指派；只有 HOST 靠指派決定管得到哪一場。
      ...(parsed.data.role === "HOST" && parsed.data.eventIds?.length
        ? {
            assignments: {
              create: parsed.data.eventIds.map((eventId) => ({ eventId })),
            },
          }
        : {}),
    },
    select: { id: true, username: true, role: true, createdAt: true },
  });

  return NextResponse.json(created, { status: 201 });
}
