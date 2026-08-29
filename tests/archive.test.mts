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
      realName: "遲到的人",
      icons: ["music", "game", "food"],
      bio: "我來晚了",
    });

    assert.equal(res.status, 409);
  });

  /*
    短評凍結。兩件事同時被守住：
    分數不會在活動結束後還變動，牆面也不會在別人回頭細看時被改掉。
  */
  it("封存後不能再寫短評", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    const adminCookie = await loginAsAdmin();

    await post("/api/admin/archive", {}, adminCookie);

    const res = await post(
      "/api/impressions",
      { subjectId: hua.id, text: "封存後才寫的" },
      ming.cookie,
    );
    assert.equal(res.status, 409);
    assert.equal(res.body.reason, "archived");
  });

  it("封存後不能修改已經寫過的短評", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    await post("/api/impressions", { subjectId: hua.id, text: "原本的" }, ming.cookie);
    const adminCookie = await loginAsAdmin();

    await post("/api/admin/archive", {}, adminCookie);

    const res = await post(
      "/api/impressions",
      { subjectId: hua.id, text: "偷偷改掉" },
      ming.cookie,
    );
    assert.equal(res.status, 409);

    const wall = await get("/api/impressions/received", hua.cookie);
    assert.equal(
      wall.body.impressions[0].text,
      "原本的",
      "收件人無從得知內容變過，所以封存後那面牆必須是穩定的",
    );
  });

  it("封存後補寫不會改變分數", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/archive", {}, adminCookie);
    const before = await get("/api/me", ming.cookie);

    await post(
      "/api/impressions",
      { subjectId: hua.id, text: "補寫加分" },
      ming.cookie,
    );

    const after = await get("/api/me", ming.cookie);
    assert.equal(
      after.body.score.total,
      before.body.score.total,
      "允許事後補寫等於讓排行榜在活動結束後還會變動",
    );
  });

  it("封存後仍看得到自己寫過的短評", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    await post("/api/impressions", { subjectId: hua.id, text: "很高興認識你" }, ming.cookie);
    const adminCookie = await loginAsAdmin();

    await post("/api/admin/archive", {}, adminCookie);

    const wall = await get("/api/impressions/received", hua.cookie);
    assert.equal(
      wall.body.impressions[0].text,
      "很高興認識你",
      "凍結的是修改，不是查看——封存不等於刪除",
    );
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

/** DELETE 沒有對應的 post() helper，這裡直接發。 */
async function reopen(cookie?: string) {
  const res = await fetch(`${BASE}/api/admin/archive`, {
    method: "DELETE",
    headers: cookie ? { cookie } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("解除封存", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await reactivateEvents();
  });
  after(async () => {
    await reactivateEvents();
    await disconnect();
  });

  it("重新開放後可以再次報到", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/archive", {}, adminCookie);

    await reopen(adminCookie);

    const res = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "1234",
      nickname: "重開之後才來的",
      realName: "重開之後才來的",
      icons: ["music", "game", "food"],
      bio: "趕上了",
    });
    assert.equal(res.status, 201, "誤按封存不該讓整場活動就此結束");
  });

  it("重新開放後可以再次收集", async () => {
    const adminCookie = await loginAsAdmin();
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await post("/api/admin/archive", {}, adminCookie);

    await reopen(adminCookie);

    const res = await scan(ming, hua);
    assert.equal(res.status, 201);
  });

  it("保留期限一併取消", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/archive", {}, adminCookie);

    const res = await reopen(adminCookie);

    assert.equal(res.status, 200);
    assert.equal(
      res.body.status,
      "ACTIVE",
      "留著舊的 purgeAfter 會讓畫面顯示一個已經不成立的刪除日期",
    );
  });

  it("一般參與者不能重新開放活動", async () => {
    const adminCookie = await loginAsAdmin();
    const ming = await joinAs("陳小明");
    await post("/api/admin/archive", {}, adminCookie);

    const res = await reopen(ming.cookie);

    assert.equal(res.status, 401);
  });

  it("未登入者不能重新開放活動", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/archive", {}, adminCookie);

    const res = await reopen();

    assert.equal(res.status, 401);
  });

  it("沒有已封存的活動時回傳 404", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await reopen(adminCookie);

    assert.equal(res.status, 404);
  });
});
