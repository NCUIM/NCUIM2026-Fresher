"use client";

import { useState } from "react";
import { ICON_LIBRARY, REQUIRED_ICON_COUNT } from "@/lib/icons";
import { BIO_MAX, NICKNAME_MAX } from "@/lib/validation";
import { UniversityField, ZodiacField } from "./ProfileFields";

type Props = {
  entryCode: string;
  eventName: string;
  roleLabel: string | null;
};

const field =
  "rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint";

/**
 * 報到表單，分兩步。
 *
 * 先前八個欄位一次攤開，在報到人潮中很容易讓人放棄。
 * 第一步只放「沒有就無法進場」的四項，第二步才是能讓別人認識你的資料，
 * 而且可以跳過——之後在個人資料頁隨時能補。
 *
 * 信箱放在第二步的最上面並說明理由：它不是必要條件，
 * 但沒填的人日後換裝置就再也找不回自己的收集成果。
 */
export function JoinForm({ entryCode, eventName, roleLabel }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  const [passcode, setPasscode] = useState("");
  const [nickname, setNickname] = useState("");
  const [icons, setIcons] = useState<string[]>([]);

  const [email, setEmail] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [zodiac, setZodiac] = useState("");
  const [university, setUniversity] = useState("");
  const [bio, setBio] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function toggleIcon(key: string) {
    setIcons((current) => {
      if (current.includes(key)) return current.filter((k) => k !== key);
      if (current.length >= REQUIRED_ICON_COUNT) return current;
      return [...current, key];
    });
  }

  const iconsComplete = icons.length === REQUIRED_ICON_COUNT;
  const step1Ready =
    passcode.trim() !== "" &&
    nickname.trim() !== "" &&
    bio.trim() !== "" &&
    iconsComplete;

  async function submit() {
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
          bio: bio.trim(),
          email: email.trim() || null,
          zodiac: zodiac || null,
          university: university.trim() || null,
          icons,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "報到失敗，請再試一次");
        setSubmitting(false);
        // 通關碼錯誤要回第一步，否則使用者看不到出錯的欄位。
        if (res.status === 403) setStep(1);
        return;
      }

      /*
        報到成功後用完整頁面導向，不用 router.push。

        這一步剛好是身分 cookie 從無到有的瞬間，而 App Router 的
        Client Cache 可能仍持有「還沒有身分」時的 /me 版本——
        文件明講 cookies 會改變回應內容。客戶端導向在這裡會靜默失敗：
        使用者停在表單上，看不到任何成功或失敗的訊息，於是重複送出。
        （實際發生過，同一個人連續報到三次。）
      */
      setDone(true);
      window.location.assign("/me");
    } catch {
      setError("連線失敗，請確認網路後再試一次");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
        <span className="px text-glow-neon text-[11px] tracking-[0.22em] text-neon">
          CHECKED IN
        </span>
        <h1 className="text-2xl font-black">報到成功</h1>
        <p className="text-sm text-dim">正在帶你進入活動…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="px text-glow-neon text-[11px] tracking-[0.22em] text-neon">
            CHECK IN
          </span>
          <span className="px text-[11px] text-faint">步驟 {step} / 2</span>
        </div>
        <h1 className="text-2xl font-black">{eventName}</h1>
        {roleLabel && (
          <span className="px self-start rounded-sm border border-moon px-2 py-0.5 text-[10px] text-moon">
            {roleLabel}
          </span>
        )}
        {/* 進度條：兩步很短，但看得到進度才知道快結束了 */}
        <div className="mt-1 flex gap-1.5" aria-hidden="true">
          <span className="h-0.5 flex-1 rounded-full bg-neon" />
          <span
            className={`h-0.5 flex-1 rounded-full ${step === 2 ? "bg-neon" : "bg-line"}`}
          />
        </div>
      </header>

      {step === 1 ? (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">活動通關碼</span>
            <span className="text-xs text-faint">請輸入現場公布的通關碼</span>
            <input
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              className={`px ${field}`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">暱稱</span>
            <span className="text-xs text-faint">別人收集到你時看到的名字</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={NICKNAME_MAX}
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-sm font-bold">
              <span>一句話自我介紹</span>
              <span className="px text-xs font-normal text-faint">
                {bio.length}/{BIO_MAX}
              </span>
            </span>
            <span className="text-xs text-faint">
              卡片上最能讓人搭話的一句。例如：喜歡爬山跟做甜點
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
            <p
              role="alert"
              aria-live="assertive"
              className="flex flex-col gap-1 rounded-lg border border-flare/50 bg-flare/15 px-4 py-3 text-sm text-flare"
            >
              <span className="font-bold">報到失敗</span>
              <span className="text-flare/85">{error}</span>
            </p>
          )}

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!step1Ready}
            className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
          >
            下一步
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 rounded-xl border border-moon/40 bg-moon/10 px-4 py-3">
            <span className="text-sm font-bold text-moon">
              強烈建議填寫信箱
            </span>
            <span className="text-xs text-moon/80">
              手機出狀況或瀏覽器資料被清除時，這是你唯一能自己找回收集成果的方法。
            </span>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">電子信箱</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@example.com"
              autoFocus
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">社群連結</span>
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

          <div className="grid grid-cols-2 gap-3">
            <ZodiacField value={zodiac} onChange={setZodiac} />
            <UniversityField value={university} onChange={setUniversity} />
          </div>

          {error && (
            <p
              role="alert"
              aria-live="assertive"
              className="flex flex-col gap-1 rounded-lg border border-flare/50 bg-flare/15 px-4 py-3 text-sm text-flare"
            >
              <span className="font-bold">報到失敗</span>
              <span className="text-flare/85">{error}</span>
            </p>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="tap-target glow-neon rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
            >
              {submitting ? "報到中…" : "完成報到"}
            </button>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="tap-target flex items-center text-sm text-faint"
              >
                ← 上一步
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="tap-target flex items-center text-sm text-faint underline"
              >
                先跳過，之後再填
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
