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

const JOIN = {
  entryCode: "JOINNCU1",
  passcode: "1234",
  icons: ["music", "game", "food"],
  bio: "很高興認識大家",
};

describe("姓名", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("姓名為必填，留空的報到被拒絕", async () => {
    const res = await post("/api/join", {
      ...JOIN,
      nickname: "只有暱稱的人",
      realName: "   ",
    });

    assert.equal(res.status, 400, "現場核對身分與發獎品需要真名");
  });

  it("別人收集到你時看不到你的姓名", async () => {
    const ming = await joinAs("小明", { realName: "陳大明" });
    const hua = await joinAs("小華", { realName: "林大華" });

    const res = await scan(ming, hua);

    assert.equal(res.status, 201, "首次收集建立新的 Collection");
    assert.equal(
      res.body.card.nickname,
      "小華",
      "卡片上顯示的應該是暱稱",
    );
    assert.ok(
      !JSON.stringify(res.body).includes("林大華"),
      "取暱稱的人往往正是不想讓全場看到本名的人，姓名不該出現在任何卡片回應裡",
    );
  });

  it("自己看得到自己的姓名", async () => {
    const ming = await joinAs("小明", { realName: "陳大明" });

    const res = await get("/api/me", ming.cookie);

    assert.equal(
      res.body.realName,
      "陳大明",
      "本人要能在編輯頁看到並修改自己填過的姓名",
    );
  });

  it("工作人員在後台看得到姓名", async () => {
    await joinAs("小明", { realName: "陳大明" });

    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "change-me" }),
    });
    const adminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

    const res = await get("/api/admin/participants", adminCookie);

    const found = res.body.participants.find(
      (p: { nickname: string }) => p.nickname === "小明",
    );
    assert.equal(
      found.realName,
      "陳大明",
      "看不到真名，簽到表與獎品發放就對應不到人——這是這個欄位存在的理由",
    );
  });
});

describe("信箱唯一性", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("同一個信箱不能報到兩次", async () => {
    await joinAs("第一次", { email: "same@example.com" });

    const second = await post("/api/join", {
      ...JOIN,
      nickname: "第二次",
      realName: "第二次",
      email: "same@example.com",
    });

    assert.equal(
      second.status,
      409,
      "同一個信箱掛在兩筆記錄上，找回機制就沒有唯一答案",
    );
  });

  it("被拒絕時會告訴使用者可以找回身分", async () => {
    await joinAs("第一次", { email: "same@example.com" });

    const second = await post("/api/join", {
      ...JOIN,
      nickname: "第二次",
      realName: "第二次",
      email: "same@example.com",
    });

    assert.ok(
      second.body.error.includes("找回"),
      "會撞到這個錯誤的人多半就是本人，訊息要指向出路而不是只說失敗",
    );
  });

  it("不同信箱不受影響", async () => {
    await joinAs("甲", { email: "a@example.com" });

    const res = await post("/api/join", {
      ...JOIN,
      nickname: "乙",
      realName: "乙",
      email: "b@example.com",
    });

    assert.equal(res.status, 201);
  });

  it("多個人都不填信箱仍可報到", async () => {
    await joinAs("沒填信箱的甲");
    await joinAs("沒填信箱的乙");

    const res = await post("/api/join", {
      ...JOIN,
      nickname: "沒填信箱的丙",
      realName: "沒填信箱的丙",
    });

    assert.equal(
      res.status,
      201,
      "信箱是選填，不該因為留白就擋下第二個人",
    );
  });

  it("通關碼錯誤時不會透露信箱是否已被使用", async () => {
    await joinAs("已報到的人", { email: "taken@example.com" });

    const res = await post("/api/join", {
      ...JOIN,
      passcode: "wrong",
      nickname: "外面的人",
      realName: "外面的人",
      email: "taken@example.com",
    });

    assert.equal(
      res.status,
      403,
      "先驗通關碼，才不會讓這個端點變成查詢某人有沒有參加活動的工具",
    );
  });

  it("不能把信箱改成別人已經在用的", async () => {
    await joinAs("先到的人", { email: "first@example.com" });
    const later = await joinAs("後到的人", { email: "later@example.com" });

    const res = await fetch(`${BASE}/api/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: later.cookie },
      body: JSON.stringify({
        nickname: "後到的人",
        realName: "後到的人",
        icons: ["music", "game", "food"],
        bio: "很高興認識大家",
        email: "first@example.com",
      }),
    });

    assert.equal(res.status, 409, "改信箱也是一條會製造重複的路徑");
  });

  it("沒改信箱時存檔不會被自己擋下", async () => {
    const ming = await joinAs("小明", { email: "ming@example.com" });

    const res = await fetch(`${BASE}/api/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", cookie: ming.cookie },
      body: JSON.stringify({
        nickname: "小明改了暱稱",
        realName: "陳小明",
        icons: ["music", "game", "food"],
        bio: "很高興認識大家",
        email: "ming@example.com",
      }),
    });

    assert.equal(
      res.status,
      200,
      "重複檢查必須排除自己，否則沒動到信箱的人就再也存不了檔",
    );
  });
});
