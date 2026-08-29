"use client";

import { useEffect, useRef } from "react";
import { markAnnouncementsRead } from "@/app/announcements/actions";

/**
 * 掛載後把公告標記為已讀。
 *
 * 刻意在客戶端觸發而不是在頁面渲染時直接做：標記已讀要連帶讓其他頁面的
 * 未讀徽章失效，而 revalidatePath 不能在渲染過程中呼叫。
 *
 * 這也保住了原本的行為——本次進來仍看得到未讀樣式，因為頁面內容在
 * 這個動作跑之前就已經產生了。
 */
export function MarkAnnouncementsRead() {
  const done = useRef(false);

  useEffect(() => {
    // React 在開發模式會跑兩次 effect，標記已讀是冪等的，但沒必要打兩次。
    if (done.current) return;
    done.current = true;
    void markAnnouncementsRead();
  }, []);

  return null;
}
