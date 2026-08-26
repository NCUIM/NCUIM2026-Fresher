import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  post,
  reactivateEvents,
  requireServer,
  resetParticipants,
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

describe("封存", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await reactivateEvents();
  });
  after(async () => {
    await reactivateEvents();
    await disconnect();
  });

  it("封存後無法再收集", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    const adminCookie = await loginAsAdmin();

    await post("/api/admin/archive", {}, adminCookie);

    const res = await scan(ming, hua);
    assert.equal(res.status, 409);
    assert.equal(res.body.reason, "archived");
  });

  it("封存後仍看得到已收集的成果", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    const adminCookie = await loginAsAdmin();

    await post("/api/admin/archive", {}, adminCookie);

    const res = await get("/api/me", ming.cookie);
    assert.equal(res.status, 200, "查看功能必須維持可用");
  });

  it("封存後無法再報到", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/archive", {}, adminCookie);

    const res = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "1234",
      nickname: "遲到的人",
      icons: ["music", "game", "food"],
    });

    assert.equal(res.status, 409);
  });

  it("設定十四天後的刪除日期", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await post("/api/admin/archive", {}, adminCookie);

    assert.equal(res.status, 200);
    const purge = new Date(res.body.purgeAfter).getTime();
    const archived = new Date(res.body.archivedAt).getTime();
    const days = (purge - archived) / 86_400_000;
    assert.ok(Math.abs(days - 14) < 0.01, `保留期應為 14 天，實際 ${days}`);
  });

  it("一般參與者不能封存活動", async () => {
    const ming = await joinAs("陳小明");

    const res = await post("/api/admin/archive", {}, ming.cookie);

    assert.equal(res.status, 401);
  });
});
