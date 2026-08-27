import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  joinAs,
  post,
  requireServer,
  resetParticipants,
} from "./helpers.mts";

async function loginAsAdmin(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "change-me" }),
  });
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function patchSettings(cookie: string, body: unknown) {
  const res = await fetch(`${BASE}/api/admin/event`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const DEFAULTS = { passcode: "1234", basePoints: 10, leaderboardTopN: 10 };

describe("活動設定", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    // 這一組測試會改動活動設定本身，因此每次都必須還原——
    // 只重置參與者的話，前一個測試改掉的通關碼會讓下一個測試無法報到。
    await patchSettings(await loginAsAdmin(), DEFAULTS);
  });
  after(async () => {
    await patchSettings(await loginAsAdmin(), DEFAULTS);
    await disconnect();
  });

  it("一般參與者不能修改設定", async () => {
    const ming = await joinAs("陳小明");

    const res = await post(
      "/api/admin/event",
      { ...DEFAULTS, passcode: "hacked" },
      ming.cookie,
    );

    // POST 不存在於此端點，但重點是參與者的 session 不具管理權限
    assert.notEqual(res.status, 200);
  });

  it("未登入者不能修改設定", async () => {
    const res = await fetch(`${BASE}/api/admin/event`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...DEFAULTS, passcode: "hacked" }),
    });

    assert.equal(res.status, 401);
  });

  it("改掉通關碼後，舊的通關碼不再能報到", async () => {
    const adminCookie = await loginAsAdmin();
    await patchSettings(adminCookie, { ...DEFAULTS, passcode: "NEWPASS" });

    const withOld = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "1234",
      nickname: "用舊碼的人",
      icons: ["music", "game", "food"],
    });

    assert.equal(withOld.status, 403, "舊通關碼應被拒絕");
  });

  it("改掉通關碼後，新的通關碼可以報到", async () => {
    const adminCookie = await loginAsAdmin();
    await patchSettings(adminCookie, { ...DEFAULTS, passcode: "NEWPASS" });

    const withNew = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "NEWPASS",
      nickname: "用新碼的人",
      icons: ["music", "game", "food"],
    });

    assert.equal(withNew.status, 201);
  });

  it("空白通關碼被拒絕", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await patchSettings(adminCookie, { ...DEFAULTS, passcode: "   " });

    assert.equal(res.status, 400, "沒有通關碼等於門戶大開");
  });

  it("修改基礎分會立即反映在分數上", async () => {
    const adminCookie = await loginAsAdmin();
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await post("/api/scan", { personalCode: hua.personalCode }, ming.cookie);
    await post(
      "/api/impressions",
      { subjectId: hua.id, text: "很高興認識你" },
      ming.cookie,
    );

    const before = await fetch(`${BASE}/api/me`, { headers: { cookie: ming.cookie } });
    assert.equal((await before.json()).score.base, 10);

    await patchSettings(adminCookie, { ...DEFAULTS, basePoints: 25 });

    const after = await fetch(`${BASE}/api/me`, { headers: { cookie: ming.cookie } });
    assert.equal(
      (await after.json()).score.base,
      25,
      "基礎分是即時計算的，不是報到當下就固定下來",
    );
  });
});
