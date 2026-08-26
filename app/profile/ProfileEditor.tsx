"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ICON_LIBRARY, REQUIRED_ICON_COUNT } from "@/lib/icons";
import { resizeToAvatar } from "@/lib/resize-image";
import { BIO_MAX, NICKNAME_MAX } from "@/lib/validation";

type Props = {
  initial: {
    nickname: string;
    bio: string | null;
    socialUrl: string | null;
    icons: string[];
    avatarUrl: string | null;
    email: string | null;
    emailVerified: boolean;
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
          bio: bio.trim() || null,
          socialUrl: socialUrl.trim() || null,
          email: email.trim() || null,
          icons,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "儲存失敗");
        return;
      }
      setNotice("已儲存。收集過你的人會立刻看到更新後的卡片。");
      router.refresh();
    } catch {
      setError("連線失敗，請確認網路");
    } finally {
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
          <div className="flex size-24 items-center justify-center rounded-full bg-gray-100 text-3xl text-gray-400">
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
            className="tap-target rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:text-gray-300"
          >
            {uploading ? "處理中…" : avatarUrl ? "換一張" : "上傳頭像"}
          </button>
          {avatarUrl && (
            <button
              onClick={removeAvatar}
              disabled={uploading}
              className="tap-target rounded-lg px-4 text-sm text-gray-500"
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
          className="rounded-lg border border-gray-300 px-3 py-2.5"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">電子信箱</span>
          <span className="text-xs text-gray-500">
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
            className="rounded-lg border border-gray-300 px-3 py-2.5"
          />
        </label>

        {showUnverified && (
          <div className="flex flex-col gap-1.5 rounded-lg bg-amber-50 px-3 py-2.5">
            <p className="text-sm text-amber-900">
              這個信箱還沒驗證，目前無法用來找回身分。
            </p>
            <button
              type="button"
              onClick={resendVerification}
              disabled={resending}
              className="self-start text-sm text-amber-900 underline disabled:text-amber-400"
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
          className="rounded-lg border border-gray-300 px-3 py-2.5"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between text-sm font-medium">
          一句話自我介紹
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
      {notice && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          {notice}
        </p>
      )}

      <button
        onClick={save}
        disabled={saving || !iconsComplete || !nickname.trim()}
        className="tap-target sticky bottom-[var(--safe-bottom)] rounded-lg bg-gray-900 py-3 font-medium text-white disabled:bg-gray-300"
      >
        {saving ? "儲存中…" : "儲存"}
      </button>
    </div>
  );
}
