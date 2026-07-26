# kids-go v0.8.0

一次性大版本：引擎重寫、安全加固、課程修正並擴充至 L26、UI/UX、深度重構、測試與 CI。全部改動皆 additive（不破壞現有 D1 資料）。

## P0 修復（直接影響孩子）

- **護眼休息遮罩鎖死**：改為在常駐 chrome 上事件委派，任何屏幕觸發休息都能正常關閉（v0.7 在地圖/設定/家長等非同步屏幕上按鈕失效）。
- **引擎劫規則錯誤**：ko 只在「單子提單子且提子自身入氣＝1」時設立；解鎖倒撲（原本合法的反提被誤判非法）。
- **SW 快取卡死**：快取鍵由 `package.json` 版本生成，HTML 改 network-first；返回用戶能升級（原本鎖在 v0.6.0）。
- **返回鍵失效**：新增 `popstate` 處理。
- **鍵盤下棋中斷**：焦點跨手保持（原本第一手後失效）。
- **星數造假**：改為依步數(對比 par)/提示/失誤真實計算，取代寫死的 `★★☆`。
- **休息倒數硬編碼**：改讀 EyeCareClock 設定。
- **教練解析失敗洩漏原始模型文字**：解析失敗一律回退句庫，永不輸出原始文字。
- **版本號漂移**：`scripts/sync-version.mjs` 單一來源（web/worker/sw）。

## 計分規則：日本規則（數目）

面向日本小四孩子，計分採**日本規則（數目：地＋アゲハマ提子）**，符合日本圍棋文化與學校教育；「圍住空點＝地」也更貼近初學者建立全局／領地意識的認知路徑。引擎另保留中國規則（數子）為選項但非預設。L26 畢業課據此重寫成「補好邊界每個缺口再數目」的日本規則官子課（缺口會讓整片地漏成單官）。

## 引擎 v2（`packages/go-engine`，純客戶端）

正確劫 + positional superko；日本規則數目 `score()`/`gameResult()`/`territoryMap()` + 貼目（`score(state, { rules })` 可切中國規則）；`pass()`/`isGameOver()` 進 board.ts，`BoardState` 記 consecutivePasses/moveNumber/history；三檔真實分級 AI（L2 兩層搜尋，自對弈 L2>L1≈77%、L1>L0 100%，<50ms/手）；真眼偵測 + pass 策略；整數索引 flood fill；`play()` 回傳提子清單供動畫。**74 條斷言測試**（多子提、倒撲、劫負向、超劫、數地、對殺、自對弈勝率）。

## 後端安全（`workers/api`）

CORS 白名單；session **SHA-256 雜湊存儲** + 登入輪換（明文回退僅限 UUID 形狀 → 杜絕雜湊 id 重放，此漏洞由本輪紅藍對抗揪出並修復）；PIN/密碼**失敗鎖定**（指數退避 30s→15min）；`/api/health` 靜態化（零 D1 寫入）；熱路徑移除 DDL；events/games/friends accept/remove 補限流；`moves_json` 32KB 上限 + 欄位驗證；progress status 嚴格枚舉（非法回 400 而非 500）；BYOK **SSRF 防護**（https/禁私網/IP/憑證）+ 家長密碼/PIN 重新驗證才能改設定；好友列表 N+1 改 JOIN；HSTS/object-src/frame-ancestors；`app.onError`；每日 cron 清過期 session 與 90 天前事件。遷移 `0006_security` / `0007_coach` / `0008_progress`。

## 教練管線

輸出安全過濾（與聊天共用 blocklist + 語言文字驗證 + 句數上限，失敗回退句庫）；AbortController + 8s 總 deadline（單槽 2.5s，真正取消失敗的 fetch）；D1 熔斷器（3 次失敗跳過 dead slug）；Cache API 回應快取（以 `{{name}}` 佔位符存儲，可跨孩子共用且名字不外送）；Groq/OpenRouter `response_format: json_object` + Gemini `responseSchema` + safetySettings 最嚴；取消按小時輪換模型；句庫按 skillTag 分組（每組 ≥4 句 × 3 語）；provider 失敗遙測寫 `usage_events`。

## 課程

修正四課名實不符：**L07** 真雙叫吃、**L16** 真劫形、**L18** 真倒撲（依賴劫修正）、**L19** 真對殺（自己也被叫吃）。`place_n` 課加 `goal` 判定（連接/佔角/做兩眼）。aiLevel 曲線 0→1→2。新增 **L21–L26**（引征、劫爭、做眼、殺眼、對殺數氣、官子數地；取經歸途線；三語 + parentNote）。新 `BattleSpec` 模式 `sequence`（腳本序列，征子/劫/倒撲用，皆由引擎導出）+ `goal` 謂詞。徽章本地化。

## UI/UX

SVG 棋盤（畫線 + 星位 + **交叉點落子** + A–J/1–9 座標）；落子 scale-in / 提子淡出動畫；AI 思考延遲 350–650ms + 悟空思考泡泡；棋盤**定點更新**（不整頁重繪）；提子托盤；勝利 confetti + 徽章解鎖動畫；≥768px 平板橫排佈局；44px 觸控目標 + 震動；終局數地面板 + 地盤標記 + 比分表；貼目 0/3.5/6.5。

## 重構

`main.ts` 2341 行 → `main`(僅啟動)/`state`/`router`/`shell`/`screens/*`/`board/view`/`battle/runtime`/`friends`/`coach` 等模組；後端抽出 `middleware/{cors,rateLimit,guards,body}` + `shared/blocklist` + `ssrf`；刪 `providers/none.ts`。

## 測試 / CI

`.github/workflows/ci.yml`：typecheck + 引擎測試 + `validate-lessons`（CI 模擬每課解出，26/26 可通關）+ `check-locales`（146 key × 3 語 parity）+ 三輪紅藍對抗（150/150，含 session 重放漏洞回歸）+ build。`scripts/adversarial-3rounds.sh` 改指向本地/preview（拒絕打正式站）並斷言 v0.8 新防禦。

## 驗收指令

```bash
npm install --legacy-peer-deps
npm run typecheck && npm test
npm run build:web
npx wrangler d1 migrations apply kids-go --local
npx wrangler dev   # 走查：註冊 → L01 → L18 倒撲可回提 → L22 劫爭 → L26 數地畢業
```

## 部署備註

遷移全 additive，可直接 `npm run db:remote` 套用。session 換制有一版明文回退，現有登入不受影響。
