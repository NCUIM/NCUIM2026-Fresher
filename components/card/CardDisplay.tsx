import type { CardView } from "@/lib/cards";

/**
 * 純呈現元件，無互動邏輯，因此不需要 "use client"。
 * 內容一律來自即時的 Profile，不是收集當下的快照。
 */
export function CardDisplay({
  card,
  tone = "neutral",
}: {
  card: CardView;
  /** flare 用於剛收集到的那一刻，其餘場合維持中性。 */
  tone?: "neutral" | "flare";
}) {
  const accent = tone === "flare" ? "flare" : "neon";

  return (
    <article
      className={`flex flex-col items-center gap-3 rounded-xl border surface p-5 ${
        tone === "flare"
          ? "border-flare/60 shadow-[inset_0_0_28px_rgba(255,46,99,0.12)]"
          : "border-line"
      }`}
    >
      {card.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.avatarUrl}
          alt=""
          className={`size-20 rounded-full border object-cover ${
            tone === "flare" ? "border-flare/70" : "border-line"
          }`}
        />
      ) : (
        <div
          className={`grid size-20 place-items-center rounded-full border bg-void text-2xl ${
            tone === "flare" ? "border-flare/70 text-flare" : "border-line text-dim"
          }`}
        >
          {card.nickname.slice(0, 1)}
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <h2 className="text-lg font-black">{card.nickname}</h2>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {card.role === "STAFF" && (
            <span className="px rounded-sm border border-moon px-2 py-0.5 text-[10px] text-moon">
              STAFF
            </span>
          )}
          {card.team && (
            <span
              className={`px rounded-sm border px-2 py-0.5 text-[10px] ${
                accent === "flare"
                  ? "border-flare text-flare"
                  : "border-neon text-neon"
              }`}
            >
              TEAM {String(card.team.number).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      {card.icons.length > 0 && (
        <div className="flex gap-2 text-2xl">
          {card.icons.map((icon) => (
            <span key={icon.key} title={icon.label}>
              {icon.emoji}
            </span>
          ))}
        </div>
      )}

      {/* 破冰用的話題線索——沒填的人就不佔版面 */}
      {(card.zodiac || card.university) && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-dim">
          {card.zodiac && (
            <span className="rounded-sm border border-line px-2 py-0.5">
              {card.zodiac.emoji} {card.zodiac.label}
            </span>
          )}
          {card.university && (
            <span className="rounded-sm border border-line px-2 py-0.5">
              {card.university}
            </span>
          )}
        </div>
      )}

      {card.bio && <p className="text-center text-sm text-dim">{card.bio}</p>}

      {card.socialUrl && (
        <a
          href={card.socialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target flex items-center text-sm text-neon underline"
        >
          查看社群連結
        </a>
      )}
    </article>
  );
}
