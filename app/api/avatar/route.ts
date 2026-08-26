import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/session";
import {
  isAllowedImageType,
  MAX_AVATAR_BYTES,
  sniffImageType,
} from "@/lib/image";

export async function POST(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "沒有收到檔案" }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { error: "圖片太大了，請重新選擇" },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());

  // 以實際內容判斷格式，不採信上傳端宣告的 Content-Type。
  const contentType = sniffImageType(bytes);
  if (!isAllowedImageType(contentType)) {
    return NextResponse.json(
      { error: "只接受 JPEG、PNG 或 WebP 圖片" },
      { status: 400 },
    );
  }

  const avatar = await prisma.avatar.upsert({
    where: { participantId: me.id },
    create: { participantId: me.id, contentType, data: Buffer.from(bytes) },
    update: { contentType, data: Buffer.from(bytes) },
  });

  // 網址帶上更新時間戳，讓瀏覽器可以長期快取又不會在換頭像後拿到舊圖。
  const avatarUrl = `/api/avatar/${me.id}?v=${avatar.updatedAt.getTime()}`;
  await prisma.participant.update({
    where: { id: me.id },
    data: { avatarUrl },
  });

  return NextResponse.json({ avatarUrl }, { status: 201 });
}

export async function DELETE() {
  const me = await getCurrentParticipant();
  if (!me) {
    return NextResponse.json({ error: "請先完成報到" }, { status: 401 });
  }

  await prisma.avatar.deleteMany({ where: { participantId: me.id } });
  await prisma.participant.update({
    where: { id: me.id },
    data: { avatarUrl: null },
  });

  return NextResponse.json({ ok: true });
}
