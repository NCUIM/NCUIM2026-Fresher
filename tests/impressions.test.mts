import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  disconnect,
  joinAs,
  post,
  requireServer,
  resetParticipants,
  scan,
} from "./helpers.mts";

describe("Impression 撰寫", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("可以為已收集的對象寫下一段話", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);

    const res = await post(
      "/api/impressions",
      { subjectId: hua.id, text: "講話很好笑，聊到停不下來" },
      ming.cookie,
    );

    assert.equal(res.status, 201);
    assert.equal(res.body.text, "講話很好笑，聊到停不下來");
  });

  it("不能對還沒收集的人撰寫", async () => {
    const ming = await joinAs("陳小明");
    const stranger = await joinAs("王大美");
    // 刻意不掃描：兩人沒有互動過

    const res = await post(
      "/api/impressions",
      { subjectId: stranger.id, text: "我們根本還沒見過面" },
      ming.cookie,
    );

    assert.equal(res.status, 403);
  });

  it("再次撰寫同一個人是修改，不是新增一則", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);

    const first = await post(
      "/api/impressions",
      { subjectId: hua.id, text: "第一次寫的內容" },
      ming.cookie,
    );
    const second = await post(
      "/api/impressions",
      { subjectId: hua.id, text: "想到更好的說法了" },
      ming.cookie,
    );

    assert.equal(second.status, 200, "修改應回傳 200 而非 201");
    assert.equal(second.body.text, "想到更好的說法了");
    assert.equal(second.body.id, first.body.id, "應更新同一則，不是建立新的");
  });

  it("超過 50 字被拒絕", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);

    const res = await post(
      "/api/impressions",
      { subjectId: hua.id, text: "字".repeat(51) },
      ming.cookie,
    );

    assert.equal(res.status, 400);
  });

  it("自我介紹為必填，留空的報到被拒絕", async () => {
    const res = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "1234",
      nickname: "沒寫自介的人",
      realName: "沒寫自介的人",
      icons: ["music", "game", "food"],
      bio: "   ",
    });

    assert.equal(res.status, 400, "只有暱稱和圖示的卡片，別人看了不知道能聊什麼");
  });
});
