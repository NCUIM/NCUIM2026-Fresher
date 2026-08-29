# 操作手冊

從零啟動、開發、實機測試、活動當天到活動後的完整指令。

---

## 環境需求

| 項目 | 版本 | 備註 |
| --- | --- | --- |
| Node.js | 24+ | 需支援直接執行 `.mts` |
| Docker Desktop | — | 只用來跑 PostgreSQL，**必須在執行中** |
| ngrok 帳號 | 免費即可 | 只有實機測試相機時需要 |

---

## 一、第一次啟動

```bash
# 1. 安裝相依套件
npm install

# 2. 建立環境設定
cp .env.example .env
#    至少要有 DATABASE_URL，其餘可先留空

# 3. 啟動資料庫（Docker Desktop 要先開著）
npm run db:up

# 4. 建立資料表
npm run db:push

# 5. 寫入示範活動與管理員
npm run db:seed

# 6. 啟動
npm run dev
```

開 <http://localhost:3000>。

種子資料建立的內容：

| 項目 | 值 |
| --- | --- |
| 活動 | NCUIM 2026 新生歡迎會 |
| 通關碼 | `1234` |
| 一般報到碼 | `JOINNCU1` |
| 工作人員報到碼 | `STAFFNCU` |
| 管理員 | `admin` / `change-me` |
| 組別 | 10 組 |
| 成就 | 7 項 |

> **正式活動前務必改掉通關碼與管理員密碼**，兩者都能在 `/admin` 修改。

---

## 二、日常開發

```bash
npm run dev          # 開發伺服器（3000）
npm run build        # 正式建置，也用來檢查型別
npm run db:studio    # 網頁介面瀏覽與編輯資料庫
```

### 改了 `prisma/schema.prisma` 之後

```bash
npm run db:push      # 同步資料表
npm run db:generate  # 重新產生 Prisma client
# 然後 ⚠️ 必須重啟 dev server
```

**重啟這一步不能省。** `prisma generate` 不會影響已載入記憶體的程序，忘了重啟的症狀是
`Cannot read properties of undefined (reading 'findUnique')`——看起來像程式壞了，其實只是舊的 client。

---

## 三、測試

測試與彩排會**清空整張參與者表**，所以它們跑在獨立的 `ncuim_test` 資料庫上，
由獨立的伺服器（3001）提供服務。破壞性腳本會拒絕對開發資料庫執行。

```bash
# 只需做一次
npm run test:setup

# 每次要測時
npm run dev:test     # 測試伺服器（3001）
npm test             # 另開一個終端
npm run rehearsal    # 全流程彩排：報到 → 收集 → 封存
```

> ⚠️ **Next.js 不允許同一個專案目錄同時跑兩個 dev server。**
> `npm run dev`（3000）與 `npm run dev:test`（3001）**不能並存**，
> 要測試就得先停掉 3000。

---

## 四、用手機實機測試

**相機一定要 HTTPS。** 手機連 `http://192.168.x.x:3000` 屬於非安全來源，
瀏覽器會直接拒絕相機，掃描功能完全無法測試。

```bash
# .env 填入 NGROK_AUTHTOKEN（到 ngrok.com 註冊免費帳號取得）

npm run dev          # 終端 1
npm run tunnel       # 終端 2，指向 3000

# 從輸出中找出 url=https://xxxx.ngrok-free.app
```

用那個 **https 網址**在手機開啟。第一次會看到 ngrok 的攔截頁，點 **Visit Site** 通過。

測完關閉：

```bash
npm run tunnel:down
```

| 指令 | 指向 | 資料 |
| --- | --- | --- |
| `npm run tunnel` | 3000 | 保留 |
| `npm run tunnel:test` | 3001 | **會被測試清空** |

### 一定要測的環境

1. **Safari / Chrome** —— 確認基本流程
2. **LINE 或 Instagram 的內建瀏覽器** —— 把網址貼進聊天室再點進去

第 2 項最重要：那是新生實際會用的路徑，也是相機最可能失效的環境。
若相機不可用，畫面會顯示原因與「技術細節」，展開後有真正的錯誤名稱。

> ⚠️ **ngrok 免費版每次重啟都會換網址**，容器一重建舊網址就失效。

---

## 五、活動當天

### 事前準備

1. `/admin` → **活動設定** → 改掉通關碼
2. `/admin` → **管理員帳號** → 改掉 `change-me`
3. `/admin/codes` → 確認 QR 內容是**正式網址**後再列印

> QR 的內容取自你**開啟該頁時的網址**。用隧道網址印出來的碼，活動當天會是死碼。

### 現場

| 用途 | 網址 |
| --- | --- |
| 投影幕 | `/admin/display` —— 大 QR ＋ 大通關碼 ＋ 已報到人數 |
| 列印／存檔 | `/admin/codes` —— 含工作人員版 |
| 後台 | `/admin` —— 發公告、協助找回身分、移除違規內容 |

**工作人員版的報到碼請私下發給幹部**，不要投影或張貼。

### 有人弄丟身分

`/admin` → 參與者清單 → **協助找回身分** → 產生連結給本人在自己手機開啟。
舊連結會同時失效。

---

## 六、活動結束後

```bash
# 1. 於 /admin 按下「封存活動」
#    → 報到與收集關閉，查看功能保留 14 天

# 2. 十四天後，先預覽要刪什麼
npm run db:purge

# 3. 確認無誤才真的刪除
npm run db:purge -- --confirm
```

> ⚠️ **email 找回機制必須在活動後第七天前可用。**
> iOS 會在使用者連續七天未開啟網站後清除瀏覽器儲存，
> 沒有信箱的人在第 8～14 天將永久無法存取自己的成果。
> 這表示正式環境**一定要設定 SMTP**，否則信根本寄不出去。

---

## 七、正式環境必要的環境變數

| 變數 | 不設定的後果 |
| --- | --- |
| `DATABASE_URL` | 完全無法啟動 |
| `PUBLIC_ORIGIN` | 信件連結會依賴 Host 標頭，而那是客戶端可偽造的 |
| `SMTP_HOST` 等 | 驗證信與找回信不會寄出，14 天查看期形同虛設 |

---

## 八、疑難排解

### `ECONNREFUSED` / `Cannot read properties of undefined`

資料庫沒跑。**先確認 Docker Desktop 本身在執行**，不只是容器。

```bash
docker compose ps db     # 空的就是沒跑
npm run db:up
```

### `EADDRINUSE: address already in use :::3000`

那個埠被佔住了。

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  ForEach-Object { Get-Process -Id $_.OwningProcess }

Stop-Process -Id <PID> -Force
```

### `Another next dev server is already running`

同一個目錄只能跑一個 dev server。停掉另一個再開。

### 資料莫名消失

**不要用 `docker compose down`**——它會停掉專案裡的所有容器，不只你想關的那個。
`npm run db:down` 與 `npm run tunnel:down` 已經改成只針對單一服務。

若是在跑測試時消失，檢查是否誤用了開發資料庫——正常情況下守衛會擋下。

### 中文在資料庫裡變成亂碼

用 curl 手動測試時，Git Bash 在 Windows 上會把 `-d` 參數裡的中文轉成系統編碼。
改用檔案傳送：

```bash
curl -X POST ... --data-binary @payload.json
```

應用程式本身處理 UTF-8 完全正常。

### 手機掃不到 QR Code

依序確認：

1. 網址是 **https** 開頭（不是 `192.168.x.x`）
2. 有按下「開啟相機」並允許權限
3. 展開失敗畫面的「技術細節」看實際錯誤

---

## 指令總表

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 開發伺服器（3000） |
| `npm run build` | 正式建置＋型別檢查 |
| `npm start` | 執行建置後的正式版 |
| `npm run db:up` / `db:down` | 啟動／停止 PostgreSQL |
| `npm run db:push` | 同步資料表結構 |
| `npm run db:generate` | 重新產生 Prisma client |
| `npm run db:seed` | 寫入示範活動與管理員 |
| `npm run db:studio` | 瀏覽與編輯資料庫 |
| `npm run db:purge` | 刪除到期活動（需 `-- --confirm`） |
| `npm run db:reset-participants` | 清空測試資料庫的參與者 |
| `npm run test:setup` | 建立測試資料庫 |
| `npm run dev:test` | 測試伺服器（3001） |
| `npm test` | 執行測試 |
| `npm run smoke` | 煙霧測試 |
| `npm run rehearsal` | 全流程彩排 |
| `npm run tunnel` | HTTPS 隧道 → 3000 |
| `npm run tunnel:test` | HTTPS 隧道 → 3001 |
| `npm run tunnel:down` | 關閉隧道 |
