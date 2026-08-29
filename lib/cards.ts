import type { Participant, Team } from "@prisma/client";
import { iconByKey } from "./icons";
import { zodiacByKey } from "./zodiac";
import { cardColorByKey } from "./card-colors";

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
  zodiac: { key: string; label: string; emoji: string } | null;
  university: string | null;
  role: Participant["role"];
  team: { number: number; name: string | null } | null;
  /** 卡面底色。由本人選定，看的人不能改。 */
  color: { key: string; bg: string; accent: string };
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
    zodiac: (() => {
      const z = zodiacByKey(p.zodiac);
      return z ? { key: z.key, label: z.label, emoji: z.emoji } : null;
    })(),
    university: p.university,
    role: p.role,
    team: p.team ? { number: p.team.number, name: p.team.name } : null,
    color: (() => {
      const c = cardColorByKey(p.cardColor);
      return { key: c.key, bg: c.bg, accent: c.accent };
    })(),
  };
}
