import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  post,
  requireServer,
  resetParticipants,
  restoreAchievementThresholds,
  scan,
} from "./helpers.mts";

async function loginAsAdmin(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "change-me" }),
  });
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function send(
  method: "PATCH" | "DELETE",
  path: string,
  body: unknown,
  cookie?: string,
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const VALID = {
  key: "test-achievement",
  type: "SCAN_COUNT" as const,
  threshold: 2,
  points: 25,
  hidden: false,
  title: "測試成就",
  description: "掃描 2 個人",
};

/** 測試自己建的成就要清掉，否則會累積影響後續測試的成就數量。 */
async function removeTestAchievements(cookie: string) {
  const res = await get("/api/admin/achievements", cookie);
  for (const a of res.body.achievements ?? []) {
    if (a.key.startsWith("test-")) {
      await send("DELETE", `/api/admin/achievements/${a.id}`, undefined, cookie);
    }
  }
}

describe("成就設定", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await restoreAchievementThresholds();
    await removeTestAchievements(await loginAsAdmin());
  });
  after(async () => {
    await removeTestAchievements(await loginAsAdmin());
    await restoreAchievementThresholds();
    await disconnect();
  });

  it("列出成就與已達成人數", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await get("/api/admin/achievements", adminCookie);

    assert.equal(res.status, 200);
    assert.ok(res.body.achievements.length > 0, "種子資料建立了七項成就");
    assert.ok(
      res.body.achievements.every(
        (a: { _count: { earned: number } }) => typeof a._count.earned === "number",
      ),
      "人數決定這條成就還能不能刪，必須一起回傳",
    );
  });

  it("可以新增成就", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await post("/api/admin/achievements", VALID, adminCookie);

    assert.equal(res.status, 201);
    assert.equal(res.body.title, "測試成就");
  });

  it("新增的成就會實際發放", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/achievements", VALID, adminCookie);

    const ming = await joinAs("陳小明");
    const a = await joinAs("甲");
    const b = await joinAs("乙");
    await scan(ming, a);
    await scan(ming, b);

    const me = await get("/api/me", ming.cookie);
    const earned = me.body.achievements.find(
      (x: { key: string }) => x.key === "test-achievement",
    );
    assert.ok(earned?.earned, "後台新增的成就必須跟種子建立的一樣會被判定");
  });

  it("代號重複被拒絕", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/achievements", VALID, adminCookie);

    const res = await post("/api/admin/achievements", VALID, adminCookie);

    assert.equal(res.status, 409);
  });

  it("掃描特定身分的成就必須指定對象", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await post(
      "/api/admin/achievements",
      { ...VALID, key: "test-role", type: "SCAN_ROLE", targetRole: null },
      adminCookie,
    );

    assert.equal(res.status, 400, "少了對象身分，這條成就永遠判定不出結果");
  });

  it("門檻為零被拒絕", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await post(
      "/api/admin/achievements",
      { ...VALID, key: "test-zero", threshold: 0 },
      adminCookie,
    );

    assert.equal(res.status, 400, "門檻 0 代表一報到就達成");
  });

  it("集齊全隊可以用 -1 當門檻", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await post(
      "/api/admin/achievements",
      { ...VALID, key: "test-team", type: "TEAM_COLLECT", threshold: -1 },
      adminCookie,
    );

    assert.equal(res.status, 201);
  });

  it("可以修改分數與門檻", async () => {
    const adminCookie = await loginAsAdmin();
    const created = await post("/api/admin/achievements", VALID, adminCookie);

    const res = await send(
      "PATCH",
      `/api/admin/achievements/${created.body.id}`,
      { ...VALID, points: 999, threshold: 3 },
      adminCookie,
    );

    assert.equal(res.status, 200);
    assert.equal(res.body.points, 999);
  });

  it("改分數不會動到已經達成的人（ADR-0002）", async () => {
    const adminCookie = await loginAsAdmin();
    const created = await post("/api/admin/achievements", VALID, adminCookie);

    const ming = await joinAs("陳小明");
    await scan(ming, await joinAs("甲"));
    await scan(ming, await joinAs("乙"));

    const before = await get("/api/me", ming.cookie);
    const beforeTotal = before.body.score.total;

    await send(
      "PATCH",
      `/api/admin/achievements/${created.body.id}`,
      { ...VALID, points: 9999 },
      adminCookie,
    );

    const after = await get("/api/me", ming.cookie);
    assert.equal(
      after.body.score.total,
      beforeTotal,
      "達成當下的分值已凍結，事後調高不該回頭補給早就拿到的人",
    );
  });

  it("調高門檻不會收回已經達成的成就", async () => {
    const adminCookie = await loginAsAdmin();
    const created = await post("/api/admin/achievements", VALID, adminCookie);

    const ming = await joinAs("陳小明");
    await scan(ming, await joinAs("甲"));
    await scan(ming, await joinAs("乙"));

    await send(
      "PATCH",
      `/api/admin/achievements/${created.body.id}`,
      { ...VALID, threshold: 50 },
      adminCookie,
    );

    const me = await get("/api/me", ming.cookie);
    const earned = me.body.achievements.find(
      (x: { key: string }) => x.key === "test-achievement",
    );
    assert.ok(earned?.earned, "成就一旦公告就是承諾，不會事後收回");
  });

  it("沒有人達成時可以刪除", async () => {
    const adminCookie = await loginAsAdmin();
    const created = await post("/api/admin/achievements", VALID, adminCookie);

    const res = await send(
      "DELETE",
      `/api/admin/achievements/${created.body.id}`,
      undefined,
      adminCookie,
    );

    assert.equal(res.status, 200);
  });

  it("已經有人達成就不能刪除", async () => {
    const adminCookie = await loginAsAdmin();
    const created = await post("/api/admin/achievements", VALID, adminCookie);

    const ming = await joinAs("陳小明");
    await scan(ming, await joinAs("甲"));
    await scan(ming, await joinAs("乙"));
    await get("/api/me", ming.cookie); // 觸發評估

    const res = await send(
      "DELETE",
      `/api/admin/achievements/${created.body.id}`,
      undefined,
      adminCookie,
    );

    assert.equal(
      res.status,
      409,
      "外鍵是 cascade，刪掉定義會連帶抹掉所有人的達成紀錄與分數",
    );
    assert.ok(res.body.error.includes("隱藏"), "要告訴管理員正確的做法是什麼");
  });

  it("刪除被擋下後，達成紀錄與分數都還在", async () => {
    const adminCookie = await loginAsAdmin();
    const created = await post("/api/admin/achievements", VALID, adminCookie);

    const ming = await joinAs("陳小明");
    await scan(ming, await joinAs("甲"));
    await scan(ming, await joinAs("乙"));
    const before = await get("/api/me", ming.cookie);

    await send(
      "DELETE",
      `/api/admin/achievements/${created.body.id}`,
      undefined,
      adminCookie,
    );

    const after = await get("/api/me", ming.cookie);
    assert.equal(after.body.score.total, before.body.score.total);
  });

  it("一般參與者不能修改成就", async () => {
    const ming = await joinAs("陳小明");

    const res = await post("/api/admin/achievements", VALID, ming.cookie);

    assert.equal(res.status, 401);
  });

  it("未登入者不能讀取成就設定", async () => {
    const res = await fetch(`${BASE}/api/admin/achievements`);

    assert.equal(res.status, 401);
  });
});
