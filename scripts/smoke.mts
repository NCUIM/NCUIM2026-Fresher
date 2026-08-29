/**
 * 煙霧測試。以 HTTP API 客戶端的身分驅動系統，符合 spec 議定的單一測試接縫。
 *
 * 用法：先 npm run dev，再 npm run smoke
 * 會先清空既有 Participant，因此只在開發環境執行。
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

type Session = { cookie: string; id: string; nickname: string; personalCode: string };

async function api(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), res };
}

const BASE_JOIN = {
  entryCode: "JOINNCU1",
  passcode: "1234",
  icons: ["music", "game", "food"],
  bio: "很高興認識大家",
};

async function join(nickname: string, overrides: Record<string, unknown> = {}) {
  const r = await api("/api/join", { ...BASE_JOIN, nickname, ...overrides });
  const raw = r.res.headers.get("set-cookie") ?? "";
  return {
    status: r.status,
    body: r.body,
    session: {
      cookie: raw.split(";")[0],
      id: r.body.id,
      nickname: r.body.nickname,
      personalCode: r.body.personalCode,
    } as Session,
  };
}

const scan = (s: Session, personalCode: string) =>
  api("/api/scan", { personalCode }, s.cookie);

console.log("\n【Entry Code 查詢】");
{
  const r = await fetch(`${BASE}/api/entry/JOINNCU1`);
  const j = await r.json();
  check("有效註冊碼回傳活動資訊", r.status === 200 && !!j.event?.name);
  check("不回傳通關碼", !JSON.stringify(j).includes("passcode"));
  check("不存在的註冊碼回傳 404", (await fetch(`${BASE}/api/entry/NOSUCHCODE`)).status === 404);
}

console.log("\n【報到驗證】");
{
  check("通關碼錯誤回傳 403", (await join("測試", { passcode: "9999" })).status === 403);
  check("圖示數量不足回傳 400", (await join("測試", { icons: ["music", "game"] })).status === 400);
  check("圖示重複回傳 400", (await join("測試", { icons: ["music", "music", "food"] })).status === 400);
  check("非 https 連結回傳 400", (await join("測試", { socialUrl: "http://x.com" })).status === 400);
  check("自我介紹超過 50 字回傳 400", (await join("測試", { bio: "字".repeat(51) })).status === 400);
}

console.log("\n【報到與分隊】");
const ming = (await join("陳小明", { bio: "喜歡打球" })).session;
const hua = (await join("林小華")).session;
const mei = (await join("王大美")).session;
{
  check("暱稱以 UTF-8 正確保存", ming.nickname === "陳小明", ming.nickname);
  const staff = await api("/api/join", { ...BASE_JOIN, entryCode: "STAFFNCU", nickname: "幹部小李" });
  check("工作人員註冊碼賦予 STAFF 身分", staff.body.role === "STAFF");
  check("工作人員不被分配組別", staff.body.team === null);
}

console.log("\n【收集】");
{
  const unauth = await api("/api/scan", { personalCode: hua.personalCode });
  check("未報到者無法收集，回傳 401", unauth.status === 401);

  const self = await scan(ming, ming.personalCode);
  check("掃描自己被拒絕", self.status === 409 && self.body.reason === "self");

  const missing = await scan(ming, "ZZZZZZZZZZZZ");
  check("不存在的卡片回傳 not_found", missing.status === 409 && missing.body.reason === "not_found");

  const first = await scan(ming, hua.personalCode);
  check("首次收集回傳 201", first.status === 201, `HTTP ${first.status}`);
  check("首次收集非重複", first.body.duplicate === false);
  check("回傳對方的卡片內容", first.body.card?.nickname === "林小華", first.body.card?.nickname);

  const again = await scan(ming, hua.personalCode);
  check("同方向重複掃描回傳 duplicate", again.status === 200 && again.body.duplicate === true);

  // pairKey 的關鍵驗證：反方向回掃必須被視為同一次相遇，而不是新的收集。
  const reverse = await scan(hua, ming.personalCode);
  check(
    "反方向回掃被視為同一次相遇（pairKey 生效）",
    reverse.status === 200 && reverse.body.duplicate === true,
    `HTTP ${reverse.status} duplicate=${reverse.body.duplicate}`,
  );

  await scan(ming, mei.personalCode);
}

console.log("\n【雙向持有】");
{
  const page = await fetch(`${BASE}/collection`, { headers: { cookie: hua.cookie } });
  const html = await page.text();
  check("被掃的一方也持有對方的卡片", html.includes("陳小明"), "小華的清單中找不到小明");
  check("未參與的第三人不在清單中", !html.includes("王大美"));

  const mingPage = await fetch(`${BASE}/collection`, { headers: { cookie: ming.cookie } });
  const mingHtml = await mingPage.text();
  check(
    "發起方持有兩張卡片",
    mingHtml.includes("林小華") && mingHtml.includes("王大美"),
  );
}

console.log(`\n通過 ${passed} 項，失敗 ${failed} 項\n`);
process.exitCode = failed > 0 ? 1 : 0;
