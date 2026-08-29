import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  loginAs,
  requireServer,
  resetParticipants,
} from "./helpers.mts";

describe("寄信紀錄", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("報到時填了信箱就會留下一筆紀錄", async () => {
    await joinAs("陳小明", { email: "ming@example.com" });
    const adminCookie = await loginAs("admin", "change-me");

    const res = await get("/api/admin/mail-log", adminCookie);

    assert.equal(res.status, 200);
    const entry = res.body.logs.find(
      (l: { to: string }) => l.to === "ming@example.com",
    );
    assert.ok(entry, "寄信失敗在畫面上是無聲的，沒有紀錄就沒有人會發現");
  });

  it("測試環境沒有設定 SMTP，狀態應為 SKIPPED 而非 SENT", async () => {
    await joinAs("陳小明", { email: "ming@example.com" });
    const adminCookie = await loginAs("admin", "change-me");

    const res = await get("/api/admin/mail-log", adminCookie);
    const entry = res.body.logs.find(
      (l: { to: string }) => l.to === "ming@example.com",
    );

    assert.equal(
      entry.status,
      "SKIPPED",
      "沒設定 SMTP 不是寄信失敗，是環境沒設好——記成 SENT 會讓人以為信寄出去了",
    );
  });

  it("沒填信箱的人不會產生紀錄", async () => {
    await joinAs("沒填信箱的人");
    const adminCookie = await loginAs("admin", "change-me");

    const res = await get("/api/admin/mail-log", adminCookie);

    assert.equal(res.body.logs.length, 0);
  });

  it("刪除參與者時紀錄一併消失", async () => {
    await joinAs("陳小明", { email: "ming@example.com" });
    const adminCookie = await loginAs("admin", "change-me");
    assert.ok((await get("/api/admin/mail-log", adminCookie)).body.logs.length > 0);

    await resetParticipants();

    const res = await get("/api/admin/mail-log", adminCookie);
    assert.equal(
      res.body.logs.length,
      0,
      "紀錄裡存了收件信箱，不能比本人的資料活得更久",
    );
  });

  it("一般參與者讀不到寄信紀錄", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });

    const res = await get("/api/admin/mail-log", ming.cookie);

    assert.equal(res.status, 401);
  });

  it("未登入者讀不到寄信紀錄", async () => {
    const res = await fetch(`${BASE}/api/admin/mail-log`);

    assert.equal(res.status, 401);
  });
});
