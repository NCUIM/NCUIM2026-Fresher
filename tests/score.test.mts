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
} from "./helpers.mts";

const writeImpression = (author: { cookie: string }, subjectId: string) =>
  post("/api/impressions", { subjectId, text: "很高興認識你" }, author.cookie);

describe("基礎分", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("收集了但還沒寫 Impression 時不計分", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);

    const res = await get("/api/me", ming.cookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.score.base, 0, "尚未撰寫就不該入帳");
  });

  it("撰寫後入帳", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    await writeImpression(ming, hua.id);

    const res = await get("/api/me", ming.cookie);

    assert.equal(res.body.score.base, 10, "示範活動的 basePoints 為 10");
  });

  it("雙方各自獨立判定：A 寫了而 B 沒寫，只有 A 入帳", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    await writeImpression(ming, hua.id);
    // 小華刻意不寫

    const mingRes = await get("/api/me", ming.cookie);
    const huaRes = await get("/api/me", hua.cookie);

    assert.equal(mingRes.body.score.base, 10, "小明寫了，應入帳");
    assert.equal(huaRes.body.score.base, 0, "小華沒寫，不應入帳");
  });

  it("基礎分不受掃描發起方影響：被掃的一方寫了也照樣入帳", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua); // 小明發起
    await writeImpression(hua, ming.id); // 但由被掃的小華撰寫

    const huaRes = await get("/api/me", hua.cookie);

    assert.equal(
      huaRes.body.score.base,
      10,
      "沒有發起掃描的一方寫了也該入帳，否則他沒有任何動機撰寫",
    );
  });
});

describe("待撰寫清單", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("列出已收集但尚未撰寫的對象", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    const mei = await joinAs("王大美");
    await scan(ming, hua);
    await scan(ming, mei);
    await writeImpression(ming, hua.id); // 只寫了小華

    const res = await get("/api/me", ming.cookie);

    const pending = res.body.pendingImpressions;
    assert.equal(pending.length, 1, "只剩王大美還沒寫");
    assert.equal(pending[0].nickname, "王大美");
  });

  it("全部寫完後清單為空", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);
    await writeImpression(ming, hua.id);

    const res = await get("/api/me", ming.cookie);

    assert.deepEqual(res.body.pendingImpressions, []);
  });
});
