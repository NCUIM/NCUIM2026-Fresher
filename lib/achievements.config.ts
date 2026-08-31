import type { AchievementType, Role } from "@prisma/client";

/**
 * 第一階段的 Achievement 以設定檔定義，變更需重新部署（Q26 的簡化形式）。
 * 建立 Event 時寫入資料庫，因此日後開放後台自訂時不需要改動資料結構。
 *
 * ⚠️ 門檻上限：單場約 70 人，任何人最多只能掃到 69 個人。
 * SCAN_COUNT 與 COLLECTED_COUNT 的 threshold 不可接近這個數字，
 * 否則會做出永遠沒有人達得成的成就。
 */
export type AchievementConfig = {
  key: string;
  type: AchievementType;
  /** TEAM_COLLECT 填 -1 代表「全部隊員」；EARLY_SCAN 的單位是分鐘。 */
  threshold: number;
  points: number;
  hidden: boolean;
  title: string;
  description?: string;
  targetRole?: Role;
};

export const DEFAULT_ACHIEVEMENTS: AchievementConfig[] = [
  {
    key: "scan-5",
    type: "SCAN_COUNT",
    threshold: 5,
    points: 50,
    hidden: false,
    title: "破冰者",
    description: "主動掃描 5 個人",
  },
  {
    key: "scan-15",
    type: "SCAN_COUNT",
    threshold: 15,
    points: 150,
    hidden: false,
    title: "社交高手",
    description: "主動掃描 15 個人",
  },
  {
    key: "collected-10",
    type: "COLLECTED_COUNT",
    threshold: 10,
    points: 100,
    hidden: false,
    title: "人氣王",
    description: "被 10 個人收集",
  },
  {
    key: "team-first",
    type: "TEAM_COLLECT",
    threshold: 1,
    points: 40,
    hidden: false,
    title: "找到隊友",
    description: "收集到第一位同組隊員",
  },
  {
    key: "team-all",
    type: "TEAM_COLLECT",
    threshold: -1, // 全部隊員，以達成當下的隊伍人數認定（ADR-0002）
    points: 200,
    hidden: false,
    title: "集齊全隊",
    description: "收集到所有同組隊員",
  },
  {
    key: "staff-hunter",
    type: "SCAN_ROLE",
    threshold: 3,
    points: 80,
    hidden: true, // 隱藏成就：達成前只顯示為「隱藏成就」
    title: "幹部獵人",
    description: "掃描到 3 位工作人員",
    targetRole: "STAFF",
  },
  {
    key: "early-bird",
    type: "EARLY_SCAN",
    threshold: 15, // 開放收集後 15 分鐘內（見 lib/achievements.ts 的 EARLY_SCAN）
    points: 30,
    hidden: true,
    title: "早鳥",
    description: "開放收集後 15 分鐘內完成第一次掃描",
  },
];
