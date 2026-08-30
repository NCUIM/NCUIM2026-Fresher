import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createHostAdmin,
  disconnect,
  get,
  joinAs,
  loginAs,
  removeTestAdmins,
  requireServer,
  resetParticipants,
  scan,
  secondEventId,
} from "./helpers.mts";

type Pending = { pendingImpressions: { subjectId: string }[] };

type Snapshot = {
  stats: {
    participants: number;
    encounters: number;
    achievements: number;
    maxAchievementPoints: number;
  };
  nodes: { id: string; nickname: string; role: string; score: number }[];
  edges: { id: string; scannerId: string; scannedId: string; at: string }[];
  feed: {
    id: string;
    kind: "scan" | "achievement";
    actorId: string;
    targetId: string | null;
    actor: string;
    target: string | null;
    label: string | null;
  }[];
  ranking: { rank: number; participantId: string; score: number }[];
};

describe("活動戰情室的即時快照", () => {
  before(requireServer);
  beforeEach(async () => {
    await resetParticipants();
    await removeTestAdmins();
  });
  after(async () => {
    await removeTestAdmins();
    await disconnect();
  });

  it("未登入拿不到任何東西", async () => {
    const res = await get("/api/admin/warroom");
    assert.equal(res.status, 401);
  });

  it("主持人拿沒被指派的活動，回 404 而不是 403", async () => {
    /*
      403 等於承認「這場活動存在，只是你不能看」——那就能拿 id 逐一
      探測有哪些活動。查不到與不准看必須是同一個回應。
    */
    const superCookie = await loginAs("admin", "change-me");
    const otherEvent = await secondEventId(superCookie);

    await createHostAdmin("test-host", "host-pw");
    const hostCookie = await loginAs("test-host", "host-pw");

    const res = await get(`/api/admin/warroom?eventId=${otherEvent}`, hostCookie);
    assert.equal(res.status, 404);
  });

  it("一次掃描產生一條連線，而且雙方都收集到對方", async () => {
    /*
      這是 Scan 與 Collection 的分界，也是整張圖的意義所在：
      Collection 對稱（雙方各得一張卡），Scan 只歸屬發起方。
      連線是「相遇」，所以 A 掃 B 之後 B 再回掃 A 不會多出第二條。
    */
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);

    const cookie = await loginAs("admin", "change-me");
    const res = await get<Snapshot>("/api/admin/warroom", cookie);
    assert.equal(res.status, 200);

    const edges = res.body.edges.filter(
      (e) =>
        [e.scannerId, e.scannedId].includes(ming.id) &&
        [e.scannerId, e.scannedId].includes(hua.id),
    );
    assert.equal(edges.length, 1, "同一對人只該有一條連線");
    assert.equal(edges[0].scannerId, ming.id, "發起方要照實記錄");
    assert.equal(edges[0].scannedId, hua.id);

    /*
      雙方各自的收集清單裡都有對方。

      用 /api/me 的 pendingImpressions 來看——它直接由 Collection 推導
      （收集了但還沒寫短評的人），所以它列得出對方，就等於 Collection
      真的建立了，不必另外開一個端點來驗。
    */
    const mine = await get<Pending>("/api/me", ming.cookie);
    const theirs = await get<Pending>("/api/me", hua.cookie);
    assert.ok(
      mine.body.pendingImpressions.some((p) => p.subjectId === hua.id),
      "掃描的人要收集到被掃的人",
    );
    assert.ok(
      theirs.body.pendingImpressions.some((p) => p.subjectId === ming.id),
      "被掃的人也要收集到掃描的人",
    );

    // 回掃不會多出一條線——pairKey 讓 A→B 與 B→A 是同一次相遇。
    await scan(hua, ming);
    const again = await get<Snapshot>("/api/admin/warroom", cookie);
    const stillOne = again.body.edges.filter(
      (e) =>
        [e.scannerId, e.scannedId].includes(ming.id) &&
        [e.scannerId, e.scannedId].includes(hua.id),
    );
    assert.equal(stillOne.length, 1, "回掃不該產生第二條連線");
  });

  it("節點帶著分數，那是節點大小的依據", async () => {
    const ming = await joinAs("陳小明");
    await joinAs("林小華");

    const cookie = await loginAs("admin", "change-me");
    const res = await get<Snapshot>("/api/admin/warroom", cookie);

    const node = res.body.nodes.find((n) => n.id === ming.id);
    assert.ok(node, "每位參與者都要是一個節點");
    assert.equal(typeof node.score, "number");
  });

  it("事件牆記下誰掃了誰，而且帶 id", async () => {
    /*
      帶 id 不是多餘的：星圖要把漣漪打在正確的柱子上，而暱稱不唯一——
      兩個「小明」會讓漣漪亮錯人。
    */
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);

    const cookie = await loginAs("admin", "change-me");
    const res = await get<Snapshot>("/api/admin/warroom", cookie);

    const entry = res.body.feed.find(
      (f) => f.kind === "scan" && f.actor === "陳小明",
    );
    assert.ok(entry, "掃描要出現在事件牆上");
    assert.equal(entry.target, "林小華");
    assert.equal(entry.actorId, ming.id);
    assert.equal(entry.targetId, hua.id);
  });

  it("統計卡的數字來自全場，不是事件牆那四十筆", async () => {
    /*
      成就總數不能用 feed 的長度去數——事件牆只帶最新四十筆，解鎖超過
      四十次之後那個數字會永遠停在 40。
    */
    const ming = await joinAs("陳小明");
    const hua = await joinAs("林小華");
    await scan(ming, hua);

    const cookie = await loginAs("admin", "change-me");
    const res = await get<Snapshot>("/api/admin/warroom", cookie);

    assert.equal(res.body.stats.participants, res.body.nodes.length);
    assert.equal(res.body.stats.encounters, res.body.edges.length);
    assert.equal(typeof res.body.stats.achievements, "number");
    assert.ok(res.body.stats.achievements >= 0);
    /*
      成就特效的等級是相對於這個值算的。少了它，門檻就得寫死，
      而分值是逐場自訂的——寫死的門檻在某些場次會讓所有成就同一級。
    */
    assert.equal(typeof res.body.stats.maxAchievementPoints, "number");
    assert.ok(res.body.stats.maxAchievementPoints > 0);
  });

  it("排名涵蓋全場，不是只有前幾名", async () => {
    /*
      戰情室要投在大螢幕上，看的是全場的分佈。參與者端的排行榜只給前 N 名，
      這裡若沿用那個切法，後段的人就整片消失。
    */
    await joinAs("甲");
    await joinAs("乙");
    await joinAs("丙");

    const cookie = await loginAs("admin", "change-me");
    const res = await get<Snapshot>("/api/admin/warroom", cookie);

    const nonStaff = res.body.nodes.filter((n) => n.role !== "STAFF").length;
    assert.equal(res.body.ranking.length, nonStaff);
  });
});
