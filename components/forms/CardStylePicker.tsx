"use client";

import { AVATAR_SETS, presetAvatarPath } from "@/lib/avatars";
import { CARD_COLORS } from "@/lib/card-colors";

/**
 * 頭像與底色的選擇器。報到與個人資料共用同一份，
 * 兩邊的選項才不會走鐘——這正是先前星座與大學抽成共用元件的理由。
 */
export function CardStylePicker({
  avatar,
  onAvatarChange,
  color,
  onColorChange,
  allowClear = false,
}: {
  avatar: string | null;
  onAvatarChange: (path: string | null) => void;
  color: string;
  onColorChange: (key: string) => void;
  /** 個人資料頁可以清掉頭像；報到時本來就是空的，不需要這顆按鈕。 */
  allowClear?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="flex w-full items-center justify-between text-sm font-bold">
          <span>卡片底色</span>
        </legend>
        <span className="text-xs text-faint">
          別人收集到你時，看到的就是這個顏色。
        </span>
        <div className="flex flex-wrap gap-2">
          {CARD_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onColorChange(c.key)}
              aria-pressed={color === c.key}
              aria-label={c.label}
              title={c.label}
              style={{ backgroundColor: c.bg, borderColor: c.accent }}
              className={`tap-target size-11 rounded-sm border-2 transition-transform ${
                color === c.key ? "scale-110 ring-2 ring-chalk" : ""
              }`}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="flex w-full items-center justify-between text-sm font-bold">
          <span>頭像</span>
          {allowClear && avatar && (
            <button
              type="button"
              onClick={() => onAvatarChange(null)}
              className="text-xs font-normal text-faint underline"
            >
              不使用
            </button>
          )}
        </legend>

        {AVATAR_SETS.map((set) => (
          <div key={set.key} className="flex flex-col gap-1.5">
            <span className="text-xs text-faint">{set.label}</span>
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {Array.from({ length: set.count }, (_, i) => {
                const path = presetAvatarPath(set.key, i + 1);
                const picked = avatar === path;
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => onAvatarChange(path)}
                    aria-pressed={picked}
                    aria-label={`${set.label} ${i + 1}`}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition-colors ${
                      picked ? "border-neon" : "border-line"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={path}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
