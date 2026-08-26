import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  disconnect,
  get,
  joinAs,
  post,
  requireServer,
  resetParticipants,
  scan,
  setLeaderboardTopN,
  type Session,
} from "./helpers.mts";

/** 讓 who 主動掃描 n 人並全部寫完 Impression，藉此累積分數。 */
async function earnPoints(who: Session, n: number) {
  for (let i = 0; i < n; i++) {
    const other = await joinAs(`路人${who.nickname}${i}`);
    await scan(who, other);
    await post(
      "/api/impressions",
      { subjectId: other.id, text: "很高興認識你" },
      who.cookie,
    );
  }
}

describe("排行榜", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("工作人員不出現在排名中", async () => {
    const staff = await joinAs("幹部小李", { entryCode: "STAFFNCU" });
    await earnPoints(staff, 3); // 讓工作人員拿到不低的分數
    const ming = await joinAs("陳小明");
    await earnPoints(ming, 1);

    const res = await get("/api/leaderboard", ming.cookie);

    assert.equal(res.status, 200);
    const names = res.body.top.map((e: any) => e.nickname);
    assert.ok(!names.includes("幹部小李"), `工作人員不該入榜，實際：${names}`);
  });

  it("依分數由高到低排序", async () => {
    const low = await joinAs("低分");
    await earnPoints(low, 1);
    const high = await joinAs("高分");
    await earnPoints(high, 3);

    const res = await get("/api/leaderboard", low.cookie);

    const ranked = res.body.top.filter((e: any) =>
      ["高分", "低分"].includes(e.nickname),
    );
    assert.equal(ranked[0].nickname, "高分", "分數高的應排在前面");
    assert.ok(ranked[0].score > ranked[1].score);
  });

  it("只回傳前 N 名，不回傳完整排名", async () => {
    await setLeaderboardTopN(2);
    try {
      const a = await joinAs("甲");
      await earnPoints(a, 3);
      const b = await joinAs("乙");
      await earnPoints(b, 2);
      const c = await joinAs("丙");
      await earnPoints(c, 1);

      const res = await get("/api/leaderboard", c.cookie);

      assert.equal(res.body.top.length, 2, "只該公開前 2 名");
      assert.ok(
        res.body.totalRanked > 2,
        "前提：實際參與排名的人數多於公開名額",
      );
    } finally {
      await setLeaderboardTopN(10);
    }
  });

  it("不在前 N 名的人仍看得到自己的名次", async () => {
    await setLeaderboardTopN(1);
    try {
      const winner = await joinAs("冠軍");
      await earnPoints(winner, 3);
      const other = await joinAs("落後者");
      await earnPoints(other, 1);

      const res = await get("/api/leaderboard", other.cookie);

      assert.equal(res.body.top.length, 1);
      assert.ok(res.body.me, "應回傳自己的名次");
      assert.equal(res.body.me.nickname, "落後者");
      assert.ok(res.body.me.rank > 1, "名次應在第一名之後");
    } finally {
      await setLeaderboardTopN(10);
    }
  });
});
