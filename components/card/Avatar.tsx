"use client";

import { useState } from "react";

/**
 * 頭像，載入失敗時退回暱稱首字。
 *
 * 全站原本每一處都直接寫 `<img src={avatarUrl}>`，沒有任何一處處理載入失敗。
 * 而這些網址有三種會壞掉的方式：
 *   1. 上傳的頭像被 Admin 清除違規內容刪掉，但別人手上的卡片還指著它
 *   2. 預設頭像的檔案被改名或移除
 *   3. 單純的網路中斷
 * 任何一種都會在卡片正中央留下一個破圖圖示，而卡片是這個活動的主體。
 *
 * 退回首字而不是留白：那個圓圈本來就佔著版面，空著會讓卡片看起來壞掉，
 * 而首字至少還能辨識是誰。
 */
export function Avatar({
  src,
  nickname,
  className,
  rounded = "rounded-full",
}: {
  src: string | null;
  nickname: string;
  /** 尺寸類別，例如 size-20 或 aspect-square w-full。 */
  className: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={`${className} ${rounded} grid shrink-0 place-items-center bg-slate font-black text-faint`}
        aria-hidden="true"
      >
        {nickname.slice(0, 1)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} ${rounded} shrink-0 object-cover`}
    />
  );
}
