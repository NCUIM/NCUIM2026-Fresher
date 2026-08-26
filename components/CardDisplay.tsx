import type { CardView } from "@/lib/cards";

/**
 * 純呈現元件，無互動邏輯，因此不需要 "use client"。
 * 內容一律來自即時的 Profile，不是收集當下的快照。
 */
export function CardDisplay({ card }: { card: CardView }) {
  return (
    <article className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 p-5">
      {card.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.avatarUrl}
          alt=""
          className="size-20 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-20 items-center justify-center rounded-full bg-gray-100 text-2xl text-gray-400">
          {card.nickname.slice(0, 1)}
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <h2 className="text-lg font-bold">{card.nickname}</h2>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {card.role === "STAFF" && (
            <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-medium text-white">
              工作人員
            </span>
          )}
          {card.team && (
            <span className="rounded-full bg-gray-900 px-2.5 py-0.5 text-xs text-white">
              {card.team.name ?? `第 ${card.team.number} 組`}
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

      {card.bio && (
        <p className="text-center text-sm text-gray-600">{card.bio}</p>
      )}

      {card.socialUrl && (
        <a
          href={card.socialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="tap-target flex items-center text-sm text-blue-600 underline"
        >
          查看社群連結
        </a>
      )}
    </article>
  );
}
