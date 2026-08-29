import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  post,
  readSessionToken,
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

describe("參與者清單", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("絕不回傳 sessionToken", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    const adminCookie = await loginAsAdmin();

    const res = await get("/api/admin/participants", adminCookie);

    assert.ok(
      !JSON.stringify(res.body).includes("sessionToken"),
      "sessionToken 是登入憑證，出現在回應裡等於把冒充身分的鑰匙交出去",
    );
    /*
      也要確認 token 的「值」沒有以別的欄位名混進來。
      從資料庫直接取出本人的 token 來比對，這樣就算日後有人把它
      改名成 token 或 secret 端出來，這個斷言仍然會擋下。
    */
    const token = await readSessionToken(ming.id);
    assert.ok(
      token && !JSON.stringify(res.body).includes(token),
      "回應中不該出現 sessionToken 的值，不論欄位叫什麼名字",
    );
  });

  it("回傳工作人員實際需要的欄位", async () => {
    await joinAs("陳小明", {
      realName: "陳大明",
      email: "ming@example.com",
      university: "中央大學",
      zodiac: "leo",
    });
    const adminCookie = await loginAsAdmin();

    const res = await get("/api/admin/participants", adminCookie);
    const p = res.body.participants.find(
      (x: { nickname: string }) => x.nickname === "陳小明",
    );

    // 現場核對、聯絡、協助找回各自需要不同欄位，缺一項就得改回資料庫查。
    assert.equal(p.realName, "陳大明");
    assert.equal(p.email, "ming@example.com");
    assert.equal(p.emailVerified, false);
    assert.equal(p.university, "中央大學");
    assert.equal(p.zodiac, "leo");
    assert.ok(p.personalCode, "個人碼是工作人員代為收集時唯一的識別依據");
    assert.ok(Array.isArray(p.icons));
    assert.ok(p.createdAt);
    assert.ok(p._count.collections !== undefined);
  });

  it("未登入者拿不到清單", async () => {
    await joinAs("陳小明", { realName: "陳大明" });

    const res = await fetch(`${BASE}/api/admin/participants`);

    assert.equal(res.status, 401);
    const body = await res.text();
    assert.ok(!body.includes("陳大明"), "401 的回應也不該夾帶任何個資");
  });
});
