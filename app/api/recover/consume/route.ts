import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeToken, rotateSessionToken } from "@/lib/recovery";
import { setSessionCookie } from "@/lib/session";

const schema = z.object({ token: z.string().min(1) });

/**
 * 使用找回權杖，把身分綁到這台裝置上。
 *
 * **全站唯一會替參與者種下身分 cookie 的地方，除了報到。**
 * 刻意是 POST：先前 /recover/[token] 是 GET，被開啟就直接綁定，
 * 於是任何人都能把自己的找回連結傳給別人，讓對方的瀏覽器靜默地
 * 變成自己（session fixation）。現在綁定一定來自確認頁上的一次點擊。
 */
export async function POST(req: Request) {
  /*
    CSRF 防線：只接受 application/json。

    HTML 表單只送得出 urlencoded、multipart 與 text/plain 三種內容型別，
    送不出 application/json——所以跨站的表單打不進來。而跨站的 fetch 要送
    application/json 會先觸發預檢，這支端點沒有任何 CORS 標頭，預檢過不了。

    這道檢查不能省：Next 的 req.json() 不看 Content-Type 就會剖析，
    而攻擊者能用 enctype="text/plain" 的表單湊出一個合法的 JSON 主體
    （把欄位名當成 `{"token":"...","x":"` 這樣的前綴）。少了這一句，
    那個把戲就成立了。

    不改用比對 Origin 與 Host：這個 app 在實機測試時走 ngrok / cloudflared
    隧道，反向代理後面的 Host 未必等於使用者看到的網域，那個比對會在
    測試環境誤擋，而誤擋一條找回路徑比它擋下的風險更麻煩。
  */
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 415 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "連結無效" }, { status: 400 });
  }

  const result = await consumeToken(parsed.data.token, "RECOVER_SESSION");
  if (!result.ok) {
    // 過期、用過、用途不符都回同一種失敗——對使用者而言差別只是
    // 「請再要一次新的連結」，區分這些狀態只會多洩漏資訊。
    return NextResponse.json({ error: "連結已失效" }, { status: 400 });
  }

  /*
    換發身分憑證，而不是沿用舊的那一份。

    這是工作人員協助找回時原本就有的語意（「換發等於讓遺失的那份作廢」），
    現在對信箱自助找回也一併成立：會走到這條路的人，多半正是因為裝置遺失
    或瀏覽器資料被清掉——舊憑證留著有效沒有好處。

    附帶的好處是讓憑證外洩變得看得見：萬一找回信被攔截，真正的使用者會
    在自己的裝置上被登出，而不是與攻擊者無聲地共用同一個身分。
  */
  const sessionToken = await rotateSessionToken(result.participantId);
  await setSessionCookie(sessionToken);

  return NextResponse.json({ ok: true });
}
