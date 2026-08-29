"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ICON_LIBRARY, REQUIRED_ICON_COUNT } from "@/lib/icons";
import { resizeToAvatar } from "@/lib/resize-image";
import { BIO_MAX, NICKNAME_MAX } from "@/lib/validation";
import { UniversityField, ZodiacField } from "./ProfileFields";

type Props = {
  initial: {
    nickname: string;
    bio: string | null;
    socialUrl: string | null;
    icons: string[];
    avatarUrl: string | null;
    email: string | null;
    emailVerified: boolean;
    zodiac: string | null;
    university: string | null;
  };
};

export function ProfileEditor({ initial }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(initial.nickname);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [socialUrl, setSocialUrl] = useState(initial.socialUrl ?? "");
  const [icons, setIcons] = useState<string[]>(initial.icons);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [email, setEmail] = useState(initial.email ?? "");
  const [zodiac, setZodiac] = useState(initial.zodiac ?? "");
  const [university, setUniversity] = useState(initial.university ?? "");
  const [resending, setResending] = useState(false);

  const emailUnchanged = (email.trim() || null) === initial.email;
  const showUnverified = Boolean(initial.email) && !initial.emailVerified && emailUnchanged;

  async function resendVerification() {
    setResending(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/verify/resend", { method: "POST" });
      setNotice(res.ok ? "驗證信已重新寄出" : "重寄失敗，請稍後再試");
    } finally {
      setResending(false);
    }
  }

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // 導向需要一點時間，這段期間按鈕要維持在「已儲存」狀態，
  // 否則使用者會以為沒反應而重複按。
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggleIcon(key: string) {
    setIcons((current) => {
      if (current.includes(key)) return current.filter((k) => k !== key);
      if (current.length >= REQUIRED_ICON_COUNT) return current;
      return [...current, key];
    });
  }

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const resized = await resizeToAvatar(file);
      const form = new FormData();
      form.append("file", resized, "avatar.jpg");

      const res = await fetch("/api/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "上傳失敗");
        return;
      }
      setAvatarUrl(data.avatarUrl);
      setNotice("頭像已更新");
      router.refresh();
    } catch {
      setError("圖片處理失敗，請換一張試試");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    try {
      await fetch("/api/avatar", { method: "DELETE" });
      setAvatarUrl(null);
      router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          bio: bio.trim(),
          socialUrl: socialUrl.trim() || null,
          email: email.trim() || null,
          zodiac: zodiac || null,
          university: university.trim() || null,
          icons,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "儲存失敗");
        setSaving(false);
        return;
      }

      /*
        存檔後回到個人頁。
        push 之後緊接 refresh：/me 是伺服器元件，若沿用客戶端快取裡的
        版本，使用者會回到一個仍顯示舊資料的畫面，看起來像沒存成功。
        refresh 讓它重新向伺服器要一次。
      */
      setSaved(true);
      router.push("/me");
      router.refresh();
    } catch {
      setError("連線失敗，請確認網路");
      setSaving(false);
    }
  }

  const iconsComplete = icons.length === REQUIRED_ICON_COUNT;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="你的頭像"
            className="size-24 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full bg-slate text-3xl text-faint">
            {nickname.slice(0, 1) || "?"}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />

        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="tap-target rounded-lg border border-line px-4 text-sm font-medium disabled:text-faint"
          >
            {uploading ? "處理中…" : avatarUrl ? "換一張" : "上傳頭像"}
          </button>
          {avatarUrl && (
            <button
              onClick={removeAvatar}
              disabled={uploading}
              className="tap-target rounded-lg px-4 text-sm text-dim"
            >
              移除
            </button>
          )}
        </div>
      </section>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">暱稱</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={NICKNAME_MAX}
          className="rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">電子信箱</span>
          <span className="text-xs text-dim">
            用來在換裝置或瀏覽器資料被清除時找回收集成果
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
          />
        </label>

        {showUnverified && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-moon/10 px-3 py-2.5">
            <p className="text-sm text-moon">
              這個信箱還沒驗證，目前無法用來找回身分。
            </p>
            <button
              type="button"
              onClick={resendVerification}
              disabled={resending}
              className="self-start text-sm text-moon underline disabled:text-moon/50"
            >
              {resending ? "寄送中…" : "重新寄送驗證信"}
            </button>
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">社群連結</span>
        <input
          value={socialUrl}
          onChange={(e) => setSocialUrl(e.target.value)}
          inputMode="url"
          autoCapitalize="none"
          placeholder="https://instagram.com/..."
          className="rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <ZodiacField value={zodiac} onChange={setZodiac} />
        <UniversityField value={university} onChange={setUniversity} />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm font-medium">
          一句話自我介紹
          <span className="text-xs font-normal text-faint">
            {bio.length}/{BIO_MAX}
          </span>
        </span>
        <span className="text-xs text-faint">
          卡片上最能讓人搭話的一句，不能留空
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          rows={2}
          placeholder="例如：喜歡爬山跟做甜點"
          className="resize-none rounded-sm border border-line bg-void px-3 py-2.5 text-chalk placeholder:text-faint"
        />
        {!bio.trim() && (
          <span className="text-xs text-moon">
            這是必填欄位。既有的參與者若還沒填，儲存前需要補上。
          </span>
        )}
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="flex w-full items-center justify-between text-sm font-medium">
          <span>代表你的 {REQUIRED_ICON_COUNT} 個圖示</span>
          <span
            className={`text-xs font-normal ${iconsComplete ? "text-green-600" : "text-amber-600"}`}
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
                className={`tap-target flex flex-col items-center gap-0.5 rounded-lg border py-2 ${
                  selected
                    ? "border-neon bg-neon/10 text-neon"
                    : disabled
                      ? "border-line text-faint"
                      : "border-line"
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
      {notice && (
        <p className="rounded-lg bg-neon/10 px-3 py-2 text-sm text-neon">
          {notice}
        </p>
      )}

      <button
        onClick={save}
        disabled={saved || saving || !iconsComplete || !nickname.trim() || !bio.trim()}
        className="tap-target glow-neon sticky bottom-[var(--safe-bottom)] rounded-sm bg-neon py-3 font-bold text-void disabled:bg-line disabled:text-faint disabled:shadow-none"
      >
        {saved ? "已儲存，返回中…" : saving ? "儲存中…" : "儲存"}
      </button>
    </div>
  );
}
