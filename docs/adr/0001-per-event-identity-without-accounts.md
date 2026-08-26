---
status: accepted
---

# 身分繫於單場活動，不建立帳號系統

參與者是當天現場才第一次接觸系統的新生，報到人潮集中且時間極短，任何登入流程都會直接卡住現場動線。因此我們決定不做帳號系統：Participant 掃描 Event QR Code 後當場建立身分，該身分繫於這一場 Event，不跨 Event 延續，也無法在下一屆活動沿用。

## Considered Options

- **手機簡訊 OTP 驗證**：能跨裝置找回身分，但報到當下要等簡訊，現場動線成本過高。
- **Sign in with Google**：一鍵登入、免打字、無寄信風險，但等同引入正式帳號系統，且把身分與外部服務綁定。
- **註冊時顯示代碼請使用者自行截圖**：完全不碰個資，但可用性完全取決於使用者當下有無截圖，風險過高。
- **限量實體 QR Code 名牌**：實體名牌可作為隨身的身分錨點，但本活動使用數位 QR Code，沒有實體派發管道，此方案不成立。

## Consequences

**必須另外收集 email 作為找回身分的管道，即使我們並不做帳號系統。** 這看似矛盾，原因是一個無法迴避的平台限制：Apple 的 ITP 政策會在使用者連續 7 天未與網站互動後，刪除該站所有 script-writable storage（含 localStorage、IndexedDB、SessionStorage），而 iOS 上所有瀏覽器都必須使用 WebKit，因此無法繞過。由於我們決定 Event 封存後仍保留 14 天供查看，第 8 至 14 天之間所有 iPhone 使用者的瀏覽器身分都會失效。若僅依賴瀏覽器儲存，這段期間的查看功能等同不存在。

因此：Participant 在報到時填寫 email，系統寄送一次性連結供日後找回身分。**不要因為「這個系統沒有登入功能」就移除 email 收集流程** —— 它不是帳號機制，而是對抗 ITP 的必要補償。

實作補充（已完成）：

- 身分憑證改存 **HttpOnly cookie** 而非 localStorage。ITP 的七天清除針對 script-writable storage，由伺服器設定的 HttpOnly cookie 不屬此類，存活時間較長。這不能取代 email 找回，只是多爭取餘裕。
- **只有已驗證的信箱可用於找回。** 未驗證的位址可能是打錯的（例如 gmail 打成 gmial），找回連結會寄到不相干的人手上，而那個人就能接管這個身分。這也讓報到頁的「信箱尚未驗證」提示真正有作用。
- 找回連結為**一次性、30 分鐘到期**。連結若外流（轉寄、共用信箱），長期有效的權杖等同一把永久鑰匙。
- 要求找回時，**信箱存在與否回應完全相同**，否則這個端點會變成用來測試某人有沒有參加活動的工具。

另一個後果是：公開的收集用 QR Code 與私密的找回用代碼必須是兩組不同的憑證。兩者若共用同一組碼，每一位收集過你的人都會同時持有能冒充你的憑證。

參考：[WebKit — Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)
