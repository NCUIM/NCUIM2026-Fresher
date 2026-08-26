import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentParticipant } from "@/lib/session";
import { performScan, SCAN_FAILURE_MESSAGE } from "@/lib/scan";
import { firstErrorMessage } from "@/lib/validation";

const scanSchema = z.object({
  personalCode: z.string().trim().min(1, "缺少個人碼"),
});

/** 收集：掃描對方的 Personal Code，雙方互相建立 Collection。 */
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

  const parsed = scanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const outcome = await performScan(me.id, parsed.data.personalCode);

  if (!outcome.ok) {
    // 全部歸為 409：這些都是「請求本身合法，但當下狀態不允許」的情形，
    // 用不同狀態碼區分對前端沒有幫助，reason 已經足夠。
    return NextResponse.json(
      { error: SCAN_FAILURE_MESSAGE[outcome.reason], reason: outcome.reason },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { duplicate: outcome.duplicate, card: outcome.card },
    { status: outcome.duplicate ? 200 : 201 },
  );
}
