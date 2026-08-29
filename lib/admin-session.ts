import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { generateSessionToken } from "./codes";
import { hashPassword, verifyPassword } from "./password";

const COOKIE_NAME = "aid";
const SESSION_DAYS = 7;

/**
 * 管理員的 session 與參與者完全分離：不同的 cookie 名稱、不同的資料表。
 * 參與者的 session 永遠不可能被誤認為管理員權限。
 */
export async function loginAdmin(
  username: string,
  password: string,
): Promise<boolean> {
  const admin = await prisma.admin.findUnique({ where: { username } });

  if (!admin) {
    // 帳號不存在時仍執行一次雜湊運算。若直接返回，回應時間會明顯短於
    // 密碼錯誤的情形，這個時間差就足以用來列舉出哪些帳號存在。
    await hashPassword(password);
    return false;
  }

  if (!(await verifyPassword(password, admin.passwordHash))) return false;

  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.adminSession.create({ data: { adminId: admin.id, token, expiresAt } });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return true;
}

export async function logoutAdmin(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.adminSession.deleteMany({ where: { token } });
  }
  store.delete(COOKIE_NAME);
}

/** 目前登入的管理員，未登入或 session 過期則回傳 null。 */
export async function getCurrentAdmin() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { admin: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return session.admin;
}

type AdminLike = { id: string; role: "SUPER" | "HOST"; activeEventId: string | null };

/**
 * 這位管理員能不能操作這一場活動。
 *
 * SUPER 一律可以；HOST 必須有指派關係。**每一個吃 eventId 的端點都要問過
 * 這一句**——只檢查「有沒有登入」等於讓任何主持人操作別人的場次。
 */
export async function canAccessEvent(
  admin: AdminLike,
  eventId: string,
): Promise<boolean> {
  if (admin.role === "SUPER") return true;
  const assignment = await prisma.adminEvent.findUnique({
    where: { adminId_eventId: { adminId: admin.id, eventId } },
    select: { adminId: true },
  });
  return assignment !== null;
}

/**
 * 這位管理員目前正在操作的活動。
 *
 * 取代先前散在各處的 `findFirst({ where: { status: "ACTIVE" } })`——
 * 那個寫法預設全站只有一場，任何管理員都會落在同一場上。
 *
 * 順序：
 *   1. activeEventId（本人選定的，但仍須通過權限檢查——指派可能已被取消）
 *   2. HOST 取自己被指派的最近一場
 *   3. SUPER 取最近一場進行中的，沒有就取最近建立的
 */
export async function resolveAdminEvent(admin: AdminLike) {
  if (admin.activeEventId && (await canAccessEvent(admin, admin.activeEventId))) {
    const chosen = await prisma.event.findUnique({
      where: { id: admin.activeEventId },
    });
    if (chosen) return chosen;
  }

  if (admin.role === "HOST") {
    const assignment = await prisma.adminEvent.findFirst({
      where: { adminId: admin.id },
      orderBy: { event: { createdAt: "desc" } },
      include: { event: true },
    });
    return assignment?.event ?? null;
  }

  return (
    (await prisma.event.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    })) ??
    (await prisma.event.findFirst({ orderBy: { createdAt: "desc" } }))
  );
}

/**
 * 取得指定活動，並確認這位管理員有權操作它。**沒有權限就當作不存在。**
 *
 * `/admin/events/[id]` 底下每一頁的第一件事都必須是呼叫它。
 *
 * ⚠️ 不可以改成在 layout 做這個檢查。Next 官方文件明講，因為 Partial
 * Rendering，layout 在客戶端於同層路由間切換時不會重新執行；而且 layout
 * 就算不渲染 children，那些 route segment 仍然會跑、內容仍然會出現在
 * RSC payload 裡。見 node_modules/next/dist/docs 的 authentication.md。
 *
 * 回傳 null 而不是丟出例外，讓呼叫端自己決定要 notFound() 還是導向。
 * 但無論哪一種，**對外都必須是「找不到」而不是「沒有權限」**——
 * 兩者可區分的話，主持人就能拿 id 去探測別場活動存不存在。
 */
export async function requireEventAccess(admin: AdminLike, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return null;
  if (!(await canAccessEvent(admin, eventId))) return null;
  return event;
}

/** 切換目前操作的活動。權限不足時不動作並回傳 false。 */
export async function setActiveEvent(
  admin: AdminLike,
  eventId: string,
): Promise<boolean> {
  if (!(await canAccessEvent(admin, eventId))) return false;
  await prisma.admin.update({
    where: { id: admin.id },
    data: { activeEventId: eventId },
  });
  return true;
}
