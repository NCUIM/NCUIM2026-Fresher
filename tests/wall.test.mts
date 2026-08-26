import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  disconnect,
  get,
  joinAs,
  post,
  requireServer,
  resetParticipants,
  scan,
  type Session,
} from "./helpers.mts";

async function meetAndWrite(a: Session, b: Session, text: string) {
  await scan(a, b);
  await post("/api/impressions", { subjectId: b.id, text }, a.cookie);
}

describe("Impression Wall 隱私（ADR-0003）", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("收件人看得到寫給自己的內容，且知道是誰寫的", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await meetAndWrite(ming, hua, "你笑起來很有感染力");

    const res = await get("/api/impressions/received", hua.cookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.impressions.length, 1);
    assert.equal(res.body.impressions[0].text, "你笑起來很有感染力");
    assert.equal(
      res.body.impressions[0].authorNickname,
      "陳小明",
      "一律具名：收件人必須知道是誰寫的",
    );
  });

  it("其他人讀不到不是寫給自己的內容", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    const nosy = await joinAs("愛偷看的人");
    await meetAndWrite(ming, hua, "只有小華該看到這句");

    const res = await get("/api/impressions/received", nosy.cookie);

    const texts = res.body.impressions.map((i: any) => i.text);
    assert.ok(
      !texts.includes("只有小華該看到這句"),
      `牆面只屬於收件人，實際回傳：${JSON.stringify(texts)}`,
    );
  });
});

describe("隱藏與回報", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("收件人隱藏後，自己的牆上不再出現", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await meetAndWrite(ming, hua, "讓人不太舒服的一句話");

    const before = await get("/api/impressions/received", hua.cookie);
    const target = before.body.impressions[0];

    const hide = await post(
      "/api/impressions/hide",
      { impressionId: target.id, report: true },
      hua.cookie,
    );
    assert.equal(hide.status, 200);

    const after = await get("/api/impressions/received", hua.cookie);
    assert.equal(after.body.impressions.length, 0, "隱藏後不該再看到");
  });

  it("作者無從得知自己寫的內容是否被隱藏", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await meetAndWrite(ming, hua, "原本的內容");

    const received = await get("/api/impressions/received", hua.cookie);
    await post(
      "/api/impressions/hide",
      { impressionId: received.body.impressions[0].id, report: false },
      hua.cookie,
    );

    // 作者唯一能碰到這則 Impression 的途徑就是改寫它
    const rewrite = await post(
      "/api/impressions",
      { subjectId: hua.id, text: "改寫後的內容" },
      ming.cookie,
    );

    assert.equal(rewrite.status, 200);
    const leaked = JSON.stringify(rewrite.body);
    assert.ok(!leaked.includes("hidden"), `回應洩漏了隱藏狀態：${leaked}`);
    assert.ok(!leaked.includes("report"), `回應洩漏了回報狀態：${leaked}`);
  });

  it("別人不能隱藏不是寫給自己的內容", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    const nosy = await joinAs("愛偷看的人");
    await meetAndWrite(ming, hua, "小華專屬");

    const received = await get("/api/impressions/received", hua.cookie);
    const id = received.body.impressions[0].id;

    const res = await post(
      "/api/impressions/hide",
      { impressionId: id, report: false },
      nosy.cookie,
    );

    assert.equal(res.status, 404, "對非收件人而言這則根本不存在");

    const still = await get("/api/impressions/received", hua.cookie);
    assert.equal(still.body.impressions.length, 1, "小華的牆不該被別人動到");
  });
});
