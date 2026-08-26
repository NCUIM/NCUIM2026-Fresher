import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  get,
  joinAs,
  requireServer,
  resetParticipants,
  type Session,
} from "./helpers.mts";

/** 最小的合法 JPEG（1x1 像素），用來驗證上傳流程而非影像內容。 */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
    "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

async function upload(session: Session, bytes: Buffer, type = "image/jpeg") {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type }), "avatar.jpg");
  const res = await fetch(`${BASE}/api/avatar`, {
    method: "POST",
    headers: { cookie: session.cookie },
    body: form,
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

describe("頭像上傳", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("上傳後 Profile 帶有頭像網址", async () => {
    const ming = await joinAs("陳小明");

    const res = await upload(ming, TINY_JPEG);

    assert.equal(res.status, 201, JSON.stringify(res.body));
    const me = await get("/api/me", ming.cookie);
    assert.ok(me.body.avatarUrl, "上傳後應有 avatarUrl");
  });

  it("上傳的影像可以被取回", async () => {
    const ming = await joinAs("陳小明");
    await upload(ming, TINY_JPEG);

    const res = await fetch(`${BASE}/api/avatar/${ming.id}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/jpeg");
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.equal(bytes.length, TINY_JPEG.length, "取回的內容應與上傳的一致");
  });

  it("未報到者不能上傳", async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(TINY_JPEG)], { type: "image/jpeg" }));
    const res = await fetch(`${BASE}/api/avatar`, { method: "POST", body: form });

    assert.equal(res.status, 401);
  });

  it("拒絕非影像檔", async () => {
    const ming = await joinAs("陳小明");

    const res = await upload(ming, Buffer.from("not an image"), "text/plain");

    assert.equal(res.status, 400);
  });

  it("拒絕過大的檔案", async () => {
    const ming = await joinAs("陳小明");
    const tooBig = Buffer.alloc(1_000_000, 1); // 1MB，遠超前端壓縮後的預期大小

    const res = await upload(ming, tooBig);

    assert.equal(res.status, 413);
  });

  it("管理員清除違規內容時一併移除頭像", async () => {
    const ming = await joinAs("陳小明");
    await upload(ming, TINY_JPEG);

    const login = await fetch(`${BASE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "change-me" }),
    });
    const adminCookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

    await fetch(`${BASE}/api/admin/participants/${ming.id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminCookie },
      body: JSON.stringify({ clearAvatar: true }),
    });

    const res = await fetch(`${BASE}/api/avatar/${ming.id}`);
    assert.equal(res.status, 404, "清除後影像本體也不該還取得到");
  });
});
