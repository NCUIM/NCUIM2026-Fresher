import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import { firstErrorMessage, impressionSchema } from "@/lib/validation";

/** 撰寫一段針對已收集對象的 Impression。 */
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

  const parsed = impressionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstErrorMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { subjectId, text } = parsed.data;

  // 只能對已收集的對象撰寫。Collection 的存在就是「我們見過面」的證據，
  // 沒有它就代表雙方沒有互動過，不應該能留下關於對方的文字。
  const collection = await prisma.collection.findUnique({
    where: { ownerId_subjectId: { ownerId: me.id, subjectId } },
  });
  if (!collection) {
    return NextResponse.json(
      { error: "你還沒有收集到這個人" },
      { status: 403 },
    );
  }

  // 一組收集關係至多一則 Impression，再次撰寫視為修改。
  // 唯一鍵 (authorId, subjectId) 保證這一點，upsert 讓「第一次寫」與
  // 「改寫」走同一條路徑，前端不需要先查詢是否已存在。
  const where = { authorId_subjectId: { authorId: me.id, subjectId } };
  const existing = await prisma.impression.findUnique({ where });

  const impression = await prisma.impression.upsert({
    where,
    create: { eventId: me.eventId, authorId: me.id, subjectId, text },
    update: { text },
  });

  return NextResponse.json(
    { id: impression.id, subjectId: impression.subjectId, text: impression.text },
    { status: existing ? 200 : 201 },
  );
}
