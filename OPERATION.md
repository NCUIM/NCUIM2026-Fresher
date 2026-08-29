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

若 `db:push` 要求 `--accept-data-loss`，**先看它列出的是哪一項再決定**。
新增唯一鍵一定會觸發這個警告，因為 Prisma 無從得知現有資料有沒有重複；
這種情況加上旗標不會刪掉任何東西，有重複時它會直接失敗。
但同一個旗標也會放行真正的刪除（移除欄位、改型別），所以不能養成一律附加的習慣。

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
3. 進入該場後台 → **報到 QR Code** → 確認 QR 內容是**正式網址**後再列印

> QR 的內容取自你**開啟該頁時的網址**。用隧道網址印出來的碼，活動當天會是死碼。

### 現場

後台分兩層。**活動寫在網址裡**，所以連結可以直接傳給另一位工作人員，
兩個分頁也能各自開著不同場次：

| 用途 | 網址 |
| --- | --- |
| 總管理後台 | `/admin` —— 所有活動、建立活動、指派主持人、管理員帳號（**僅總管理員**） |
| 選擇活動 | `/admin/events` —— 主持人只看得到被指派的場次 |
| 該場後台 | `/admin/events/<id>` —— 發公告、協助找回身分、移除違規內容 |
| 投影幕 | `/admin/events/<id>/display` —— 大 QR ＋ 大通關碼 ＋ 已報到人數 |
| 列印／存檔 | `/admin/events/<id>/codes` —— 含工作人員版 |
| 系統紀錄 | `/admin/events/<id>/logs` —— 寄信結果與失敗原因 |

> 網址上的 `<id>` 不是祕密，知道它也進不去——每個請求都會檢查你有沒有那場的權限，
> 沒有權限一律回「找不到」。**列印前請先核對網址列上的活動**，那是唯一不可逆的操作。

**報到期間請不時看一下 `/admin` 上的「系統紀錄」入口。** 有信寄不出去時它會變紅並顯示數量。

寄信刻意不阻斷報到（SMTP 掛掉不該讓人卡在報到），代價是**失敗在現場完全無聲**——
使用者照常完成報到、看到成功畫面，信卻不會到。而收不到驗證信的人無法用信箱找回身分，
活動後第 7 天 iOS 清除瀏覽器儲存，他們就永久失去自己的收集成果。

紀錄分三種狀態：`已寄出`、`失敗`（附服務商錯誤碼）、`未寄出`（**沒有設定 SMTP**）。
看到大量「未寄出」代表環境變數沒設好，不是寄信服務出問題。

**工作人員版的報到碼請私下發給幹部**，不要投影或張貼。

### 有人弄丟身分

`/admin` → 參與者清單 → **協助找回身分** → 產生連結給本人在自己手機開啟。
舊連結會同時失效。

清單上每個人的暱稱旁邊會顯示**姓名**——現場核對身分靠的是這個，不是暱稱。

### 有人說「這個信箱已經報到過了」

一個信箱在同一場活動只能報到一次。會撞到這個訊息的人**通常就是本人**：
他換了手機、或清掉了瀏覽器資料，於是想重新報到一次。

不要叫他改用別的信箱——那會產生第二個身分，原本的收集成果就找不回來了。
正確做法是用上面的**協助找回身分**把他接回原本的紀錄。

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

### 用 Gmail 寄信

在 `.env` 填入：

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="you@gmail.com"
SMTP_PASSWORD="十六碼應用程式密碼"
SMTP_FROM="NCUIM 新生歡迎會 <you@gmail.com>"
```

填完後驗證（**不要靠報到流程來測**，中間任何一步出錯都會被誤判成寄信壞了）：

```bash
npm run mail:test -- 你的信箱@gmail.com
```

三個容易卡住的地方：

1. **`SMTP_PASSWORD` 不是 Google 登入密碼**，是[應用程式密碼](https://myaccount.google.com/apppasswords)。
   帳戶要先開啟兩步驟驗證才看得到這個功能。用登入密碼會得到 `535`。
2. **`SMTP_FROM` 的信箱必須與 `SMTP_USER` 相同。** Gmail 會改寫或退回不一致的
   寄件者，症狀是信看似寄出、實際被擋。
3. **埠與加密要配對**：`587` 搭 `SMTP_SECURE="false"`、`465` 搭 `"true"`。
   交叉設定不會報錯，會卡住直到連線逾時。

> 免費 Gmail 每天約 500 封上限。七十人的活動用不到，但每次重寄驗證信都算一封。
>
> 從個人 Gmail 寄的信容易進垃圾郵件匣。**測試時務必連垃圾郵件匣一起看**，
> 活動當天也要在說明時提醒新生。

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
| `npm run mail:test -- <信箱>` | 寄一封測試信，驗證 SMTP 設定 |
| `npm run tunnel` | HTTPS 隧道 → 3000 |
| `npm run tunnel:test` | HTTPS 隧道 → 3001 |
| `npm run tunnel:down` | 關閉隧道 |
