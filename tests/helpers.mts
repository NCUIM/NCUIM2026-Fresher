import "dotenv/config";
import { assertTestDatabase } from "../lib/test-db-guard.ts";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// 破壞性操作：拒絕對開發資料庫執行（見 lib/test-db-guard.ts）
assertTestDatabase("測試");

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
  // Announcement 掛在 Event 而非 Participant 上，不會被上面的 cascade 清掉。
  // 若留著，前一個測試發布的公告會讓後續測試的未讀數對不上。
  await prisma.announcement.deleteMany({});
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

/**
 * 取出寄給某位參與者的一次性權杖。
 *
 * 真實流程中這個值來自信箱。測試無法收信，因此直接從資料庫取值——
 * 這是「取得輸入」，不是斷言：所有驗證仍然是針對 HTTP 行為進行。
 */
export async function readToken(
  participantId: string,
  purpose: "VERIFY_EMAIL" | "RECOVER_SESSION",
): Promise<string | null> {
  const row = await prisma.recoveryToken.findFirst({
    where: { participantId, purpose, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return row?.token ?? null;
}

/** 調整排行榜公開名次數，用於驗證「只回傳前 N 名」。 */
export async function setLeaderboardTopN(n: number): Promise<void> {
  await prisma.event.updateMany({ data: { leaderboardTopN: n } });
}

/** 把活動還原為進行中，避免封存測試影響後續測試。 */
export async function reactivateEvents(): Promise<void> {
  await prisma.event.updateMany({
    data: { status: "ACTIVE", archivedAt: null, purgeAfter: null },
  });
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
  // 自我介紹為必填，預設值讓各測試不必每次都寫。
  bio: "很高興認識大家",
};

/** 建立一位已報到的參與者，回傳可用於後續請求的 session。 */
export async function joinAs(
  nickname: string,
  overrides: Record<string, unknown> = {},
): Promise<Session> {
  const res = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    // 姓名為必填。測試關心的是暱稱，這裡直接沿用，
    // 需要區分兩者的測試再自行覆寫。
    body: JSON.stringify({ ...DEFAULT_JOIN, nickname, realName: nickname, ...overrides }),
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
