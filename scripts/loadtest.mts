import "dotenv/config";

/**
 * 壓力測試：找出在多少人同時使用時仍然順暢。
 *
 * 為什麼需要它：活動當天七十個人不是平均分布的，而是一波一波——開場
 * 全部湧進來報到，中場所有人同時在掃描與翻頁。「平均每秒幾個請求」
 * 完全預測不了那種尖峰。
 *
 * 這支腳本模擬的是活動進行中的混合負載（看自己的頁面、掃描、看收集、
 * 看排行榜），逐級加壓，量的是**每一級的延遲分佈與錯誤率**——平均值
 * 會被大量的快速請求稀釋掉，真正決定「順不順」的是 p95。
 *
 * 用法（三種 shell 都一樣）：
 *   本機   npm run loadtest
 *   正式站 npm run loadtest -- https://你的網域 報到碼 通關碼
 *
 * 用命令列參數而不是環境變數：`VAR=值 指令` 是 bash 專屬的語法，
 * 在 PowerShell 上會直接失敗，而這個專案的開發環境是 Windows。
 * 環境變數仍然支援，給 CI 之類的場合用。
 *
 * ⚠️ 指向正式站時：它會真的建立參與者、真的寫入資料庫。請只對還沒開始
 *    的活動跑，跑完記得從後台清掉測試資料。
 */
const [argBase, argEntry, argPass] = process.argv.slice(2);

const BASE =
  argBase ??
  process.env.LOADTEST_BASE_URL ??
  process.env.TEST_BASE_URL ??
  "http://localhost:3001";

/** 報到用的參數。正式站的碼是隨機產生的，一定要傳。 */
const ENTRY_CODE = argEntry ?? process.env.LOADTEST_ENTRY_CODE ?? "JOINNCU1";
const PASSCODE = argPass ?? process.env.LOADTEST_PASSCODE ?? "1234";

/** 每一級的併發數。停在 100 是因為這場活動只有七十人。 */
const LEVELS = [10, 25, 50, 70, 100];

/** 每一級每個虛擬使用者做幾輪操作。 */
const ROUNDS_PER_USER = 3;

type Session = { cookie: string; personalCode: string; id: string };

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

/** 量一次請求的耗時。回傳 null 代表失敗。 */
async function timed(fn: () => Promise<Response>): Promise<number | null> {
  const t0 = performance.now();
  try {
    const res = await fn();
    // 4xx 也算失敗——使用者看到的就是壞掉的畫面。
    if (!res.ok) return null;
    await res.arrayBuffer(); // 讀完才算真的收到
    return performance.now() - t0;
  } catch {
    return null;
  }
}

/** 連不上時的第一筆錯誤。只印一次，不然一百個失敗會刷掉整個畫面。 */
let firstError: string | null = null;

async function join(nickname: string): Promise<Session | null> {
  try {
    return await joinOnce(nickname);
  } catch (e) {
    firstError ??= String((e as Error)?.cause ?? (e as Error)?.message ?? e);
    return null;
  }
}

async function joinOnce(nickname: string): Promise<Session | null> {
  const res = await fetch(`${BASE}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      entryCode: ENTRY_CODE,
      passcode: PASSCODE,
      nickname,
      realName: nickname,
      bio: "壓力測試產生的資料，可以刪除",
      icons: ["music", "code", "coffee"],
      zodiac: "aries",
      university: "中央大學",
    }),
  });
  if (res.status !== 201) {
    firstError ??= `HTTP ${res.status}：${(await res.text()).slice(0, 120)}`;
    return null;
  }
  const body = await res.json();
  return {
    cookie: (res.headers.get("set-cookie") ?? "").split(";")[0],
    personalCode: body.personalCode,
    id: body.id,
  };
}

/**
 * 一位參與者在活動中的一輪操作。
 *
 * 比重刻意偏向讀取：現場多數時間是在看自己的頁面與別人的卡片，
 * 掃描是間歇發生的。全部都測掃描會高估寫入的壓力。
 */
async function oneRound(me: Session, others: Session[]): Promise<(number | null)[]> {
  // 排除自己：掃自己會回 400「不能收集自己」，那是正確行為，
  // 不該被算成失敗而拉低成功率。
  const pool = others.filter((o) => o.id !== me.id);
  const target = pool[Math.floor(Math.random() * pool.length)] ?? me;
  const headers = { cookie: me.cookie };

  return Promise.all([
    timed(() => fetch(`${BASE}/api/me`, { headers })),
    timed(() => fetch(`${BASE}/me`, { headers })),
    timed(() => fetch(`${BASE}/collection`, { headers })),
    timed(() => fetch(`${BASE}/api/leaderboard`, { headers })),
    // 掃描：對方可能已經掃過，重複會回 200（duplicate），不算失敗。
    timed(() =>
      fetch(`${BASE}/api/scan`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ personalCode: target.personalCode }),
      }),
    ),
  ]);
}

async function main() {
  console.log(`目標：${BASE}`);
  if (!BASE.includes("localhost")) {
    console.log("⚠️  這不是本機。它會真的在該環境建立 100 位參與者。");
    console.log("    只對還沒開始的活動跑，跑完記得從後台清掉。");
    // 給一點反悔的時間——貼錯網址時這是唯一的攔截點。
    console.log("    五秒後開始，要取消請按 Ctrl+C。");
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(`報到碼 ${ENTRY_CODE} ／ 通關碼 ${PASSCODE}\n`);

  const maxUsers = Math.max(...LEVELS);
  console.log(`建立 ${maxUsers} 位測試參與者…`);

  const stamp = Date.now().toString(36).slice(-4);
  const t0 = performance.now();
  const sessions = (
    await Promise.all(
      Array.from({ length: maxUsers }, (_, i) =>
        join(`壓測${stamp}-${String(i + 1).padStart(3, "0")}`),
      ),
    )
  ).filter((s): s is Session => s !== null);
  const joinMs = performance.now() - t0;

  console.log(
    `  ${sessions.length}/${maxUsers} 成功，總耗時 ${joinMs.toFixed(0)} ms` +
      `（這就是「全部人同時報到」的情境）\n`,
  );
  if (sessions.length < 2) {
    console.error("");
    console.error("報到失敗，無法繼續。");
    if (firstError) console.error(`  第一筆錯誤：${firstError}`);
    console.error("  常見原因：");
    console.error("    • 網址打錯，或該站還沒部署完成");
    console.error("    • 報到碼／通關碼不對——正式站的碼是建立活動時隨機產生的，");
    console.error("      到後台的「報到碼」頁面看，不是 JOINNCU1");
    console.error("    • 活動已封存（封存後不能報到）");
    process.exit(1);
  }

  console.log("併發   請求數   成功率    p50      p95      p99     最慢");
  console.log("─".repeat(62));

  for (const level of LEVELS) {
    const users = sessions.slice(0, Math.min(level, sessions.length));
    const durations: number[] = [];
    let failed = 0;

    const start = performance.now();
    for (let round = 0; round < ROUNDS_PER_USER; round++) {
      const results = await Promise.all(
        users.map((u) => oneRound(u, sessions)),
      );
      for (const batch of results) {
        for (const d of batch) {
          if (d === null) failed++;
          else durations.push(d);
        }
      }
    }
    const wall = performance.now() - start;

    durations.sort((a, b) => a - b);
    const total = durations.length + failed;
    const okRate = ((durations.length / total) * 100).toFixed(1);

    console.log(
      `${String(level).padStart(4)}  ${String(total).padStart(7)}  ` +
        `${okRate.padStart(6)}%  ` +
        `${percentile(durations, 50).toFixed(0).padStart(6)}ms ` +
        `${percentile(durations, 95).toFixed(0).padStart(6)}ms ` +
        `${percentile(durations, 99).toFixed(0).padStart(6)}ms ` +
        `${(durations[durations.length - 1] ?? 0).toFixed(0).padStart(6)}ms` +
        `   （${(total / (wall / 1000)).toFixed(0)} req/s）`,
    );
  }

  /*
    最後一段：貼近現場的模擬。

    上面那張表刻意不真實——每個虛擬使用者一次同時發五個請求、零思考
    時間、連發三輪，所以「70 併發」其實是三百五十個請求同時在飛。
    那是為了找出**極限在哪**。

    但真人不是那樣用的：點一下、看幾秒、再點下一個。這一段用隨機的
    思考時間重跑一次，量的是「七十個人真的在現場用」會是什麼感覺——
    那才是能拿來決定要不要換平台的數字。
  */
  console.log("");
  console.log("貼近現場的模擬：70 人，每人每 4-12 秒操作一次，持續 45 秒");

  const realUsers = sessions.slice(0, Math.min(70, sessions.length));
  const realDurations: number[] = [];
  let realFailed = 0;
  const until = Date.now() + 45_000;

  await Promise.all(
    realUsers.map(async (u) => {
      // 起步時間錯開，不然第一波仍然是同時湧入。
      await new Promise((r) => setTimeout(r, Math.random() * 4000));
      while (Date.now() < until) {
        const pool = sessions.filter((o) => o.id !== u.id);
        const target = pool[Math.floor(Math.random() * pool.length)];
        const headers = { cookie: u.cookie };
        // 一次只做一件事，就像真的在操作。
        const pick = Math.random();
        const d =
          pick < 0.45
            ? await timed(() => fetch(`${BASE}/me`, { headers }))
            : pick < 0.7
              ? await timed(() => fetch(`${BASE}/collection`, { headers }))
              : pick < 0.85
                ? await timed(() => fetch(`${BASE}/api/leaderboard`, { headers }))
                : await timed(() =>
                    fetch(`${BASE}/api/scan`, {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify({ personalCode: target.personalCode }),
                    }),
                  );
        if (d === null) realFailed++;
        else realDurations.push(d);
        await new Promise((r) => setTimeout(r, 4000 + Math.random() * 8000));
      }
    }),
  );

  realDurations.sort((a, b) => a - b);
  const realTotal = realDurations.length + realFailed;
  console.log(
    "  " + realTotal + " 個請求／" + (realTotal / 45).toFixed(1) + " req/s" +
      "　成功率 " + ((realDurations.length / realTotal) * 100).toFixed(1) + "%" +
      "　p50 " + percentile(realDurations, 50).toFixed(0) + "ms" +
      "　p95 " + percentile(realDurations, 95).toFixed(0) + "ms" +
      "　最慢 " + (realDurations[realDurations.length - 1] ?? 0).toFixed(0) + "ms",
  );

  console.log(
    "\n判讀：p95 是「二十個人裡最慢的那一個」等了多久。" +
      "\n  400ms 以下  感覺即時" +
      "\n  1 秒左右    看得出在等，但可以接受" +
      "\n  3 秒以上    現場會有人以為當掉了",
  );
  console.log(
    `\n這次建立了 ${sessions.length} 位「壓測${stamp}-」開頭的參與者，記得清掉。`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
