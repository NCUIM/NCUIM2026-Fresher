import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentParticipant } from "@/lib/session";
import {
  getShowcase,
  replaceShowcase,
  SHOWCASE_SIZE,
  type ShowcaseError,
} from "@/lib/showcase";
import { firstErrorMessage } from "@/lib/validation";

const putSchema = z.object({
  // null 代表該格留空。索引即格子位置，所以空格必須能被表達出來。
  subjectIds: z.array(z.string().min(1).nullable()),
});

const MESSAGE: Record<ShowcaseError, string> = {
  too_many: `最多只能放 ${SHOWCASE_SIZE} 張`,
  not_collected: "只能展示已經收集到的人",
  duplicate: "同一個人不能放兩次",
};

const STATUS: Record<ShowcaseError, number> = {
  too_many: 400,
  duplicate: 400,
  not_collected: 403,
};

export async function GET() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }
  return NextResponse.json({ slots: await getShowcase(me.id) });
}

export async function PUT(req: Request) {
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

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }

  const result = await replaceShowcase(me.id, parsed.data.subjectIds);
  if (!result.ok) {
    return NextResponse.json(
      { error: MESSAGE[result.reason] },
      { status: STATUS[result.reason] },
    );
  }

  return NextResponse.json({ slots: await getShowcase(me.id) });
}
