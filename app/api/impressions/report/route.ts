import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentParticipant } from "@/lib/session";
import { reportImpression } from "@/lib/wall";

const reportSchema = z.object({ impressionId: z.string().min(1) });

/**
 * 回報一則 Impression 給主辦方審核，**不改變它在牆上的顯示**。
 *
 * 與隱藏分開的理由見 lib/wall.ts：兩者是不同的意圖，
 * 綁在一起會逼只想眼不見為淨的人驚動主辦方。
 */
export async function POST(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "輸入內容有誤" }, { status: 400 });
  }

  const ok = await reportImpression(me.id, parsed.data.impressionId);
  if (!ok) {
    return NextResponse.json({ error: "找不到這則內容" }, { status: 404 });
  }

  return NextResponse.json({ reported: true });
}
