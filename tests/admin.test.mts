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
} from "./helpers.mts";

async function loginAsAdmin(
  username = "admin",
  password = "change-me",
): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (res.status !== 200) {
    throw new Error(`管理員登入失敗：${res.status}`);
  }
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

describe("管理員登入", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("密碼正確時登入成功", async () => {
    const res = await post("/api/admin/login", {
      username: "admin",
      password: "change-me",
    });

    assert.equal(res.status, 200);
  });

  it("密碼錯誤時被拒絕", async () => {
    const res = await post("/api/admin/login", {
      username: "admin",
      password: "wrong-password",
    });

    assert.equal(res.status, 401);
  });

  it("帳號不存在與密碼錯誤回傳相同結果", async () => {
    const wrongPassword = await post("/api/admin/login", {
      username: "admin",
      password: "wrong-password",
    });
    const noSuchUser = await post("/api/admin/login", {
      username: "nobody",
      password: "wrong-password",
    });

    assert.equal(
      noSuchUser.status,
      wrongPassword.status,
      "兩者若可區分，這個端點就變成帳號列舉工具",
    );
    assert.deepEqual(noSuchUser.body, wrongPassword.body);
  });
});

describe("公告", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("管理員可以發布公告", async () => {
    const adminCookie = await loginAsAdmin();

    const res = await post(
      "/api/admin/announcements",
      { body: "集合時間改為下午兩點" },
      adminCookie,
    );

    assert.equal(res.status, 201);
  });

  it("一般參與者不能發布公告", async () => {
    const ming = await joinAs("陳小明");

    const res = await post(
      "/api/admin/announcements",
      { body: "我是假公告" },
      ming.cookie,
    );

    assert.equal(res.status, 401, "參與者的 session 不該被當成管理員");
  });

  it("未登入者不能發布公告", async () => {
    const res = await post("/api/admin/announcements", { body: "我是假公告" });

    assert.equal(res.status, 401);
  });

  it("參與者看得到公告與未讀數", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/announcements", { body: "第一則公告" }, adminCookie);
    await post("/api/admin/announcements", { body: "第二則公告" }, adminCookie);

    const ming = await joinAs("陳小明");
    const res = await get("/api/announcements", ming.cookie);

    assert.equal(res.status, 200);
    assert.equal(res.body.announcements.length, 2);
    assert.equal(res.body.unreadCount, 2, "都還沒讀過");
  });

  it("標記已讀後未讀數歸零", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/announcements", { body: "唯一一則" }, adminCookie);

    const ming = await joinAs("陳小明");
    await post("/api/announcements/read", {}, ming.cookie);

    const res = await get("/api/announcements", ming.cookie);
    assert.equal(res.body.unreadCount, 0);
  });

  it("已讀狀態各自獨立", async () => {
    const adminCookie = await loginAsAdmin();
    await post("/api/admin/announcements", { body: "唯一一則" }, adminCookie);

    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await post("/api/announcements/read", {}, ming.cookie);

    const huaRes = await get("/api/announcements", hua.cookie);
    assert.equal(huaRes.body.unreadCount, 1, "小華沒讀過，不該被小明的動作影響");
  });
});
