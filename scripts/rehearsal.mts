import "dotenv/config";
import { assertTestDatabase } from "../lib/test-db-guard.ts";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// 破壞性操作：拒絕對開發資料庫執行（見 lib/test-db-guard.ts）
assertTestDatabase("彩排");

/**
 * 全流程彩排：模擬一場真實活動，從報到到封存。
 *
 * 這不是單元測試的替代品，而是補足它們看不到的東西——各功能串在一起、
 * 資料量接近真實時，整體行為是否合理。用法：npm run rehearsal
 */
const BASE = process.env.REHEARSAL_BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

let problems = 0;
function expect(label: string, ok: boolean, detail = "") {
  console.log(`   ${ok ? "✓" : "✗"} ${label}${ok ? "" : ` — ${detail}`}`);
  if (!ok) problems++;
}
const step = (n: string) => console.log(`\n${n}`);

type P = { cookie: string; id: string; nickname: string; personalCode: string };

async function api(path: string, body?: unknown, cookie?: string, method = "POST") {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json; charset=utf-8" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null), res };
}
const GET = (p: string, c?: string) => api(p, undefined, c, "GET");

async function join(nickname: string, extra: Record<string, unknown> = {}): Promise<P> {
  const r = await api("/api/join", {
    entryCode: "JOINNCU1",
    passcode: "1234",
    nickname,
    realName: nickname,
    icons: ["music", "game", "food"],
    bio: "請多指教！",
    ...extra,
  });
  if (r.status !== 201) throw new Error(`${nickname} 報到失敗: ${JSON.stringify(r.body)}`);
  return {
    cookie: (r.res.headers.get("set-cookie") ?? "").split(";")[0],
    id: r.body.id,
    nickname: r.body.nickname,
    personalCode: r.body.personalCode,
  };
}

// ── 清空 ────────────────────────────────────────────────
await prisma.participant.deleteMany({});
await prisma.announcement.deleteMany({});
await prisma.event.updateMany({
  data: { status: "ACTIVE", archivedAt: null, purgeAfter: null },
});

step("① 報到：12 位新生 + 2 位工作人員");
const freshmen: P[] = [];
for (let i = 1; i <= 12; i++) {
  freshmen.push(
    await join(`新生${String(i).padStart(2, "0")}`, {
      email: `student${i}@example.com`,
      bio: "請多指教！",
    }),
  );
}
const staff: P[] = [];
for (let i = 1; i <= 2; i++) {
  const r = await api("/api/join", {
    entryCode: "STAFFNCU",
    passcode: "1234",
    nickname: `幹部${i}`,
    realName: `幹部${i}`,
    icons: ["star", "code", "gym"],
    bio: "有問題都可以問我",
  });
  staff.push({
    cookie: (r.res.headers.get("set-cookie") ?? "").split(";")[0],
    id: r.body.id,
    nickname: r.body.nickname,
    personalCode: r.body.personalCode,
  });
}
expect("14 人全部報到成功", freshmen.length === 12 && staff.length === 2);

const teams = new Set<number>();
for (const f of freshmen) {
  const me = await GET("/api/me", f.cookie);
  teams.add(me.body.team.number);
}
expect(`新生被打散到 ${teams.size} 個組別`, teams.size >= 8, `實際 ${teams.size}`);

const staffMe = await GET("/api/me", staff[0].cookie);
expect("工作人員不分組", staffMe.body.team === null);

step("② 收集：新生互掃，並掃描工作人員");
let scans = 0;
for (let i = 0; i < freshmen.length; i++) {
  // 每個人掃描後面 3 位，形成交錯的收集網
  for (let d = 1; d <= 3; d++) {
    const target = freshmen[(i + d) % freshmen.length];
    const r = await api("/api/scan", { personalCode: target.personalCode }, freshmen[i].cookie);
    if (r.status === 201) scans++;
  }
}
// 前 4 位新生把兩位工作人員都掃到
for (const f of freshmen.slice(0, 4)) {
  for (const s of staff) {
    await api("/api/scan", { personalCode: s.personalCode }, f.cookie);
  }
}
expect(`產生 ${scans} 次新生之間的相遇`, scans > 0);

const dup = await api(
  "/api/scan",
  { personalCode: freshmen[1].personalCode },
  freshmen[0].cookie,
);
expect("重複掃描回報 duplicate", dup.body?.duplicate === true);

const reverse = await api(
  "/api/scan",
  { personalCode: freshmen[0].personalCode },
  freshmen[1].cookie,
);
expect("反向回掃視為同一次相遇", reverse.body?.duplicate === true);

step("③ 撰寫 Impression 讓基礎分入帳");
const before = await GET("/api/me", freshmen[0].cookie);
expect("尚未撰寫時基礎分為 0", before.body.score.base === 0, `實際 ${before.body.score.base}`);

for (const f of freshmen) {
  const me = await GET("/api/me", f.cookie);
  for (const p of me.body.pendingImpressions) {
    await api(
      "/api/impressions",
      { subjectId: p.subjectId, text: `跟${p.nickname}聊得很開心` },
      f.cookie,
    );
  }
}
const after = await GET("/api/me", freshmen[0].cookie);
expect("撰寫後基礎分入帳", after.body.score.base > 0, `實際 ${after.body.score.base}`);
expect("待撰寫清單清空", after.body.pendingImpressions.length === 0);

step("④ 成就與排行榜");
const withAchievements = await GET("/api/me", freshmen[0].cookie);
const earned = withAchievements.body.achievements.filter((a: any) => a.earned);
expect(`新生01 取得 ${earned.length} 項成就`, earned.length > 0);

const hiddenLocked = withAchievements.body.achievements.find(
  (a: any) => a.hidden && !a.earned,
);
if (hiddenLocked) {
  expect("未達成的隱藏成就不洩漏內容", !hiddenLocked.title && !hiddenLocked.progress);
}

const board = await GET("/api/leaderboard", freshmen[0].cookie);
const names = board.body.top.map((e: any) => e.nickname);
expect("排行榜有內容", names.length > 0);
expect("工作人員不在榜上", !names.some((n: string) => n.startsWith("幹部")));
expect("回傳自己的名次", board.body.me !== null);

step("⑤ 浮光牆與九宮格");
const wall = await GET("/api/impressions/received", freshmen[0].cookie);
expect(`新生01 收到 ${wall.body.impressions.length} 則短評`, wall.body.impressions.length > 0);
expect(
  "短評都具名",
  wall.body.impressions.every((i: any) => !!i.authorNickname),
);

const myCollection = await GET("/api/me", freshmen[0].cookie);
const pickFrom = (await GET("/api/showcase", freshmen[0].cookie)).body;
expect("九宮格初始為空", pickFrom.slots.length === 0);

const collected = await prisma.collection.findMany({
  where: { ownerId: freshmen[0].id },
  select: { subjectId: true },
  take: 3,
});
const showcase = await api(
  "/api/showcase",
  { subjectIds: collected.map((c) => c.subjectId) },
  freshmen[0].cookie,
  "PUT",
);
expect("放入九宮格成功", showcase.status === 200 && showcase.body.slots.length === 3);

const wallAfter = await GET("/api/impressions/received", collected[0].subjectId
  ? freshmen.find((f) => f.id === collected[0].subjectId)!.cookie
  : freshmen[1].cookie);
expect(
  "被選入九宮格者的短評被標為顯眼",
  wallAfter.body.impressions.some((i: any) => i.featured),
);

const nosy = await GET("/api/impressions/received", freshmen[5].cookie);
expect(
  "別人讀不到不屬於自己的短評",
  !nosy.body.impressions.some((i: any) => i.subjectId === freshmen[0].id),
);

step("⑥ 公告");
const login = await api("/api/admin/login", { username: "admin", password: "change-me" });
const adminCookie = (login.res.headers.get("set-cookie") ?? "").split(";")[0];
expect("管理員登入成功", login.status === 200);

await api("/api/admin/announcements", { body: "集合時間改為下午兩點" }, adminCookie);
const ann = await GET("/api/announcements", freshmen[0].cookie);
expect("參與者收到公告且標為未讀", ann.body.unreadCount === 1);

await api("/api/announcements/read", {}, freshmen[0].cookie);
const annRead = await GET("/api/announcements", freshmen[0].cookie);
expect("標記已讀後未讀數歸零", annRead.body.unreadCount === 0);

const other = await GET("/api/announcements", freshmen[1].cookie);
expect("已讀狀態各自獨立", other.body.unreadCount === 1);

step("⑦ 遺失身分後用信箱找回");
const lost = freshmen[3];
const verifyToken = (
  await prisma.recoveryToken.findFirst({
    where: { participantId: lost.id, purpose: "VERIFY_EMAIL", usedAt: null },
  })
)?.token;
await fetch(`${BASE}/verify/${verifyToken}`, { redirect: "manual" });

await api("/api/recover", { email: "student4@example.com" });
const recoverToken = (
  await prisma.recoveryToken.findFirst({
    where: { participantId: lost.id, purpose: "RECOVER_SESSION", usedAt: null },
  })
)?.token;
expect("已驗證信箱取得找回連結", !!recoverToken);

const recovered = await fetch(`${BASE}/recover/${recoverToken}`, { redirect: "manual" });
const newCookie = (recovered.headers.get("set-cookie") ?? "").split(";")[0];
const recoveredMe = await GET("/api/me", newCookie);
expect(
  "在新裝置上回到同一個身分",
  recoveredMe.body.nickname === lost.nickname,
  recoveredMe.body.nickname,
);
expect(
  "收集成果完好",
  recoveredMe.body.score.total > 0,
  `分數 ${recoveredMe.body.score?.total}`,
);

step("⑧ 封存");
const archive = await api("/api/admin/archive", {}, adminCookie);
expect("封存成功", archive.status === 200);

const scanAfter = await api(
  "/api/scan",
  { personalCode: freshmen[5].personalCode },
  freshmen[0].cookie,
);
expect("封存後無法再收集", scanAfter.status === 409 && scanAfter.body.reason === "archived");

const joinAfter = await api("/api/join", {
  entryCode: "JOINNCU1",
  passcode: "1234",
  nickname: "太晚了",
  realName: "太晚了",
  icons: ["music", "game", "food"],
  bio: "我來太晚了",
});
expect("封存後無法再報到", joinAfter.status === 409);

const viewAfter = await GET("/api/me", freshmen[0].cookie);
expect("封存後仍看得到收集成果", viewAfter.status === 200 && viewAfter.body.score.total > 0);

const wallAfterArchive = await GET("/api/impressions/received", freshmen[0].cookie);
expect("封存後浮光牆仍可查看", wallAfterArchive.body.impressions.length > 0);

const days =
  (new Date(archive.body.purgeAfter).getTime() -
    new Date(archive.body.archivedAt).getTime()) /
  86_400_000;
expect("保留期為 14 天", Math.abs(days - 14) < 0.01, `實際 ${days.toFixed(2)} 天`);

// ── 收尾 ────────────────────────────────────────────────
await prisma.event.updateMany({
  data: { status: "ACTIVE", archivedAt: null, purgeAfter: null },
});

console.log(
  problems === 0
    ? "\n全流程彩排通過，沒有發現問題。\n"
    : `\n⚠️ 發現 ${problems} 個問題，見上方標示。\n`,
);
await prisma.$disconnect();
process.exitCode = problems > 0 ? 1 : 0;
