import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rankAll } from "@/lib/leaderboard";

/**
 * 公開唯讀的排行榜，給站外的頁面取用。
 *
 * 與 /api/leaderboard 的差別不只是「不用登入」，而是三件事各自有理由：
 *
 * 1. **完全不需要 credentials。** 因此可以安全地開 `Allow-Origin: *`——
 *    規格禁止 `*` 搭配 credentials，而反過來指名某個來源並開
 *    `Allow-Credentials`，等於授權那個網域讀取「以訪客身分登入後看到的
 *    內容」。那個頁面哪天換手或被入侵，就是一條外洩通道。
 *
 * 2. **不回傳 participantId。** 它不是機密（頭像端點也用它），但把內部 id
 *    灑到公開網路上沒有任何好處。對外只需要名次、暱稱、分數。
 *
 * 3. **CDN 快取是必要的，不是最佳化。** 每次呼叫都會跑一次 rankAll——
 *    撈全部參與者再做兩次 groupBy。公開端點沒有這一層的話，任何人寫個
 *    迴圈就能把 Neon 免費方案的傳輸額度打光，然後活動當天整個站掛掉。
 *    s-maxage=30 讓無上限的請求量變成「資料庫每 30 秒被查一次」。
 */

/** 快取秒數。三十秒的延遲在排行榜上看不出來，卻是成本的數量級差別。 */
const CACHE_SECONDS = 30;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/** 簡單 GET 不會觸發預檢，但站外若加了自訂標頭就會——先接住。 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const eventId = new URL(req.url).searchParams.get("eventId");

  /*
    不帶 eventId 時就用當下唯一進行中的那一場。

    要求站外的頁面寫死一個 id 是個陷阱：活動重建過（改名、重來一次、
    或先前那場被刪掉）id 就變了，而那個頁面不會有任何錯誤提示，只會
    安靜地停在 404。少一個要同步的東西，就少一個活動當天才發現的問題。

    同時有多場進行中時仍然要求指名——那時候「哪一場」沒有正確答案，
    猜錯比報錯更糟。
  */
  const select = {
    id: true,
    name: true,
    status: true,
    leaderboardTopN: true,
    publicLeaderboard: true,
  } as const;

  let event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId }, select })
    : null;

  if (!eventId) {
    const active = await prisma.event.findMany({
      // 只考慮已開放公開的場次——沒開放的活動連「存在」都不該從這裡問出來。
      where: { status: "ACTIVE", publicLeaderboard: true },
      orderBy: { createdAt: "desc" },
      select,
    });
    if (active.length > 1) {
      return NextResponse.json(
        {
          error:
            "同時有多場進行中的活動，請帶上 eventId 指定要哪一場。",
          events: active.map((e) => ({ id: e.id, name: e.name })),
        },
        { status: 400, headers: CORS_HEADERS },
      );
    }
    event = active[0] ?? null;
  }

  /*
    三個條件都要成立才回資料：活動存在、進行中、而且主辦方明確開放了公開。

    **預設關閉是刻意的。** 開放等於讓全世界看得到這場所有人的暱稱與分數，
    而暱稱是參與者自己取的——那該是主辦方按下的一個動作，不是預設行為。

    封存之後也停止：封存的用意是「活動結束，收集關閉」，那時把排名留在
    公開網路上沒有意義，而十四天後個資會被清除（ADR-0001），屆時這個
    端點回傳的東西也不再有對應的人。

    三種情況回一模一樣的 404——不存在、已封存、沒開放公開。否則拿 id
    逐一試就能問出哪些活動存在過，以及哪些辦過但沒公開。
  */
  if (!event || event.status !== "ACTIVE" || !event.publicLeaderboard) {
    return NextResponse.json(
      { error: "找不到公開的排行榜" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const entries = await rankAll(event.id);

  return NextResponse.json(
    {
      event: { name: event.name },
      updatedAt: new Date().toISOString(),
      totalRanked: entries.length,
      // 沿用該場活動自己的 topN 設定，與參與者看到的同一條規則。
      top: entries.slice(0, event.leaderboardTopN).map((e) => ({
        rank: e.rank,
        nickname: e.nickname,
        score: e.score,
      })),
    },
    {
      headers: {
        ...CORS_HEADERS,
        /*
          s-maxage 是給 CDN 的，max-age=0 是給瀏覽器的——讓瀏覽器每次都問
          CDN，而 CDN 每三十秒才問一次伺服器。stale-while-revalidate 讓
          過期的那一瞬間仍然有東西可回，不會把重新計算的延遲丟給訪客。
        */
        "Cache-Control":
          `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 2}`,
      },
    },
  );
}
