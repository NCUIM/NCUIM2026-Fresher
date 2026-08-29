import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  post,
  readToken,
  requireServer,
  resetParticipants,
  type Session,
} from "./helpers.mts";

/**
 * 取出信中的權杖。真實流程裡它是從信箱拿到的，這裡直接讀資料庫只是為了
 * 取得那個值——所有斷言仍然是針對 HTTP 行為（這個權杖能不能用）。
 */
async function verifyEmail(session: Session) {
  const token = await readToken(session.id, "VERIFY_EMAIL");
  assert.ok(token, "報到時填了信箱就該產生驗證權杖");
  const res = await fetch(`${BASE}/verify/${token}`, { redirect: "manual" });
  assert.ok(res.status < 400, `驗證頁應正常回應，實際 ${res.status}`);
}

describe("信箱驗證", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("報到後信箱為未驗證狀態", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });

    const res = await get("/api/me", ming.cookie);

    assert.equal(res.body.email, "ming@example.com");
    assert.equal(res.body.emailVerified, false, "尚未點擊連結前不該是已驗證");
  });

  it("未填信箱也能正常報到與使用", async () => {
    const ming = await joinAs("陳小明");

    const res = await get("/api/me", ming.cookie);

    assert.equal(res.status, 200, "信箱是選填，不該阻斷任何功能");
    assert.equal(res.body.email, null);
  });

  it("點擊驗證連結後狀態變更", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });

    await verifyEmail(ming);

    const res = await get("/api/me", ming.cookie);
    assert.equal(res.body.emailVerified, true);
  });

  it("同一個驗證連結不能用第二次", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    const token = await readToken(ming.id, "VERIFY_EMAIL");

    await fetch(`${BASE}/verify/${token}`, { redirect: "manual" });
    const second = await fetch(`${BASE}/verify/${token}`, { redirect: "manual" });
    const html = await second.text();

    assert.ok(html.includes("失效"), "重複使用應顯示連結已失效");
  });
});

describe("找回身分", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("已驗證信箱可以取得找回連結並回復身分", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    await verifyEmail(ming);

    const request = await post("/api/recover", { email: "ming@example.com" });
    assert.equal(request.status, 200);

    const token = await readToken(ming.id, "RECOVER_SESSION");
    assert.ok(token, "已驗證的信箱應收到找回權杖");

    // 模擬全新的裝置：完全不帶 cookie
    const res = await fetch(`${BASE}/recover/${token}`, { redirect: "manual" });
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    assert.ok(cookie.startsWith("pid="), "應在新裝置上種下身分 cookie");

    const me = await get("/api/me", cookie);
    assert.equal(me.body.nickname, "陳小明", "應回到同一個身分");
  });

  it("未驗證的信箱不會取得找回連結", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    // 刻意不驗證

    await post("/api/recover", { email: "ming@example.com" });

    const token = await readToken(ming.id, "RECOVER_SESSION");
    assert.equal(
      token,
      null,
      "未驗證的信箱可能是打錯的位址，寄過去等於把身分交給不相干的人",
    );
  });

  it("信箱不存在時回應與存在時完全相同", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    await verifyEmail(ming);

    const exists = await post("/api/recover", { email: "ming@example.com" });
    const missing = await post("/api/recover", { email: "nobody@example.com" });

    assert.equal(exists.status, missing.status);
    assert.deepEqual(
      exists.body,
      missing.body,
      "兩者若可區分，這個端點就變成測試某人有沒有參加活動的工具",
    );
  });

  it("找回連結只能用一次", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    await verifyEmail(ming);
    await post("/api/recover", { email: "ming@example.com" });
    const token = await readToken(ming.id, "RECOVER_SESSION");

    await fetch(`${BASE}/recover/${token}`, { redirect: "manual" });
    const second = await fetch(`${BASE}/recover/${token}`, { redirect: "manual" });

    assert.ok(
      !(second.headers.get("set-cookie") ?? "").includes("pid="),
      "第二次使用不該再種下身分 cookie",
    );
    assert.ok(
      (second.headers.get("location") ?? "").includes("error"),
      "應導向錯誤說明",
    );
  });

  it("偽造的權杖無法找回身分", async () => {
    const res = await fetch(`${BASE}/recover/not-a-real-token`, {
      redirect: "manual",
    });

    assert.ok(
      !(res.headers.get("set-cookie") ?? "").includes("pid="),
      "不該對無效權杖種下任何身分 cookie",
    );
  });

  it("工作人員換發的救援連結能在新裝置上綁定身分", async () => {
    const ming = await joinAs("陳小明");

    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "change-me" }),
    });
    const adminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

    const issued = await fetch(
      `${BASE}/api/admin/participants/${ming.id}/rescue`,
      { method: "POST", headers: { cookie: adminCookie } },
    );
    const { rescueUrl } = await issued.json();

    const res = await fetch(rescueUrl, { redirect: "manual" });
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    assert.ok(cookie.startsWith("pid="), "救援連結應在新裝置上種下身分 cookie");

    const me = await get("/api/me", cookie);
    assert.equal(me.body.nickname, "陳小明");
  });

  it("修改信箱後需要重新驗證", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    await verifyEmail(ming);

    const res = await fetch(`${BASE}/api/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: ming.cookie },
      body: JSON.stringify({
        nickname: "陳小明",
        realName: "陳小明",
        icons: ["music", "game", "food"],
        bio: "很高興認識大家",
        email: "newaddress@example.com",
      }),
    });
    assert.equal(res.status, 200);

    const me = await get("/api/me", ming.cookie);
    assert.equal(
      me.body.emailVerified,
      false,
      "舊的驗證只證明舊位址收得到信，換了就得重驗",
    );
  });
});
