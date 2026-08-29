import type { CardView } from "@/lib/cards";

/**
 * 純呈現元件，無互動邏輯，因此不需要 "use client"。
 * 內容一律來自即時的 Profile，不是收集當下的快照。
 */
export function CardDisplay({
  card,
  tone = "neutral",
  eventName,
}: {
  card: CardView;
  /** flare 用於剛收集到的那一刻，其餘場合維持中性。 */
  tone?: "neutral" | "flare";
  /** 卡面上的場次標記。只有完整卡片需要，小格子放不下也不需要。 */
  eventName?: string;
}) {
  const accent = tone === "flare" ? "flare" : "neon";

  return (
    <article
      /*
        底色與邊框來自卡片主人的選擇，不是看的人的介面主題——
        那是他對外呈現的一部分，跟暱稱和圖示一樣。
        剛收集到的那一刻例外，用洋紅強調「這是新的」。
      */
      style={
        tone === "flare"
          ? undefined
          : { backgroundColor: card.color.bg, borderColor: card.color.accent }
      }
      className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 ${
        tone === "flare"
          ? "border-flare/60 surface shadow-[inset_0_0_28px_rgba(255,46,99,0.12)]"
          : ""
      }`}
    >
      {/* 場次標記。卡片離開活動之後仍看得出它來自哪一場。 */}
      {eventName && (
        <p className="px w-full text-center text-[10px] tracking-[0.2em] text-faint">
          {eventName}
        </p>
      )}

      {/*
        方框而非圓形。卡片的重點是「這是一張卡」，方形的圖框讓它更像
        收藏品而不是通訊錄裡的一列聯絡人；白底也讓深色頭像不會糊進背景。
      */}
      <div
        style={tone === "flare" ? undefined : { borderColor: card.color.accent }}
        className={`w-full max-w-[220px] rounded-sm border-2 bg-white p-2 ${
          tone === "flare" ? "border-flare" : ""
        }`}
      >
        {card.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.avatarUrl}
            alt=""
            className="aspect-square w-full rounded-sm object-cover"
          />
        ) : (
          <div className="grid aspect-square w-full place-items-center rounded-sm bg-slate text-5xl font-black text-faint">
            {card.nickname.slice(0, 1)}
          </div>
        )}
      </div>

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
