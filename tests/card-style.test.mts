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
  scan,
} from "./helpers.mts";

const PRESET = "/avatars/anime/anime_01.png";

async function putProfile(cookie: string, extra: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8", cookie },
    body: JSON.stringify({
      nickname: "陳小明",
      realName: "陳小明",
      icons: ["music", "game", "food"],
      bio: "很高興認識大家",
      ...extra,
    }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("卡片底色與預設頭像", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("報到時選的底色會出現在別人收集到的卡片上", async () => {
    const ming = await joinAs("陳小明", { cardColor: "flare" });
    const hua = await joinAs("林小華");

    const res = await scan(hua, ming);

    assert.equal(
      res.body.card.color.key,
      "flare",
      "底色是本人選的，看的人不能改——那是他對外呈現的一部分",
    );
  });

  it("沒選底色時有預設值，不會是空的", async () => {
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");

    const res = await scan(hua, ming);

    assert.ok(res.body.card.color.bg, "卡片一定要有底色，否則畫面上是透明的");
  });

  it("不存在的底色被拒絕", async () => {
    const res = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "1234",
      nickname: "亂填顏色的人",
      realName: "亂填顏色的人",
      icons: ["music", "game", "food"],
      bio: "測試",
      cardColor: "rainbow",
    });

    assert.equal(res.status, 400);
  });

  it("報到時可以選預設頭像", async () => {
    const ming = await joinAs("陳小明", { presetAvatar: PRESET });
    const hua = await joinAs("林小華");

    const res = await scan(hua, ming);

    assert.equal(res.body.card.avatarUrl, PRESET);
  });

  /*
    這是這組測試裡最重要的一條。avatarUrl 會出現在每一個收集過此人的
    參與者手上，若能填任意網址，那就是一個我們管不到、而且對方可以
    隨時抽換內容的圖床。
  */
  it("外部網址不能當頭像", async () => {
    const res = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "1234",
      nickname: "想放外部圖的人",
      realName: "想放外部圖的人",
      icons: ["music", "game", "food"],
      bio: "測試",
      presetAvatar: "https://example.com/evil.png",
    });

    assert.equal(res.status, 400);
  });

  it("偽裝成預設路徑的字串也不行", async () => {
    const res = await post("/api/join", {
      entryCode: "JOINNCU1",
      passcode: "1234",
      nickname: "想繞過檢查的人",
      realName: "想繞過檢查的人",
      icons: ["music", "game", "food"],
      bio: "測試",
      presetAvatar: "/avatars/anime/../../../etc/passwd",
    });

    assert.equal(res.status, 400, "比對的是完整清單，不是前綴");
  });

  it("可以在個人資料頁換底色與頭像", async () => {
    const ming = await joinAs("陳小明");

    const res = await putProfile(ming.cookie, {
      cardColor: "violet",
      presetAvatar: PRESET,
    });

    assert.equal(res.status, 200);
    const me = await get("/api/me", ming.cookie);
    assert.equal(me.body.avatarUrl, PRESET);
  });

  it("沒有傳 presetAvatar 時不會清掉現有頭像", async () => {
    const ming = await joinAs("陳小明", { presetAvatar: PRESET });

    // 只改暱稱，完全不提頭像
    await putProfile(ming.cookie, { nickname: "改了暱稱" });

    const me = await get("/api/me", ming.cookie);
    assert.equal(
      me.body.avatarUrl,
      PRESET,
      "上傳的照片也存在同一個欄位，無條件覆寫會讓每次存檔都把它清掉",
    );
  });

  it("傳 null 才是明確要移除頭像", async () => {
    const ming = await joinAs("陳小明", { presetAvatar: PRESET });

    await putProfile(ming.cookie, { presetAvatar: null });

    const me = await get("/api/me", ming.cookie);
    assert.equal(me.body.avatarUrl, null);
  });
});
