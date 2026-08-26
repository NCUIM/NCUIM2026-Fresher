---
status: accepted
---

# 技術棧：Next.js + PostgreSQL，本地開發後部署至 GCP

採用 Next.js（App Router）搭配 TypeScript，資料庫為 PostgreSQL（透過 Prisma 存取），頭像圖片存於物件儲存。開發階段在本地完成，最後部署至 GCP Cloud Run。

決定的主要依據是**五天的開發期**與**團隊熟悉 JavaScript/TypeScript**。在這個前提下，減少需要整合與學習的零件數量，比任何技術優劣比較都重要。

## Considered Options

- **Firestore 等文件資料庫**：不需要 schema 遷移，初期迭代快。但本領域是明確的關聯式資料——Participant、Scan、Collection、Team、Achievement 之間全是關聯查詢，而 Leaderboard 排序與 Achievement 追溯重算都需要跨表聚合。文件資料庫在這些操作上會處處受限。
- **前後端分離的兩個專案**：架構上更清晰，但五天內光是介接與各自部署就會吃掉可觀的時間。Next.js 讓 API 與頁面共用同一份型別定義與同一次部署。
- **Vercel 部署**：上線最快、設定幾乎為零。最終選擇 GCP 是為了使用既有額度；若部署設定耗時超出預期，改回 Vercel 是低成本的退路。

## Consequences

**手機測試必須透過 HTTPS 通道。** 瀏覽器的 `getUserMedia` 僅在安全來源下可用：`localhost` 屬於安全來源，因此電腦上的開發不受影響；但以手機連線至區域網路位址（如 `http://192.168.x.x:3000`）時**不是**安全來源，相機會被拒絕，而掃描 QR Code 正是本專案的核心功能。

開發環境從第一天就應備妥 `cloudflared tunnel` 或 `ngrok` 之類的 HTTPS 通道用於實機測試。這件事若拖到後期才發現，會在時間最緊迫時造成阻塞。

**不需要即時推播基礎設施。** Leaderboard 採定時輪詢更新，系統中沒有任何需要長連線的功能。這排除了 WebSocket 相關的整套複雜度，是選型時可以直接忽略的一個維度。

**規模不影響選型。** 單場約七十人，任何方案都遠在免費或最低方案的容量之內。GCP 額度不會構成限制，也因此不值得為了「用完額度」而增加部署複雜度。

**目標瀏覽器包含 App 內建瀏覽器。** 除 iOS Safari 與 Android Chrome 外，必須實測 LINE 與 Instagram 的內建瀏覽器——相當比例的使用者會從社群連結進入。相機在這些環境中的行為需個別驗證，並確保原生相機備援路徑可用。

## 補充：頭像存於資料庫，不使用物件儲存

本文件原先提及以 GCP Cloud Storage 存放頭像。實作時改為存進 PostgreSQL，主要理由不是省下設定工作，而是**保留期的正確性**：

十四天到期時我們刪除 Participant，外鍵 cascade 會連同影像一併清除。若放在外部物件儲存，就必須另外維護一套清除程序，而任何漏刪的頭像都是殘留在系統中的個人資料——這與 ADR-0001 的資料生命週期承諾直接衝突。

規模上也完全站得住腳：前端會先把照片縮到 400px 的 JPEG，通常在 50KB 上下，七十人合計不到 4MB。影像另存 `Avatar` 表而非 `Participant` 的欄位，避免參與者清單、收集清單這類查詢每次都把二進位資料一起撈出來。

若日後規模成長到需要 CDN，替換的範圍僅限於存取影像的那一層。
