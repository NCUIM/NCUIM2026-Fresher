import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  joinAs,
  post,
  requireServer,
  resetParticipants,
} from "./helpers.mts";

async function loginAsAdmin(username = "admin", password = "change-me") {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return {
    status: res.status,
    cookie: (res.headers.get("set-cookie") ?? "").split(";")[0],
  };
}

async function send(path: string, method: string, body?: unknown, cookie?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/** 清掉測試中建立的額外管理員，只留下 admin。 */
async function removeExtraAdmins(cookie: string) {
  const list = await send("/api/admin/accounts", "GET", undefined, cookie);
  for (const a of list.body?.admins ?? []) {
    if (a.username !== "admin") {
      await send(`/api/admin/accounts/${a.id}`, "DELETE", undefined, cookie);
    }
  }
}

describe("管理員帳號", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    const { cookie } = await loginAsAdmin();
    await removeExtraAdmins(cookie);
  });
  after(async () => {
    const { cookie } = await loginAsAdmin();
    await removeExtraAdmins(cookie);
    await disconnect();
  });

  it("一般參與者讀不到管理員清單", async () => {
    const ming = await joinAs("陳小明");

    const res = await send("/api/admin/accounts", "GET", undefined, ming.cookie);

    assert.equal(res.status, 401, "參與者的 session 不具管理權限");
  });

  it("未登入者讀不到管理員清單", async () => {
    const res = await send("/api/admin/accounts", "GET");
    assert.equal(res.status, 401);
  });

  it("清單不含任何密碼雜湊", async () => {
    const { cookie } = await loginAsAdmin();

    const res = await send("/api/admin/accounts", "GET", undefined, cookie);

    assert.equal(res.status, 200);
    assert.ok(
      !JSON.stringify(res.body).toLowerCase().includes("hash"),
      "畫面上不需要雜湊，回傳只會多一個外洩點",
    );
  });

  it("可以新增管理員並用新帳號登入", async () => {
    const { cookie } = await loginAsAdmin();

    const created = await send(
      "/api/admin/accounts",
      "POST",
      { username: "staff.lead", password: "a-good-password" },
      cookie,
    );
    assert.equal(created.status, 201);

    const login = await loginAsAdmin("staff.lead", "a-good-password");
    assert.equal(login.status, 200, "新帳號應該可以登入");
  });

  it("密碼太短被拒絕", async () => {
    const { cookie } = await loginAsAdmin();

    const res = await send(
      "/api/admin/accounts",
      "POST",
      { username: "weakone", password: "short" },
      cookie,
    );

    assert.equal(res.status, 400);
  });

  it("重複的帳號被拒絕", async () => {
    const { cookie } = await loginAsAdmin();

    const res = await send(
      "/api/admin/accounts",
      "POST",
      { username: "admin", password: "a-good-password" },
      cookie,
    );

    assert.equal(res.status, 409);
  });

  it("不能移除自己", async () => {
    const { cookie } = await loginAsAdmin();
    const list = await send("/api/admin/accounts", "GET", undefined, cookie);
    const me = list.body.admins.find((a: any) => a.id === list.body.currentId);

    const res = await send(`/api/admin/accounts/${me.id}`, "DELETE", undefined, cookie);

    assert.equal(res.status, 409, "移除自己會把自己鎖在門外");
  });

  /*
    守的是「最後一位**總管理員**」，不是「最後一位管理員」。

    只剩主持人的話，沒有人能新增帳號、建立活動或指派主持人——
    後台等於只剩半套，得回去改資料庫才救得回來。
  */
  it("不能移除最後一位總管理員", async () => {
    const { cookie } = await loginAsAdmin();
    await send(
      "/api/admin/accounts",
      "POST",
      { username: "temp.admin", password: "a-good-password", role: "SUPER" },
      cookie,
    );

    // 以新帳號登入後刪掉 admin，剩下自己一個總管理員
    const second = await loginAsAdmin("temp.admin", "a-good-password");
    const list = await send("/api/admin/accounts", "GET", undefined, second.cookie);
    const original = list.body.admins.find((a: any) => a.username === "admin");
    await send(
      `/api/admin/accounts/${original.id}`,
      "DELETE",
      undefined,
      second.cookie,
    );

    const selfDelete = await send(
      `/api/admin/accounts/${list.body.currentId}`,
      "DELETE",
      undefined,
      second.cookie,
    );
    assert.equal(selfDelete.status, 409);

    // 還原：把 admin 加回來，且必須是總管理員
    await send(
      "/api/admin/accounts",
      "POST",
      { username: "admin", password: "change-me", role: "SUPER" },
      second.cookie,
    );
  });

  it("新增帳號時預設是主持人，不是總管理員", async () => {
    const { cookie } = await loginAsAdmin();

    await send(
      "/api/admin/accounts",
      "POST",
      { username: "temp.default", password: "a-good-password" },
      cookie,
    );

    const list = await send("/api/admin/accounts", "GET", undefined, cookie);
    const created = list.body.admins.find(
      (a: any) => a.username === "temp.default",
    );
    assert.equal(
      created.role,
      "HOST",
      "多給的權限沒有人會發現，少給的立刻會被反應——預設值要往低的那邊放",
    );

    await send(`/api/admin/accounts/${created.id}`, "DELETE", undefined, cookie);
  });

  it("改密碼需要目前的密碼", async () => {
    const { cookie } = await loginAsAdmin();

    const res = await send(
      "/api/admin/password",
      "PATCH",
      { currentPassword: "wrong-password", newPassword: "another-password" },
      cookie,
    );

    assert.equal(
      res.status,
      403,
      "只憑 session 就能改密碼的話，沒鎖螢幕的電腦等於把帳號交出去",
    );
  });

  it("改密碼後舊密碼失效、其他工作階段被撤銷", async () => {
    const first = await loginAsAdmin();
    const second = await loginAsAdmin(); // 模擬另一台裝置

    const changed = await send(
      "/api/admin/password",
      "PATCH",
      { currentPassword: "change-me", newPassword: "brand-new-password" },
      first.cookie,
    );
    assert.equal(changed.status, 200);

    const oldLogin = await loginAsAdmin("admin", "change-me");
    assert.equal(oldLogin.status, 401, "舊密碼應該失效");

    const otherDevice = await send(
      "/api/admin/accounts",
      "GET",
      undefined,
      second.cookie,
    );
    assert.equal(
      otherDevice.status,
      401,
      "換密碼通常代表懷疑外流，舊的登入必須一併失效",
    );

    // 還原成種子密碼，避免影響其他測試
    const back = await loginAsAdmin("admin", "brand-new-password");
    await send(
      "/api/admin/password",
      "PATCH",
      { currentPassword: "brand-new-password", newPassword: "change-me" },
      back.cookie,
    );
  });
});
