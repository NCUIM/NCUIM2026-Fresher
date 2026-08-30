import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BASE,
  disconnect,
  joinAs,
  prisma,
  requireServer,
  resetParticipants,
} from "./helpers.mts";

/** 目前各組的人數，由小到大。 */
async function teamSizes(): Promise<number[]> {
  const rows = await prisma.participant.groupBy({
    by: ["teamId"],
    where: { role: "PARTICIPANT", teamId: { not: null } },
    _count: true,
  });
  return rows.map((r) => r._count).sort((a, b) => a - b);
}

describe("報到時的分組", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("循序報到平均分配", async () => {
    for (let i = 0; i < 20; i++) {
      await joinAs(`循序${String(i + 1).padStart(2, "0")}`);
    }
    const sizes = await teamSizes();
    assert.equal(
      sizes[sizes.length - 1] - sizes[0],
      0,
      `二十人分十組應該各兩人，實際：${sizes.join(", ")}`,
    );
  });

  it("同時報到也要平均分配", async () => {
    /*
      這是活動開場最真實的一刻：一群人站在門口同時掃報到碼。

      光把分隊放進交易裡是不夠的——PostgreSQL 預設的 READ COMMITTED
      讓兩個併發交易讀到同一份人數，各自挑中同一組。這個案例曾經跑出
      5,5,5,5,6,8,9,9,9,9，而循序報到是完美的十組各七人。

      後果不只是不好看：「集齊全隊」這類成就的難度會因為隊伍人數不同
      而失衡，九人隊要收集的人比五人隊多了近一倍。
    */
    const joins = Array.from({ length: 30 }, (_, i) => {
      const n = String(i + 1).padStart(2, "0");
      return fetch(`${BASE}/api/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          entryCode: "JOINNCU1",
          passcode: "1234",
          nickname: `同時${n}`,
          realName: `同時${n}`,
          bio: "併發報到的分組驗證",
          icons: ["music", "code", "coffee"],
          zodiac: "aries",
          university: "中央大學",
        }),
      });
    });

    const results = await Promise.all(joins);
    const created = results.filter((r) => r.status === 201).length;
    assert.equal(created, 30, "同時報到不該有人失敗");

    const sizes = await teamSizes();
    assert.ok(
      sizes[sizes.length - 1] - sizes[0] <= 1,
      `各組人數最多只該差一人，實際：${sizes.join(", ")}`,
    );
  });

  it("工作人員不佔用組別名額", async () => {
    /*
      工作人員進了 Team 的話，「集齊全隊」會變成必須收集到工作人員，
      而隊伍人數也會被灌水——兩者都讓那個成就變成無法達成。
    */
    const staff = await joinAs("工作人員", { entryCode: "STAFFNCU" });
    const row = await prisma.participant.findUnique({
      where: { id: staff.id },
      select: { role: true, teamId: true },
    });

    assert.equal(row?.role, "STAFF");
    assert.equal(row?.teamId, null, "工作人員不該被分到任何一組");
  });
});
