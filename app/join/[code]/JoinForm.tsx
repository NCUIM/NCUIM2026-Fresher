"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ICON_LIBRARY, REQUIRED_ICON_COUNT } from "@/lib/icons";
import { BIO_MAX, NICKNAME_MAX } from "@/lib/validation";

type Props = {
  entryCode: string;
  eventName: string;
  roleLabel: string | null;
};

export function JoinForm({ entryCode, eventName, roleLabel }: Props) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [icons, setIcons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleIcon(key: string) {
    setIcons((current) => {
      if (current.includes(key)) return current.filter((k) => k !== key);
      if (current.length >= REQUIRED_ICON_COUNT) return current; // 已滿，忽略
      return [...current, key];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryCode,
          passcode,
          nickname,
          socialUrl: socialUrl.trim() || null,
          bio: bio.trim() || null,
          email: email.trim() || null,
          icons,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "報到失敗，請再試一次");
        return;
      }
      router.push("/me");
    } catch {
      setError("連線失敗，請確認網路後再試一次");
    } finally {
      setSubmitting(false);
    }
  }

  const iconsComplete = icons.length === REQUIRED_ICON_COUNT;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">{eventName}</h1>
        {roleLabel && (
          <span className="self-start rounded-full bg-gray-900 px-3 py-1 text-xs text-white">
            {roleLabel}
          </span>
        )}
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">活動通關碼</span>
        <span className="text-xs text-gray-500">請輸入現場公布的通關碼</span>
        <input
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          required
          className="rounded-lg border border-gray-300 px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">暱稱</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX}
          required
          className="rounded-lg border border-gray-300 px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          電子信箱 <span className="text-gray-400">（選填，但強烈建議）</span>
        </span>
        <span className="text-xs text-gray-500">
          手機出狀況或瀏覽器資料被清除時，這是你唯一能自己找回收集成果的方法
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          placeholder="you@example.com"
          className="rounded-lg border border-gray-300 px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          社群連結 <span className="text-gray-400">（選填）</span>
        </span>
        <span className="text-xs text-gray-500">https 開頭，例如你的 Instagram</span>
        <input
          value={socialUrl}
          onChange={(e) => setSocialUrl(e.target.value)}
          inputMode="url"
          autoCapitalize="none"
          placeholder="https://instagram.com/..."
          className="rounded-lg border border-gray-300 px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm font-medium">
          一句話自我介紹 <span className="text-gray-400">（選填）</span>
          <span className="text-xs font-normal text-gray-400">
            {bio.length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          rows={2}
          className="resize-none rounded-lg border border-gray-300 px-3 py-2.5"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="flex w-full items-center justify-between text-sm font-medium">
          <span>選 {REQUIRED_ICON_COUNT} 個代表你的圖示</span>
          <span
            className={`text-xs font-normal ${iconsComplete ? "text-green-600" : "text-gray-400"}`}
          >
            {icons.length}/{REQUIRED_ICON_COUNT}
          </span>
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {ICON_LIBRARY.map((icon) => {
            const selected = icons.includes(icon.key);
            const disabled = !selected && iconsComplete;
            return (
              <button
                key={icon.key}
                type="button"
                onClick={() => toggleIcon(icon.key)}
                aria-pressed={selected}
                className={`tap-target flex flex-col items-center gap-0.5 rounded-lg border py-2 transition ${
                  selected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : disabled
                      ? "border-gray-200 text-gray-300"
                      : "border-gray-300"
                }`}
              >
                <span className="text-xl">{icon.emoji}</span>
                <span className="text-[10px]">{icon.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !iconsComplete}
        className="tap-target rounded-lg bg-gray-900 py-3 font-medium text-white disabled:bg-gray-300"
      >
        {submitting ? "報到中…" : "完成報到"}
      </button>
    </form>
  );
}
