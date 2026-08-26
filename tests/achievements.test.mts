import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  disconnect,
  get,
  joinAs,
  requireServer,
  resetParticipants,
  restoreAchievementThresholds,
  scan,
  setAchievementThreshold,
  type Session,
} from "./helpers.mts";

/** 讓 scanner 主動掃描 n 個新建立的參與者。 */
async function scanOthers(scanner: Session, n: number) {
  for (let i = 0; i < n; i++) {
    const other = await joinAs(`路人${i}`);
    await scan(scanner, other);
  }
}

const findAchievement = (body: any, key: string) =>
  body.achievements.find((a: any) => a.key === key);

describe("成就達成", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("掃描達門檻時獲得成就", async () => {
    const ming = await joinAs("陳小明");
    await scanOthers(ming, 5); // 種子設定 scan-5 的門檻為 5

    const res = await get("/api/me", ming.cookie);

    const achievement = findAchievement(res.body, "scan-5");
    assert.equal(achievement.earned, true, "掃滿 5 人應獲得破冰者");
  });

  it("未達門檻時不獲得，但看得到進度", async () => {
    const ming = await joinAs("陳小明");
    await scanOthers(ming, 3);

    const res = await get("/api/me", ming.cookie);

    const achievement = findAchievement(res.body, "scan-5");
    assert.equal(achievement.earned, false);
    assert.equal(achievement.progress.current, 3, "應顯示還差多少");
    assert.equal(achievement.progress.target, 5);
  });
});

describe("隱藏成就", () => {
  before(requireServer);
  beforeEach(resetParticipants);
  after(disconnect);

  it("未達成前不透露名稱、條件與進度", async () => {
    const ming = await joinAs("陳小明");
    await scanOthers(ming, 1);

    const res = await get("/api/me", ming.cookie);

    // staff-hunter 在種子設定中是隱藏成就
    const hidden = findAchievement(res.body, "staff-hunter");
    assert.equal(hidden.earned, false);
    assert.equal(hidden.hidden, true);
    assert.equal(hidden.title, undefined, "不得透露名稱");
    assert.equal(hidden.description, undefined, "不得透露條件");
    assert.equal(hidden.progress, undefined, "不得透露進度");
  });

  it("達成後才顯示內容", async () => {
    const ming = await joinAs("陳小明");
    // staff-hunter 需掃描 3 位工作人員
    for (let i = 0; i < 3; i++) {
      const staff = await joinAs(`幹部${i}`, { entryCode: "STAFFNCU" });
      await scan(ming, staff);
    }

    const res = await get("/api/me", ming.cookie);

    const hidden = findAchievement(res.body, "staff-hunter");
    assert.equal(hidden.earned, true);
    assert.equal(hidden.title, "幹部獵人", "達成後應顯示名稱");
  });
});

describe("ADR-0002：已達成的成就永不撤銷", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await restoreAchievementThresholds();
  });
  after(async () => {
    await restoreAchievementThresholds();
    await disconnect();
  });

  it("門檻在活動中被調高，已達成者不受影響", async () => {
    const ming = await joinAs("陳小明");
    await scanOthers(ming, 5);

    const before = await get("/api/me", ming.cookie);
    assert.equal(findAchievement(before.body, "scan-5").earned, true, "前提：先達成");
    const scoreBefore = before.body.score.achievement;

    // 主辦方發現門檻太低，中途調高到 15
    await setAchievementThreshold("scan-5", 15);

    const after = await get("/api/me", ming.cookie);

    assert.equal(
      findAchievement(after.body, "scan-5").earned,
      true,
      "調高門檻不得撤銷已達成的成就",
    );
    assert.equal(
      after.body.score.achievement,
      scoreBefore,
      "分數也不得被收回",
    );
  });

  it("集齊全隊後有人加入隊伍，成就不被撤銷", async () => {
    // 種子活動有 10 組，輪流分配：第 1 位與第 11 位會落在同一組。
    const ming = await joinAs("陳小明");
    let teammate: Session | null = null;
    for (let i = 0; i < 12 && !teammate; i++) {
      const p = await joinAs(`路人${i}`);
      const info = await get("/api/me", p.cookie);
      const mingInfo = await get("/api/me", ming.cookie);
      if (info.body.team?.number === mingInfo.body.team?.number) teammate = p;
    }
    assert.ok(teammate, "前提：必須找到一位同組隊員");

    await scan(ming, teammate);
    const before = await get("/api/me", ming.cookie);
    assert.equal(
      findAchievement(before.body, "team-all").earned,
      true,
      "前提：當時隊上只有這位隊員，應已集齊全隊",
    );

    // 遲到者報到，被補進人數最少的隊伍——小明的隊伍可能因此變大
    for (let i = 0; i < 12; i++) await joinAs(`遲到${i}`);

    const after = await get("/api/me", ming.cookie);

    assert.equal(
      findAchievement(after.body, "team-all").earned,
      true,
      "隊伍人數變多不得讓已集齊的人失去成就",
    );
  });

  it("尚未達成者則適用新門檻", async () => {
    await setAchievementThreshold("scan-5", 3);
    const ming = await joinAs("陳小明");
    await scanOthers(ming, 3);

    const res = await get("/api/me", ming.cookie);

    assert.equal(
      findAchievement(res.body, "scan-5").earned,
      true,
      "調降後達到新門檻者應獲得成就",
    );
  });
});
