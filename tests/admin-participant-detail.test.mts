import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  createHostAdmin,
  disconnect,
  get,
  joinAs,
  loginAs,
  post,
  removeTestAdmins,
  requireServer,
  resetParticipants,
  scan,
  secondEventId,
} from "./helpers.mts";

/** 讓 b 收到 a 寫的一則短評。 */
async function writeTo(a: Awaited<ReturnType<typeof joinAs>>, b: Awaited<ReturnType<typeof joinAs>>, text: string) {
  await scan(a, b);
  await post("/api/impressions", { subjectId: b.id, text }, a.cookie);
}

describe("後台查看參與者的牆與九宮格", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await removeTestAdmins();
  });
  after(async () => {
    await removeTestAdmins();
    await disconnect();
  });

  it("看得到收到的短評與作者", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await writeTo(hua, ming, "很會照顧人");
    const adminCookie = await loginAs("admin", "change-me");

    const res = await get(`/api/admin/participants/${ming.id}/detail`, adminCookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.wall.length, 1);
    assert.equal(res.body.wall[0].text, "很會照顧人");
    assert.equal(
      res.body.wall[0].authorNickname,
      "林小華",
      "Impression 必定具名，審核時要看得出是誰寫的",
    );
  });

  it("被收件人隱藏的內容仍然看得到，並標示出來", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await writeTo(hua, ming, "不太好的話");

    const wall = await get("/api/impressions/received", ming.cookie);
    await post(
      "/api/impressions/hide",
      { impressionId: wall.body.impressions[0].id, report: true },
      ming.cookie,
    );

    const adminCookie = await loginAs("admin", "change-me");
    const res = await get(`/api/admin/participants/${ming.id}/detail`, adminCookie);

    assert.equal(
      res.body.wall.length,
      1,
      "隱藏只影響收件人自己的檢視，不刪除資料——Admin 仍須能查看以進行審核",
    );
    assert.equal(res.body.wall[0].hidden, true, "要標示出來，那正是需要被看的內容");
  });

  it("看得到九宮格與每個人的位置", async () => {
    const ming = await joinAs("陳小明");
    const a = await joinAs("甲");
    await scan(ming, a);
    await fetch(`${BASE}/api/showcase`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: ming.cookie },
      body: JSON.stringify({ subjectIds: [null, null, a.id] }),
    });
    const adminCookie = await loginAs("admin", "change-me");

    const res = await get(`/api/admin/participants/${ming.id}/detail`, adminCookie);

    assert.equal(res.body.showcase.length, 1);
    assert.equal(res.body.showcase[0].position, 2, "位置要照實回傳，不能壓實");
    assert.equal(res.body.showcase[0].nickname, "甲");
  });

  it("一般參與者讀不到別人的牆", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await writeTo(hua, ming, "很會照顧人");

    const res = await get(`/api/admin/participants/${ming.id}/detail`, hua.cookie);

    assert.equal(res.status, 401, "短評只有收件人與 Admin 看得到（ADR-0003）");
  });

  it("未登入者讀不到", async () => {
    const ming = await joinAs("陳小明");

    const res = await fetch(`${BASE}/api/admin/participants/${ming.id}/detail`);

    assert.equal(res.status, 401);
  });

  it("別場的主持人讀不到，且回應與不存在無法區分", async () => {
    const ming = await joinAs("陳小明");
    const superCookie = await loginAs("admin", "change-me");
    await secondEventId(superCookie);
    await createHostAdmin("test-host", "hostpass123");
    const cookie = await loginAs("test-host", "hostpass123");

    const real = await get(`/api/admin/participants/${ming.id}/detail`, cookie);
    const fake = await get("/api/admin/participants/nosuchperson/detail", cookie);

    assert.equal(real.status, 404);
    assert.deepEqual(
      real.body,
      fake.body,
      "兩者可區分的話，就能拿 id 探測別場有哪些人",
    );
  });
});
