# AI → AI 交接：Cloudflare 免費 AI 優先 + 防超額

> 給**下一任 AI** 的完整任務說明。操作者可整段複製貼上。  
> 公開倉庫：https://github.com/AI-Phrixus/kids-go  
> 生產：https://kids-go.phrixusjhon.workers.dev  
> 本地：`/Users/phrixusjhon/kids-go`

---

## 給下一任 AI 的 Prompt（可直接複製）

```text
你是接手 Kids Igo（兒童圍棋）專案的工程 AI。

## 專案
- 路徑：~/kids-go 或 clone https://github.com/AI-Phrixus/kids-go
- 部署：Cloudflare Workers Free + D1 + Workers AI binding
- 線上：https://kids-go.phrixusjhon.workers.dev
- 文檔先讀：docs/STATUS.md、docs/HANDOFF.md、docs/COACH-PROVIDERS.md、docs/AI-TO-AI-QUOTA.md

## 產品硬性要求（不可違反）
1. 教練 AI 調用順序固定為：
   ① Cloudflare Workers AI（免費額度）
   ② 用戶在設定頁填的第三方（Base URL + API Key + Model）
   ③ 本地靜態句庫（永遠可玩、零費用）
2. 填寫第三方 URL/Key **不得**自動跳過 Cloudflare 免費 AI。
   只有用戶明確勾選「略過 CF / preferByok」才允許先打第三方。
3. **防超額（不扣款）**：
   - 應用層：軟上限 COACH_CF_SOFT_MAX_CALLS（預設 40 次成功呼叫/UTC 日），到達後當日不再打 CF AI，改走第三方/靜態。
   - 平台層：帳號必須維持 **Workers Free**。Free 上 Workers AI 用完是硬停，不會像 Paid 那樣按 Neuron 繼續計費。
   - 偵測 CF 回傳 neuron/4006/quota 類錯誤 → 當日記入 cf_fail_quota，全日封鎖 CF AI。
4. 提醒：/api/coach/status、/api/health.coach、教練 JSON 的 reminder 欄位；地圖頁 banner。

## 已實作位置（先讀再改）
- workers/api/src/coach/service.ts — runCoach 鏈、buildEffectiveEnv
- workers/api/src/coach/quota.ts — 軟上限與 D1 coach_quota
- workers/api/src/coach/providers/workersAi.ts — CF AI + 額度錯誤偵測
- workers/api/src/routes/settings.ts — 第三方 URL/Key 設定 API
- apps/web 設定頁 — 地圖 →「設定（第三方 AI）」
- wrangler.toml — [ai] binding、COACH_CF_SOFT_MAX_CALLS、COACH_PROVIDER=auto

## 你的任務（按優先級）
### A. 驗證 CF 優先鏈（必做）
1. 確認 buildEffectiveEnv：用戶 provider=openai_compatible 且 preferByok=false 時，仍先 try CF AI。
2. 寫/跑最小測試或手動 curl：
   - 無第三方：走 CF 或靜態
   - 有第三方 + 未勾 preferByok：CF 失敗/軟上限後才 BYOK
   - preferByok=true：可跳過 CF
3. 若有回歸，修復並 npm run build:web && wrangler deploy

### B. 防超額加固（能做則做）
1. 可把軟上限改為可配置（設定頁或 env），預設偏保守（≤40 或更低）。
2. 可選：用近似 Neuron 估算（每次呼叫記 token 粗算）代替純次數。
3. 設定頁明顯警示：「請保持 Cloudflare Workers 方案為 Free，升級 Paid 可能對 Workers AI 超額計費。」
4. 你**無法**透過 API 替用戶關閉 CF 帳戶付費開關時，在 docs 寫清操作者須在 Dashboard 檢查的步驟：
   - Workers 方案 = Free
   - Billing 無意外 Paid
   - Workers AI 用量儀表

### C. 你做不到時
在 docs/STATUS.md 註明缺口；不要假裝已設置帳戶級 spending cap。

## 完成定義
- [ ] 預設鏈：CF free → BYOK → static（有測試或 curl 證據）
- [ ] 未勾 preferByok 時，填第三方不會跳過 CF
- [ ] 軟上限到後當日不再打 CF
- [ ] 文檔與 UI 文案一致（日/繁中/英至少繁中清楚）
- [ ] git commit + push；若已 login 則 deploy

## 部署提醒
非互動環境可能需要 OAuth token：
export CLOUDFLARE_API_TOKEN=$(python3 -c "import tomllib; print(tomllib.load(open('$HOME/Library/Preferences/.wrangler/config/default.toml','rb'))['oauth_token'])")
```

---

## 本專案已能做的防超額（程式層）

| 機制 | 狀態 |
|------|------|
| CF Workers AI 綁定 + 優先調用 | ✅ |
| 軟上限次數/日 → 切第三方 | ✅ `COACH_CF_SOFT_MAX_CALLS` |
| 額度錯誤當日封鎖 CF | ✅ |
| 第三方設定頁 URL/Key | ✅ |
| 填第三方不跳過 CF（preferByok=false） | ✅ 修復於 v0.1.3 邏輯 |
| 帳戶保持 Free（平台硬停） | ⚠️ **操作者 Dashboard 行為**，程式無法強制 |

## 程式無法替你做的（需人類或下一任 AI 文檔化）

1. 在 Cloudflare Dashboard 鎖定 **Workers Free**、避免誤升 Paid  
2. 設置帳戶級 **spending alert / 信用卡限額**（若平台提供）  
3. 保證 Workers AI 定價政策永遠不變（以 Cloudflare 官網為準）

---

## 操作者檢查清單（2 分鐘）

1. https://dash.cloudflare.com → Workers → 確認方案 **Free**  
2. 打開 https://kids-go.phrixusjhon.workers.dev → 設定第三方（可選）→ **不要**勾「略過 CF」  
3. `GET /api/coach/status?locale=zh-Hant` 看 `chain` 應為 `cloudflare_free → byok → static`  
