"use client";

import { UNIVERSITY_MAX, ZODIAC_SIGNS } from "@/lib/zodiac";

const field =
  "rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint";

/**
 * 星座與大學。報到表單與個人資料編輯共用同一份——
 * 兩處分開寫的話，加欄位或改文案時很容易只改到一邊。
 */
export function ZodiacField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold">
        星座 <span className="text-faint">（選填）</span>
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${field} appearance-none`}
      >
        <option value="">不選擇</option>
        {ZODIAC_SIGNS.map((z) => (
          <option key={z.key} value={z.key}>
            {z.emoji} {z.label}（{z.range}）
          </option>
        ))}
      </select>
    </label>
  );
}

export function UniversityField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-sm font-bold">
        <span>
          大學 <span className="text-faint">（選填）</span>
        </span>
        <span className="px text-xs font-normal text-faint">
          {value.length}/{UNIVERSITY_MAX}
        </span>
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, UNIVERSITY_MAX))}
        placeholder="例如：國立中央大學"
        className={field}
      />
    </label>
  );
}
