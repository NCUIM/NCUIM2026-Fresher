/**
 * 報到流程的煙霧測試。以 HTTP API 客戶端的身分驅動系統，
 * 符合 spec 議定的單一測試接縫。
 *
 * 用法：先 npm run dev，再 npm run smoke
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), res };
}

const base = {
  entryCode: "JOINNCU1",
  passcode: "1234",
  icons: ["music", "game", "food"],
};

console.log("\n【Entry Code 查詢】");
{
  const r = await fetch(`${BASE}/api/entry/JOINNCU1`);
  const j = await r.json();
  check("有效註冊碼回傳活動資訊", r.status === 200 && !!j.event?.name);
  check("不回傳通關碼", !JSON.stringify(j).includes("passcode"));

  const bad = await fetch(`${BASE}/api/entry/NOSUCHCODE`);
  check("不存在的註冊碼回傳 404", bad.status === 404);
}

console.log("\n【報到驗證】");
{
  const wrongPass = await post("/api/join", {
    ...base,
    nickname: "測試",
    passcode: "9999",
  });
  check("通關碼錯誤回傳 403", wrongPass.status === 403);

  const twoIcons = await post("/api/join", {
    ...base,
    nickname: "測試",
    icons: ["music", "game"],
  });
  check("圖示數量不足回傳 400", twoIcons.status === 400);

  const dupIcons = await post("/api/join", {
    ...base,
    nickname: "測試",
    icons: ["music", "music", "food"],
  });
  check("圖示重複回傳 400", dupIcons.status === 400);

  const httpUrl = await post("/api/join", {
    ...base,
    nickname: "測試",
    socialUrl: "http://example.com",
  });
  check("非 https 連結回傳 400", httpUrl.status === 400);

  const longBio = await post("/api/join", {
    ...base,
    nickname: "測試",
    bio: "字".repeat(51),
  });
  check("自我介紹超過 50 字回傳 400", longBio.status === 400);
}

console.log("\n【報到與分隊】");
const created: Array<{ nickname: string; team: number | null; role: string }> = [];
{
  for (const nickname of ["陳小明", "林小華", "王大美"]) {
    const r = await post("/api/join", { ...base, nickname, bio: "你好，很高興認識你" });
    check(`${nickname} 報到成功`, r.status === 201, `HTTP ${r.status}`);
    check(`${nickname} 暱稱未損壞`, r.body.nickname === nickname, r.body.nickname);
    created.push({
      nickname: r.body.nickname,
      team: r.body.team?.number ?? null,
      role: r.body.role,
    });
  }

  const teams = created.map((c) => c.team);
  check(
    `一般參與者輪流分配到不同組別（實際：${teams.join(", ")}）`,
    new Set(teams).size === teams.length && teams.every((t) => t !== null),
  );

  const cookie = (await post("/api/join", { ...base, nickname: "cookie測試" })).res.headers.get(
    "set-cookie",
  );
  check("身分 cookie 為 HttpOnly", !!cookie?.toLowerCase().includes("httponly"));
  check("回應本體不含 sessionToken", !cookie?.includes("sessionToken"));
}

console.log("\n【工作人員】");
{
  const r = await post("/api/join", {
    ...base,
    entryCode: "STAFFNCU",
    nickname: "幹部小李",
  });
  check("工作人員註冊碼賦予 STAFF 身分", r.body.role === "STAFF", r.body.role);
  check("工作人員不被分配組別", r.body.team === null, JSON.stringify(r.body.team));
}

console.log(`\n通過 ${passed} 項，失敗 ${failed} 項\n`);
process.exitCode = failed > 0 ? 1 : 0;
