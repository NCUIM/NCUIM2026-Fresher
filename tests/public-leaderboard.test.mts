import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  loginAs,
  post,
  reactivateEvents,
  removeTestAdmins,
  requireServer,
  resetParticipants,
  scan,
} from "./helpers.mts";

type PublicBoard = {
  event: { name: string };
  updatedAt: string;
  totalRanked: number;
  top: { rank: number; nickname: string; score: number }[];
};

/** 取得目前這場活動的 id。 */
async function currentEventId(): Promise<string> {
  const cookie = await loginAs("admin", "change-me");
  const res = await get("/api/admin/events", cookie);
  return res.body.events[0].id;
}

/** 開啟或關閉這場活動的對外公開。預設是關閉的。 */
async function setPublic(open: boolean): Promise<string> {
  const eventId = await currentEventId();
  const cookie = await loginAs("admin", "change-me");
  const current = await get("/api/admin/event", cookie);
  await fetch(`${BASE}/api/admin/event`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    // 設定端點會整包覆寫，所以要把現有的值一起帶回去。
    body: JSON.stringify({ ...current.body, eventId, publicLeaderboard: open }),
  });
  return eventId;
}

describe("公開唯讀排行榜", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await removeTestAdmins();
    await reactivateEvents();
    await setPublic(true);
  });
  // 每一個案例結束後關回去，避免影響其他測試檔對這場活動的預期。
  afterEach(async () => {
    await setPublic(false);
  });
  after(async () => {
    await removeTestAdmins();
    await reactivateEvents();
    await disconnect();
  });

  it("不需要報到就能讀", async () => {
    const eventId = await currentEventId();
    const res = await get<PublicBoard>(
      `/api/public/leaderboard?eventId=${eventId}`,
    );

    assert.equal(res.status, 200, "站外頁面沒有 cookie，也該讀得到");
    assert.ok(Array.isArray(res.body.top));
    assert.equal(typeof res.body.event.name, "string");
  });

  it("不洩漏 participantId", async () => {
    /*
      participantId 不是機密——頭像端點也用它——但它是內部識別碼，
      沒有理由灑到公開網路上。對外只需要名次、暱稱、分數。
    */
    const a = await joinAs("甲");
    const b = await joinAs("乙");
    await scan(a, b);
    await post("/api/impressions", { subjectId: b.id, text: "很好聊的一個人" }, a.cookie);

    const eventId = await currentEventId();
    const res = await get<PublicBoard>(
      `/api/public/leaderboard?eventId=${eventId}`,
    );

    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes(a.id), "回應裡不該出現 participantId");
    assert.ok(!raw.includes(b.id), "回應裡不該出現 participantId");
    for (const row of res.body.top) {
      assert.deepEqual(
        Object.keys(row).sort(),
        ["nickname", "rank", "score"],
        "對外的欄位只有這三個",
      );
    }
  });

  it("不洩漏真實姓名與信箱", async () => {
    // 這兩樣是這個系統裡唯二的個資，公開端點碰都不該碰到。
    await joinAs("小明", {
      realName: "陳某某",
      email: "someone@example.com",
    });

    const eventId = await currentEventId();
    const res = await get<PublicBoard>(
      `/api/public/leaderboard?eventId=${eventId}`,
    );

    const raw = JSON.stringify(res.body);
    assert.ok(!raw.includes("陳某某"), "不該出現真實姓名");
    assert.ok(!raw.includes("someone@example.com"), "不該出現信箱");
  });

  it("不帶 eventId 時自動用當下進行中的那一場", async () => {
    /*
      要求站外頁面寫死一個 id 是個陷阱：活動重建過 id 就變了，而那個
      頁面不會有錯誤提示，只會安靜地停在 404。只有一場進行中的時候，
      「哪一場」沒有歧義，就不該逼呼叫端去查。
    */
    const withId = await get<PublicBoard>(
      `/api/public/leaderboard?eventId=${await currentEventId()}`,
    );
    const withoutId = await get<PublicBoard>("/api/public/leaderboard");

    assert.equal(withoutId.status, 200);
    assert.equal(withoutId.body.event.name, withId.body.event.name);
  });

  it("沒有任何進行中的活動時回 404", async () => {
    const eventId = await currentEventId();
    const cookie = await loginAs("admin", "change-me");
    await post("/api/admin/archive", { eventId }, cookie);

    const res = await get("/api/public/leaderboard");
    assert.equal(res.status, 404);
  });

  it("不存在的活動回 404，而且與已封存的回應一致", async () => {
    /*
      兩者必須是同一個回應。若「不存在」與「存在但已封存」可以分辨，
      拿 id 逐一試就能問出哪些活動存在過。
    */
    const missing = await get("/api/public/leaderboard?eventId=not-a-real-id");
    assert.equal(missing.status, 404);

    const eventId = await currentEventId();
    const cookie = await loginAs("admin", "change-me");
    await post("/api/admin/archive", { eventId }, cookie);

    const archived = await get(`/api/public/leaderboard?eventId=${eventId}`);
    assert.equal(archived.status, 404, "封存後就不再公開");
    assert.deepEqual(archived.body, missing.body, "兩種情況的回應要一模一樣");
  });

  it("沒開放公開時讀不到，而且與不存在的回應一致", async () => {
    /*
      預設關閉是刻意的：開放等於讓全世界看得到所有人的暱稱與分數。
      而「沒開放」與「不存在」必須是同一個回應——否則拿 id 逐一試，
      就能問出哪些活動辦過但沒公開。
    */
    const eventId = await setPublic(false);

    const closed = await get(`/api/public/leaderboard?eventId=${eventId}`);
    const missing = await get("/api/public/leaderboard?eventId=not-a-real-id");

    assert.equal(closed.status, 404);
    assert.deepEqual(closed.body, missing.body);

    // 不帶 id 也不能繞過——它只會挑已開放的場次。
    const auto = await get("/api/public/leaderboard");
    assert.equal(auto.status, 404);
  });

  it("帶著可跨來源讀取與 CDN 快取的標頭", async () => {
    /*
      這兩個標頭是這個端點能不能用、以及會不會被打爆的關鍵：
      Allow-Origin 決定站外的 JS 讀不讀得到；s-maxage 決定資料庫
      是「每個請求被查一次」還是「每三十秒被查一次」。
    */
    const eventId = await currentEventId();
    const res = await fetch(`${BASE}/api/public/leaderboard?eventId=${eventId}`);

    assert.equal(res.headers.get("access-control-allow-origin"), "*");
    const cache = res.headers.get("cache-control") ?? "";
    assert.ok(cache.includes("s-maxage="), `應有 CDN 快取設定，實際：${cache}`);
    assert.ok(cache.includes("public"), "要允許共用快取");
  });
});
