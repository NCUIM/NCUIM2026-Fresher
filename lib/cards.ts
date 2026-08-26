import type { Participant, Team } from "@prisma/client";
import { iconByKey } from "./icons";

/**
 * Card 是 Profile 對外呈現的形式，**即時反映最新狀態、不是收集當下的快照**。
 * 因此這裡一律從當前的 Participant 記錄組出，不儲存任何副本——
 * 這正是 Admin 移除違規內容後能立即對所有持有者生效的原因。
 */
export type CardView = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  socialUrl: string | null;
  bio: string | null;
  icons: Array<{ key: string; emoji: string; label: string }>;
  role: Participant["role"];
  team: { number: number; name: string | null } | null;
};

export function toCardView(
  p: Participant & { team?: Team | null },
): CardView {
  return {
    id: p.id,
    nickname: p.nickname,
    avatarUrl: p.avatarUrl,
    socialUrl: p.socialUrl,
    bio: p.bio,
    icons: p.icons
      .map((key) => {
        const icon = iconByKey(key);
        return icon ? { key: icon.key, emoji: icon.emoji, label: icon.label } : null;
      })
      .filter((i): i is NonNullable<typeof i> => i !== null),
    role: p.role,
    team: p.team ? { number: p.team.number, name: p.team.name } : null,
  };
}
