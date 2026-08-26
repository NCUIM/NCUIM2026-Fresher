import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * 測試一律以 HTTP API 客戶端的身分驅動系統——這是 spec 議定的單一接縫。
 *
 * Prisma 在此僅用於「重置狀態」，絕不用於斷言。用資料庫查詢來驗證行為
 * 會讓測試綁死在資料結構上，重構時就算行為沒變也會壞掉。
 */
export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

export async function resetParticipants(): Promise<void> {
  // 外鍵皆為 cascade，刪除 Participant 會一併清掉 Scan、Collection、
  // Impression、ShowcaseSlot 與 AchievementEarned。
  await prisma.participant.deleteMany({});
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * 調整成就門檻，模擬 Admin 在活動進行中修改設定。
 * 第一階段的成就定義來自設定檔、沒有後台 API，因此只能由此處直接改寫；
 * 這是測試的「安排」步驟，不是斷言——斷言一律走 HTTP API。
 */
export async function setAchievementThreshold(
  key: string,
  threshold: number,
): Promise<void> {
  await prisma.achievementDef.updateMany({ where: { key }, data: { threshold } });
}

/** 還原種子設定，避免修改過的門檻影響後續測試。 */
export async function restoreAchievementThresholds(): Promise<void> {
  const { DEFAULT_ACHIEVEMENTS } = await import("../lib/achievements.config.ts");
  for (const a of DEFAULT_ACHIEVEMENTS) {
    await prisma.achievementDef.updateMany({
      where: { key: a.key },
      data: { threshold: a.threshold },
    });
  }
}

/** 開發伺服器沒開時給出明確訊息，而不是一堆 fetch failed。 */
export async function requireServer(): Promise<void> {
  try {
    const res = await fetch(`${BASE}/api/entry/JOINNCU1`);
    if (res.status === 404) {
      throw new Error("找不到示範活動，請先執行 npm run db:seed");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("db:seed")) throw e;
    throw new Error(`無法連線到 ${BASE}，請先執行 npm run dev`);
  }
}

export type Session = {
  cookie: string;
  id: string;
  nickname: string;
  personalCode: string;
};

type ApiResponse<T = any> = { status: number; body: T };

export async function post<T = any>(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export async function get<T = any>(
  path: string,
  cookie?: string,
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const DEFAULT_JOIN = {
  entryCode: "JOINNCU1",
  passcode: "1234",
  icons: ["music", "game", "food"],
};

/** 建立一位已報到的參與者，回傳可用於後續請求的 session。 */
export async function joinAs(
  nickname: string,
  overrides: Record<string, unknown> = {},
): Promise<Session> {
  const res = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ ...DEFAULT_JOIN, nickname, ...overrides }),
  });
  const body = await res.json();
  if (res.status !== 201) {
    throw new Error(`joinAs(${nickname}) 失敗：${JSON.stringify(body)}`);
  }
  return {
    cookie: (res.headers.get("set-cookie") ?? "").split(";")[0],
    id: body.id,
    nickname: body.nickname,
    personalCode: body.personalCode,
  };
}

/** a 主動掃描 b，建立雙方的 Collection。 */
export async function scan(a: Session, b: Session) {
  return post("/api/scan", { personalCode: b.personalCode }, a.cookie);
}
