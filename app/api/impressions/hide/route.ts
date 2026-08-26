import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentParticipant } from "@/lib/session";
import { hideImpression } from "@/lib/wall";
import { firstErrorMessage } from "@/lib/validation";

const hideSchema = z.object({
  impressionId: z.string().min(1),
  report: z.boolean().optional().default(false),
});

/** 收件人隱藏一則 Impression，可一併回報給 Admin。 */
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

  const parsed = hideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const ok = await hideImpression(
    me.id,
    parsed.data.impressionId,
    parsed.data.report,
  );

  if (!ok) {
    // 非收件人與不存在回傳相同結果：否則這個端點會變成「查詢某則
    // Impression 是否存在」的探測工具。
    return NextResponse.json({ error: "找不到這則內容" }, { status: 404 });
  }

  return NextResponse.json({ hidden: true });
}
