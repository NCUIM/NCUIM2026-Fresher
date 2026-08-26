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
