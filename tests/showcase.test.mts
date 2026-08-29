import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  requireServer,
  resetParticipants,
  scan,
  type Session,
} from "./helpers.mts";

async function put(path: string, body: unknown, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8", cookie },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** 建立 n 位已被 who 收集的對象。 */
async function collectOthers(who: Session, n: number): Promise<Session[]> {
  const out: Session[] = [];
  for (let i = 0; i < n; i++) {
    const other = await joinAs(`路人${i}`);
    await scan(who, other);
    out.push(other);
  }
  return out;
}

describe("九宮格", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("可以放入已收集的人", async () => {
    const ming = await joinAs("陳小明");
    const [a, b] = await collectOthers(ming, 2);

    const res = await put("/api/showcase", { subjectIds: [a.id, b.id] }, ming.cookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.slots.length, 2);
    assert.equal(res.body.slots[0].subjectId, a.id);
  });

  it("最多九格", async () => {
    const ming = await joinAs("陳小明");
    const others = await collectOthers(ming, 10);

    const res = await put(
      "/api/showcase",
      { subjectIds: others.map((o) => o.id) },
      ming.cookie,
    );

    assert.equal(res.status, 400, "超過九格應被拒絕");
  });

  it("不能放入還沒收集的人", async () => {
    const ming = await joinAs("陳小明");
    const stranger = await joinAs("陌生人");

    const res = await put(
      "/api/showcase",
      { subjectIds: [stranger.id] },
      ming.cookie,
    );

    assert.equal(res.status, 403);
  });

  it("別人的九宮格是公開可瀏覽的", async () => {
    const ming = await joinAs("陳小明");
    const [a] = await collectOthers(ming, 1);
    await put("/api/showcase", { subjectIds: [a.id] }, ming.cookie);

    const viewer = await joinAs("路人甲");
    const res = await get(`/api/showcase/${ming.id}`, viewer.cookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.slots.length, 1);
  });

  it("空格會被保留，位置不會被壓實", async () => {
    const ming = await joinAs("陳小明");
    const [a, b] = await collectOthers(ming, 2);

    // 對角線擺法：第 0 格與第 8 格，中間全空
    const res = await put(
      "/api/showcase",
      { subjectIds: [a.id, null, null, null, null, null, null, null, b.id] },
      ming.cookie,
    );
    assert.equal(res.status, 200);

    const own = await get(`/api/showcase/${ming.id}`, ming.cookie);
    const positions = own.body.slots.map((s: { position: number }) => s.position);
    assert.deepEqual(
      positions.sort((x: number, y: number) => x - y),
      [0, 8],
      "擺法本身就是使用者想表達的東西，壓實之後拖拉擺放就失去意義了",
    );
  });

  it("全部留空是合法的", async () => {
    const ming = await joinAs("陳小明");
    const [a] = await collectOthers(ming, 1);
    await put("/api/showcase", { subjectIds: [a.id] }, ming.cookie);

    const res = await put(
      "/api/showcase",
      { subjectIds: [null, null, null] },
      ming.cookie,
    );

    assert.equal(res.status, 200, "清空九宮格不該被當成錯誤");
    const own = await get(`/api/showcase/${ming.id}`, ming.cookie);
    assert.equal(own.body.slots.length, 0);
  });

  it("空格不影響「只能放已收集的人」的檢查", async () => {
    const ming = await joinAs("陳小明");
    const stranger = await joinAs("沒收集過的人");

    const res = await put(
      "/api/showcase",
      { subjectIds: [null, stranger.id] },
      ming.cookie,
    );

    assert.equal(res.status, 403);
  });

  it("不提供「我被幾個人放入九宮格」的反向查詢", async () => {
    const ming = await joinAs("陳小明");
    const [popular] = await collectOthers(ming, 1);
    await put("/api/showcase", { subjectIds: [popular.id] }, ming.cookie);

    // 被選中的人查詢自己的所有資料，都不該出現這個數字
    const me = await get("/api/me", popular.cookie);
    const wall = await get("/api/impressions/received", popular.cookie);
    const own = await get(`/api/showcase/${popular.id}`, popular.cookie);

    const payload = JSON.stringify([me.body, wall.body, own.body]);
    for (const leak of ["showcasedBy", "featuredCount", "showcaseCount", "timesShowcased"]) {
      assert.ok(!payload.includes(leak), `不該回傳 ${leak}`);
    }
  });
});
