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

const field =
  "rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint";

export function JoinForm({ entryCode, eventName, roleLabel }: Props) {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [bio, setBio] = useState("");
  const [icons, setIcons] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleIcon(key: string) {
    setIcons((current) => {
      if (current.includes(key)) return current.filter((k) => k !== key);
      if (current.length >= REQUIRED_ICON_COUNT) return current;
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
      <header className="flex flex-col gap-1.5">
        <span className="px text-glow-neon text-[11px] tracking-[0.22em] text-neon">
          CHECK IN
        </span>
        <h1 className="text-2xl font-black">{eventName}</h1>
        {roleLabel && (
          <span className="px self-start rounded-sm border border-moon px-2 py-0.5 text-[10px] text-moon">
            {roleLabel}
          </span>
        )}
      </header>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">活動通關碼</span>
        <span className="text-xs text-faint">請輸入現場公布的通關碼</span>
        <input
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          required
          className={`px ${field}`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">暱稱</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX}
          required
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">
          電子信箱 <span className="text-faint">（選填，但強烈建議）</span>
        </span>
        <span className="text-xs text-faint">
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
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold">
          社群連結 <span className="text-faint">（選填）</span>
        </span>
        <span className="text-xs text-faint">https 開頭，例如你的 Instagram</span>
        <input
          value={socialUrl}
          onChange={(e) => setSocialUrl(e.target.value)}
          inputMode="url"
          autoCapitalize="none"
          placeholder="https://instagram.com/..."
          className={field}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm font-bold">
          <span>
            一句話自我介紹 <span className="text-faint">（選填）</span>
          </span>
          <span className="px text-xs font-normal text-faint">
            {bio.length}/{BIO_MAX}
          </span>
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          rows={2}
          className={`resize-none ${field}`}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="flex w-full items-center justify-between text-sm font-bold">
          <span>選 {REQUIRED_ICON_COUNT} 個代表你的圖示</span>
          <span
            className={`px text-xs font-normal ${iconsComplete ? "text-neon" : "text-faint"}`}
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
                className={`tap-target flex flex-col items-center gap-0.5 rounded-sm border py-2 transition-colors ${
                  selected
                    ? "border-neon bg-neon/10 text-neon"
                    : disabled
                      ? "border-line/50 text-faint"
                      : "border-line text-dim"
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
        <p role="alert" className="rounded-lg bg-flare/15 px-3 py-2 text-sm text-flare">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !iconsComplete}
        className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
      >
        {submitting ? "報到中…" : "完成報到"}
      </button>
    </form>
  );
}
