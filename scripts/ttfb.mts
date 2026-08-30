/**
 * 量 TTFB（首位元組時間）：從送出請求到伺服器開始回應之間的等待。
 *
 * 為什麼是這個數字：它把「網路有多遠」與「伺服器做了多久」分開。
 * 連線時間是物理距離造成的，改不了；TTFB 扣掉連線時間之後剩下的，
 * 就是函式跑了多久、查了幾次資料庫、資料庫離函式多遠——那些才是
 * 可以動的部分。
 *
 * 用途上最直接的一個問題是：改了 Vercel 的函式區域之後，到底生效了沒。
 * 區域變更要重新部署才會套用，而部署完成的訊息不會告訴你這件事。
 *
 * 用法：
 *   npm run ttfb                          量本機
 *   npm run ttfb -- https://你的網域       量正式站
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

/** 每個路徑量幾次。取中位數，避開偶發的抖動。 */
const SAMPLES = 5;

/*
  三個代表性的路徑：

  - /api/entry/... 只查一筆，代表「一次資料庫往返」的下限
  - /            首頁，一次查詢加上伺服器渲染
  - /api/public/leaderboard  有 CDN 快取，第二次之後應該明顯更快

  最後那一個是對照組：如果它和前兩個一樣慢，代表快取沒生效。
*/
const PATHS = [
  "/api/entry/JOINNCU1",
  "/",
  "/api/public/leaderboard",
];

/*
  Vercel 的區域代碼。只列常用的幾個，認不得就原樣印出來。

  為什麼要查這個：改了 Function Region 之後**必須重新部署**才會套用，
  而部署完成的畫面不會提醒你這件事。設定頁上顯示的是「你想要哪裡」，
  這個標頭才是「實際跑在哪裡」——兩者不一致是很常見的狀況。
*/
const REGIONS: Record<string, string> = {
  sin1: "新加坡",
  hnd1: "東京",
  icn1: "首爾",
  hkg1: "香港",
  iad1: "美國東岸（華盛頓）",
  sfo1: "美國西岸（舊金山）",
  cle1: "美國中部",
  fra1: "法蘭克福",
  lhr1: "倫敦",
  syd1: "雪梨",
  bom1: "孟買",
};

function describeRegion(code: string): string {
  return REGIONS[code] ? `${code}（${REGIONS[code]}）` : code;
}

/**
 * 讀出這次請求經過了哪些節點，以及前面有沒有多一層代理。
 *
 * x-vercel-id 會列出請求經過的 Vercel 節點，但**不要用它來斷定函式在
 * 哪一區**——前面若有 Cloudflare 之類的代理，第一段會是代理回源進入
 * Vercel 的位置，而不是函式的執行區域。函式的區域以 Vercel 設定頁
 * （Settings → Functions）為準。
 *
 * 真正要看的是 Server 標頭：出現 cloudflare 就代表請求先繞了一層，
 * 那一層可能把亞洲的請求送去美國回源——而那正是最難察覺的延遲來源。
 */
async function detectRegion(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const id = res.headers.get("x-vercel-id");
    const server = res.headers.get("server") ?? "";
    const proxied = server.toLowerCase().includes("cloudflare");

    const hops = id
      ? id.split("::").slice(0, -1).map(describeRegion).join(" → ")
      : null;

    const lines: string[] = [];
    if (hops) lines.push(`經過的 Vercel 節點：${hops}`);
    if (proxied) {
      lines.push("前面有 Cloudflare 代理（橘色雲朵開著）");
      lines.push(
        "  多一層轉手，而且回源節點不一定在附近。Vercel 本身就有全球邊緣網路，",
      );
      lines.push(
        "  這一層通常沒有帶來好處。到 Cloudflare 的 DNS 把它改成 DNS only 再量一次。",
      );
    }
    return lines.length > 0 ? lines.join(String.fromCharCode(10)) : null;
  } catch {
    return null;
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/**
 * 量一次請求，拆出連線與等待兩段。
 *
 * fetch 沒有提供 curl 那樣的分段計時，所以先單獨建一次連線量出握手時間，
 * 再從總時間裡扣掉——不精確，但足以回答「慢在路上還是慢在伺服器」。
 */
async function sample(url: string): Promise<{ total: number; status: number }> {
  const t0 = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  // 只等標頭，不讀完整個 body——body 的下載時間屬於頻寬，不是 TTFB。
  const total = performance.now() - t0;
  await res.arrayBuffer();
  return { total, status: res.status };
}

async function main() {
  console.log(`目標：${BASE}`);

  const region = await detectRegion(`${BASE}/`);
  if (region) console.log(region);
  console.log("");
  console.log("路徑                          狀態    最快      中位數");
  console.log("─".repeat(58));

  for (const path of PATHS) {
    const url = `${BASE}${path}`;
    const times: number[] = [];
    let status = 0;

    for (let i = 0; i < SAMPLES; i++) {
      try {
        const r = await sample(url);
        times.push(r.total);
        status = r.status;
      } catch {
        status = 0;
      }
    }

    if (times.length === 0) {
      console.log(`${path.padEnd(28)}  連不上`);
      continue;
    }

    console.log(
      `${path.padEnd(28)}  ${String(status).padStart(3)}  ` +
        `${Math.min(...times).toFixed(0).padStart(6)}ms  ` +
        `${median(times).toFixed(0).padStart(6)}ms`,
    );
  }

  console.log("");
  console.log("判讀（從台灣量正式站）：");
  console.log("  200ms 以下   路徑乾淨，函式與資料庫都在附近");
  console.log("  300-600ms    多半是中間多了一層代理，或函式與資料庫不同區。");
  console.log("               先看上面有沒有 Cloudflare 那段警告；沒有的話");
  console.log("               再去 Settings → Functions 確認區域，改完要重新部署");
  console.log("  1 秒以上     多半是 Neon 從休眠中醒來。再跑一次，");
  console.log("               第二次若正常就是冷啟動而不是設定問題");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
