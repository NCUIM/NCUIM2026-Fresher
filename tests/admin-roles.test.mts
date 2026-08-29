import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  assignHost,
  createHostAdmin,
  disconnect,
  get,
  joinAs,
  loginAs,
  post,
  removeTestAdmins,
  requireServer,
  resetParticipants,
  secondEventId,
} from "./helpers.mts";

async function send(method: "PATCH" | "DELETE", path: string, body: unknown, cookie: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("管理員分級", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await removeTestAdmins();
  });
  after(async () => {
    await removeTestAdmins();
    await disconnect();
  });

  describe("總管理員", () => {
    it("看得到所有活動", async () => {
      const cookie = await loginAs("admin", "change-me");

      const res = await get("/api/admin/events", cookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.events.length >= 1);
    });

    it("可以建立活動，並自動產生註冊碼、分組與成就", async () => {
      const cookie = await loginAs("admin", "change-me");

      const res = await post(
        "/api/admin/events",
        {
          name: "測試用活動",
          passcode: "testpass",
          startsAt: new Date().toISOString(),
          teamCount: 3,
          basePoints: 10,
          leaderboardTopN: 5,
        },
        cookie,
      );

      assert.equal(res.status, 201);

      const list = await get("/api/admin/events", cookie);
      const created = list.body.events.find(
        (e: { id: string }) => e.id === res.body.id,
      );
      assert.equal(created._count.teams, 3, "沒有分組，同組成就永遠判定不出來");
      assert.ok(
        created._count.achievements > 0,
        "沒有成就，整場計分就只剩基礎分",
      );
    });

    it("可以刪除沒有參與者的活動", async () => {
      const cookie = await loginAs("admin", "change-me");
      const created = await post(
        "/api/admin/events",
        {
          name: "測試用活動（待刪）",
          passcode: "x",
          startsAt: new Date().toISOString(),
          teamCount: 0,
          basePoints: 10,
          leaderboardTopN: 10,
        },
        cookie,
      );

      const res = await send(
        "DELETE",
        `/api/admin/events/${created.body.id}`,
        undefined,
        cookie,
      );

      assert.equal(res.status, 200);
    });

    /*
      Event 是整張圖的根，cascade 會一路帶走參與者與所有短評。
      有資料的活動必須走 封存 → 保留期 → db:purge，不能一鍵刪掉。
    */
    it("有參與者的活動不能直接刪除", async () => {
      const cookie = await loginAs("admin", "change-me");
      await joinAs("陳小明");

      const list = await get("/api/admin/events", cookie);
      const seeded = list.body.events.find(
        (e: { _count: { participants: number } }) => e._count.participants > 0,
      );

      const res = await send(
        "DELETE",
        `/api/admin/events/${seeded.id}`,
        undefined,
        cookie,
      );

      assert.equal(res.status, 409);
      assert.ok(
        res.body.error.includes("purge"),
        "要告訴管理員正確的路徑是什麼，不能只說不行",
      );
    });

    it("被擋下後資料完好無損", async () => {
      const cookie = await loginAs("admin", "change-me");
      const ming = await joinAs("陳小明");

      const list = await get("/api/admin/events", cookie);
      const seeded = list.body.events.find(
        (e: { _count: { participants: number } }) => e._count.participants > 0,
      );
      await send("DELETE", `/api/admin/events/${seeded.id}`, undefined, cookie);

      const me = await get("/api/me", ming.cookie);
      assert.equal(me.status, 200, "刪除被擋下就不該有任何副作用");
    });

    it("可以管理帳號", async () => {
      const cookie = await loginAs("admin", "change-me");

      const res = await get("/api/admin/accounts", cookie);

      assert.equal(res.status, 200);
    });
  });

  describe("活動主持人", () => {
    it("看不到活動總覽", async () => {
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await get("/api/admin/events", cookie);

      assert.equal(
        res.status,
        403,
        "連活動存在幾場都不該看到——那是別人的場次資訊",
      );
    });

    it("不能建立活動", async () => {
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await post(
        "/api/admin/events",
        {
          name: "偷建的活動",
          passcode: "x",
          startsAt: new Date().toISOString(),
          teamCount: 0,
          basePoints: 10,
          leaderboardTopN: 10,
        },
        cookie,
      );

      assert.equal(res.status, 403);
    });

    it("不能管理帳號", async () => {
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await get("/api/admin/accounts", cookie);

      assert.equal(
        res.status,
        403,
        "能新增帳號就能造一個總管理員給自己，分級等於不存在",
      );
    });

    it("不能新增管理員帳號", async () => {
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await post(
        "/api/admin/accounts",
        { username: "test-sneaky", password: "password123", role: "SUPER" },
        cookie,
      );

      assert.equal(res.status, 403);
    });
  });

  describe("跨活動隔離", () => {
    it("沒有被指派任何活動的主持人看不到參與者", async () => {
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await get("/api/admin/participants", cookie);

      assert.equal(res.status, 200);
      assert.deepEqual(
        res.body.participants,
        [],
        "沒有指派就沒有任何一場的資料可看，不該落在別人的場次上",
      );
    });

    it("不能對沒有權限的活動發公告", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await post(
        "/api/admin/announcements",
        { body: "跨場公告", eventId: otherEventId },
        cookie,
      );

      assert.equal(
        res.status,
        404,
        "公告會直接推到那場所有參與者的畫面上，eventId 不能照單全收",
      );
    });

    it("不能封存沒有權限的活動", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await post(
        "/api/admin/archive",
        { eventId: otherEventId },
        cookie,
      );

      assert.equal(res.status, 404, "封存會當場關掉那場活動的報到與收集");
    });

    it("不能切換到沒有被指派的活動", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await send(
        "PATCH",
        `/api/admin/events/${otherEventId}`,
        { makeActive: true },
        cookie,
      );

      assert.equal(res.status, 403);
    });

    /*
      活動寫進網址之後，每一個 /admin/events/[id] 底下的頁面都是一個
      獨立的入口。漏掉任何一頁的檢查，別場的主持人就能直接打網址進去。

      ⚠️ 這件事不能靠 layout 統一處理——Next 文件明講 layout 在同層路由
      切換時不會重新執行，而且它不渲染 children 也擋不住 route segment
      執行、內容仍會出現在 RSC payload 裡。所以只能每頁各自檢查，
      而這組測試就是「有沒有哪一頁忘了檢查」的防線。

      新增頁面時請一併加進這個陣列。
    */
    const EVENT_PAGES = ["", "/codes", "/display", "/logs"];

    for (const suffix of EVENT_PAGES) {
      it(`沒有權限時 /admin/events/<id>${suffix} 回應找不到`, async () => {
        const superCookie = await loginAs("admin", "change-me");
        const otherEventId = await secondEventId(superCookie);
        await createHostAdmin("test-host", "hostpass123");
        const cookie = await loginAs("test-host", "hostpass123");

        const res = await fetch(
          `${BASE}/admin/events/${otherEventId}${suffix}`,
          { headers: { cookie }, redirect: "manual" },
        );

        assert.equal(
          res.status,
          404,
          "必須是「找不到」而不是「沒有權限」——可區分的話就能拿 id 探測別場活動存不存在",
        );
      });
    }

    it("建立帳號時一併指派，對方立刻就有權限", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);

      const created = await post(
        "/api/admin/accounts",
        {
          username: "test-assigned",
          password: "hostpass123",
          role: "HOST",
          eventIds: [otherEventId],
        },
        superCookie,
      );
      assert.equal(created.status, 201);

      const cookie = await loginAs("test-assigned", "hostpass123");
      const res = await fetch(`${BASE}/admin/events/${otherEventId}`, {
        headers: { cookie },
        redirect: "manual",
      });

      assert.equal(
        res.status,
        200,
        "建立與指派分成兩步的話，中間那個看不到任何東西的狀態會被忘記",
      );
    });

    it("建立總管理員時忽略指派，他的權限來自身分", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);

      await post(
        "/api/admin/accounts",
        {
          username: "test-super",
          password: "superpass123",
          role: "SUPER",
          eventIds: [otherEventId],
        },
        superCookie,
      );

      const list = await get("/api/admin/accounts", superCookie);
      const created = list.body.admins.find(
        (a: { username: string }) => a.username === "test-super",
      );
      assert.equal(
        created.assignments.length,
        0,
        "留下用不到的指派關係，日後降級成主持人時會意外保留權限",
      );
    });

    it("有權限的主持人進得去自己的活動頁", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);
      const hostId = await createHostAdmin("test-host", "hostpass123");
      await assignHost(hostId, otherEventId);
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await fetch(`${BASE}/admin/events/${otherEventId}`, {
        headers: { cookie },
        redirect: "manual",
      });

      assert.equal(res.status, 200, "指派之後就該進得去，否則上面的 404 沒有意義");
    });

    it("不能刪除活動", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);
      const hostId = await createHostAdmin("test-host", "hostpass123");
      // 就算被指派了那一場，刪除仍然只有總管理員能做。
      await assignHost(hostId, otherEventId);
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await send(
        "DELETE",
        `/api/admin/events/${otherEventId}`,
        undefined,
        cookie,
      );

      assert.equal(res.status, 403);
    });

    it("不能指派主持人", async () => {
      const superCookie = await loginAs("admin", "change-me");
      const otherEventId = await secondEventId(superCookie);
      await createHostAdmin("test-host", "hostpass123");
      const cookie = await loginAs("test-host", "hostpass123");

      const res = await send(
        "PATCH",
        `/api/admin/events/${otherEventId}`,
        { hostIds: [] },
        cookie,
      );

      assert.equal(res.status, 403);
    });
  });
});
