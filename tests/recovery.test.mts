import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  loginAs,
  post,
  readSessionToken,
  readToken,
  requireServer,
  resetParticipants,
  type Session,
} from "./helpers.mts";

/**
 * 送出確認頁上那一次點擊。
 *
 * 綁定身分刻意不在 GET 完成（見 app/recover/[token]/page.tsx），
 * 所以測試也走跟瀏覽器一樣的兩步：先開頁面看，再 POST 確認。
 */
async function postConsume(token: string): Promise<Response> {
  return fetch(`${BASE}/api/recover/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
    redirect: "manual",
  });
}

/** 完成一次找回，回傳新裝置上拿到的 cookie。 */
async function consumeRecovery(token: string): Promise<string> {
  const res = await postConsume(token);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

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
    const cookie = await consumeRecovery(token!);
    assert.ok(cookie.startsWith("pid="), "應在新裝置上種下身分 cookie");

    const me = await get("/api/me", cookie);
    assert.equal(me.body.nickname, "陳小明", "應回到同一個身分");
  });

  it("開啟找回連結本身不會綁定身分，必須經過確認", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    await verifyEmail(ming);
    await post("/api/recover", { email: "ming@example.com" });
    const token = await readToken(ming.id, "RECOVER_SESSION");

    const page = await fetch(`${BASE}/recover/${token}`, { redirect: "manual" });

    /*
      這是 session fixation 的回歸測試。

      這一頁若在 GET 當下就種 cookie，任何人都能替自己要一封找回信，
      再把那個連結傳給別人——網域是正確的，看不出異常，但對方的瀏覽器
      會靜默地變成傳連結的那個人，之後填的真實姓名與信箱都進到攻擊者
      的帳號裡。
    */
    assert.ok(
      !(page.headers.get("set-cookie") ?? "").includes("pid="),
      "GET 不該有副作用——綁定必須來自使用者按下的那一個 POST",
    );

    // 而且權杖不能被這一次瀏覽消費掉，本人稍後才按確認。
    const still = await readToken(ming.id, "RECOVER_SESSION");
    assert.equal(still, token, "只是開啟確認頁，不該把一次性權杖燒掉");
  });

  it("找回成功後舊裝置的登入失效", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    await verifyEmail(ming);
    await post("/api/recover", { email: "ming@example.com" });
    const token = await readToken(ming.id, "RECOVER_SESSION");

    const fresh = await consumeRecovery(token!);

    const oldDevice = await get("/api/me", ming.cookie);
    assert.equal(
      oldDevice.status,
      401,
      "會走找回流程多半是裝置遺失或資料被清掉，舊憑證留著有效沒有好處",
    );

    const newDevice = await get("/api/me", fresh);
    assert.equal(newDevice.status, 200, "新裝置應該正常");
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

    await consumeRecovery(token!);
    const second = await postConsume(token!);

    assert.ok(
      !(second.headers.get("set-cookie") ?? "").includes("pid="),
      "第二次使用不該再種下身分 cookie",
    );
    assert.equal(second.status, 400, "用過的權杖應被拒絕");
  });

  it("偽造的權杖無法找回身分", async () => {
    const res = await postConsume("not-a-real-token");

    assert.ok(
      !(res.headers.get("set-cookie") ?? "").includes("pid="),
      "不該對無效權杖種下任何身分 cookie",
    );
  });

  it("跨站表單送不出的內容型別才被接受", async () => {
    const ming = await joinAs("陳小明", { email: "ming@example.com" });
    await verifyEmail(ming);
    await post("/api/recover", { email: "ming@example.com" });
    const token = await readToken(ming.id, "RECOVER_SESSION");

    /*
      HTML 表單只送得出 urlencoded、multipart 與 text/plain 三種型別。
      其中 text/plain 可以用欄位名湊出一個合法的 JSON 主體，所以這支端點
      必須自己檢查 Content-Type——Next 的 req.json() 是不看它就剖析的。
    */
    const res = await fetch(`${BASE}/api/recover/consume`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ token }),
      redirect: "manual",
    });

    assert.equal(res.status, 415, "非 JSON 的請求應被擋下");
    assert.ok(
      !(res.headers.get("set-cookie") ?? "").includes("pid="),
      "被擋下的請求不該種下任何 cookie",
    );

    const still = await readToken(ming.id, "RECOVER_SESSION");
    assert.equal(still, token, "被擋下的請求不該消費權杖");
  });

  it("工作人員換發的救援連結能在新裝置上綁定身分", async () => {
    const ming = await joinAs("陳小明");
    const adminCookie = await loginAs("admin", "change-me");

    const issued = await fetch(
      `${BASE}/api/admin/participants/${ming.id}/rescue`,
      { method: "POST", headers: { cookie: adminCookie } },
    );
    const { rescueUrl } = await issued.json();

    /*
      網址裡不能是 sessionToken 本身。

      先前這裡發的是 `/rescue/<sessionToken>`——那個字串就是憑證，沒有到期
      時間也不是一次性的。網址一旦外流（旁邊的人拍照、留在協助用裝置的
      瀏覽器歷史、被存取紀錄完整記下），任何人在活動結束後的任何時間都
      還能拿它取得這個人的身分，而且沒有作廢的管道。
    */
    const sessionToken = await readSessionToken(ming.id);
    assert.ok(sessionToken, "前置條件：這位參與者應該有 sessionToken");
    assert.ok(
      !rescueUrl.includes(sessionToken!),
      "救援網址不得包含 sessionToken——那是一把沒有期限的鑰匙",
    );

    /*
      只取路徑，網域打回受測伺服器。

      rescueUrl 的網域來自 PUBLIC_ORIGIN——那是要給使用者點的正式網址，
      不是這台測試伺服器。直接 fetch 它的話，測試會在正式環境變數一設定
      之後開始去連真的網域，而這個案例要驗的是「連結能在新裝置上綁定
      身分」，與它掛在哪個網域無關。
    */
    const path = new URL(rescueUrl).pathname;
    const token = path.split("/").filter(Boolean).pop()!;
    const cookie = await consumeRecovery(token);
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
