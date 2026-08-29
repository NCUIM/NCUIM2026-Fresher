# NCUIM2026-Fresher

一個以手機瀏覽器為主要載體的活動互動網頁：參與者在活動現場透過掃描 QR Code 收集彼此的卡片，並可查看該場活動的公告。

## Language

### 活動與參與

**Event（活動）**:
一場有明確起訖時間的實體活動。是所有身分與收集行為的邊界：一場 Event 中建立的身分與收集紀錄不會延續到另一場 Event。
_Avoid_: Session, 場次

**Archive（封存）**:
Event 結束時的狀態轉換：收集功能自此關閉，但 Participant 與 Admin 仍可查看該場 Event 已產生的 Profile 與 Collection。封存不等於刪除。
Impression 亦於此時凍結：不能再撰寫，也不能再修改。這同時守住兩件事——Score 以「是否撰寫 Impression」為條件，允許事後補寫等於讓 Leaderboard 在活動結束後仍會變動；而封存後的保留期正是大家回頭細看 Impression Wall 的時候，收件人無從得知內容曾被改動，因此那面牆必須是穩定的。
_Avoid_: 結束, 關閉, 刪除

**Participant（參與者）**:
在單一 Event 中參與收集的人。身分繫於該場 Event，不跨 Event 延續；Event 封存後身分依然可用於查看該場收集成果，但無法再進行收集。
一位 Participant 有兩個名字：**姓名**與**暱稱**。姓名是必填的真實姓名，僅 Admin 可見，供現場核對身分與發放獎品；暱稱是對外顯示的名稱，出現在 Card 上。兩者不可互相替代——取暱稱的人往往正是不想讓全場看到本名的人。
一個 Email 在單一 Event 內至多對應一位 Participant，否則以 Email 找回身分的查詢就沒有唯一答案。未填 Email 者不受此限。
_Avoid_: User, 會員, 帳號

**Role（身分）**:
Participant 在 Event 中的類別，於報到時由所掃描的 Entry Code 決定，之後不再變動。目前分為一般參與者與工作人員，工作人員不計入 Leaderboard。
_Avoid_: 權限, 角色, 分組

**Entry Code（註冊碼）**:
Event 層級的 QR Code，掃描後建立一個新的 Participant 身分。同一場 Event 可有多組 Entry Code，各自對應不同的 Role。與 Personal Code 是完全不同的東西。
_Avoid_: 活動 QR, Session QR

**Admin（管理員）**:
管理 Event 並監看其中所有 Participant 活動狀況的人。與 Participant 是不同種類的角色，並非權限較高的 Participant。
_Avoid_: 主辦方, Staff

### 收集

**Profile（個人資料）**:
一位 Participant 在某場 Event 中對外呈現的自我描述：頭像、暱稱、一則 https 社群連結、三個個性化圖示，以及一句話自我介紹。因身分不跨 Event，Profile 亦不跨 Event 延續。姓名與 Email 不屬於 Profile——它們不對外呈現。
_Avoid_: 個人檔案, 名片資料

**Card（卡片）**:
一位 Participant 的 Profile 對外呈現的形式。Card **即時反映 Profile 的最新狀態，不是收集當下的快照**——因此使用者的修正與 Admin 的違規內容移除，會立即反映給所有持有該 Card 的人。Card 本身不具備獨立於 Profile 之外的欄位（如稀有度或卡面樣式）。
_Avoid_: 名片, 好友, 快照

**Personal Code（個人碼）**:
Participant 層級的 QR Code，代表這個人本身，供他人掃描以建立 Collection。是公開的，不可用於登入或找回身分。與 Entry Code 是完全不同的東西。
_Avoid_: 個人 QR, 名片碼

**Scan（掃描）**:
一位 Participant 主動掃描另一位 Participant Personal Code 的動作。一次 Scan 會同時促成雙方的 Collection，但 Scan 本身只歸屬於**發起的那一方**，是衡量主動程度的唯一依據。此歸屬用於 Admin 端統計誰較主動，以及 Achievement 的達成判定，**不影響 Score 的基礎分**——基礎分依 Collection 計算，雙方對等。
_Avoid_: 收集, 加好友

**Collection（收集紀錄）**:
一筆「某位 Participant 在某場 Event 中持有某張 Card」的紀錄。一次 Scan 會**同時**為掃描雙方各建立一筆 Collection，因此持有關係是對稱的；誰主動發起則記錄在 Scan 而非 Collection。同一位 Participant 在單一 Event 內的所有 Collection 構成他的收集清單。
_Avoid_: 好友清單, 通訊錄

**Impression（特質描述）**:
一位 Participant 針對另一位已收集的 Participant 所寫的 50 字以內短評，描述對方的特質與自己的想法。必定具名，且只有**收件人與 Admin** 看得到。每一組收集關係至多一則，可修改。
_Avoid_: 留言, 評論, 回饋, 悄悄話

**Impression Wall（漂浮牆）**:
一位 Participant 收到的所有 Impression 的動態漂浮展示頁面。僅本人與 Admin 可見。收件人可隱藏個別 Impression，隱藏時可一併回報給 Admin。
_Avoid_: 留言板, 塗鴉牆

**Showcase（九宮格）**:
Participant 從自己收集到的 Card 中挑選至多九張的展示格，公開可瀏覽。放入 Showcase 的對象，其 Impression 會在該收件人的 Impression Wall 上以更顯眼的方式呈現。系統不提供「我被幾個人放入 Showcase」的反向查詢。
_Avoid_: 展示櫃, 收藏格, 卡冊

**Announcement（公告）**:
由 Admin 發布、於單一 Event 內對所有 Participant 顯示的活動訊息。
_Avoid_: 通知, 訊息

### 遊戲化

**Team（組別）**:
Admin 在單一 Event 內編排的 Participant 分組。與 Role 不同，Team 不由 Entry Code 決定，而是由系統於報到時自動輪流指派、或由 Admin 事後批次編排，且 Admin 可隨時手動調整。用途是作為 Achievement 的判定依據，並顯示於 Card 上。
_Avoid_: 小隊, 隊伍, 群組

**Achievement（成就）**:
由 Admin 為單一 Event 設定的目標，Participant 達成後獲得分數。成就的條件與分值逐場設定，不同 Event 可以完全不同。每個 Achievement 可設為公開或隱藏：公開者顯示名稱與進度，隱藏者在達成前僅顯示為「隱藏成就」，不透露條件也不顯示進度。
_Avoid_: 任務, 徽章, 關卡

**Score（分數）**:
一位 Participant 在單一 Event 中累積的總分，由「每筆 Collection 的基礎分」與「達成 Achievement 的獎勵分」相加而成。兩者的分值皆由 Admin 逐場設定。一次 Scan 為雙方各建立一筆 Collection，**雙方各自的基礎分以各自撰寫的 Impression 為條件**——掃描本身不阻斷，未撰寫者不計分。Scan 的發起方不影響 Score。
_Avoid_: 點數, 積分, 經驗值

**Leaderboard（排行榜）**:
單一 Event 內依 Score 排序的 Participant 名次，對 Participant 可見。排序依據是 Score，不是 Collection 或 Scan 的數量。僅有個人排名，不設團體排名——Team 只影響 Achievement 的達成與否。
_Avoid_: 排名表, 榜單
