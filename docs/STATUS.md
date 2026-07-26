# 狀態快照

> **版本**：v0.8.0  
> **更新**：2026-07-26  

## v0.8.0 大版本（引擎/安全/課程/UI/重構）

**P0 修復**：護眼遮罩事件委派修復（非同步屏幕上可正常關閉）；引擎 ko 條件補上「提子自身入氣=1」（解鎖倒撲）；SW 快取鍵由版本生成 + HTML network-first（返回用戶能升級）；popstate 返回鍵；鍵盤焦點跨手保持；星數真實計算；休息倒數讀設定；教練解析失敗不再輸出原始模型文字；版本號單一來源（`scripts/sync-version.mjs`）。

**引擎 v2**（`packages/go-engine`）：正確劫規則 + positional superko；`score()`/`gameResult()`/`territoryMap()`（日本規則數目 + 貼目）；`pass()`/`isGameOver()` 進 board.ts + BoardState 記 consecutivePasses/moveNumber/history；三檔真實分級 AI（L2 兩層搜尋，自對弈 L2>L1 ≈77%、L1>L0 100%）；真眼偵測（不填自己的眼）+ pass 策略；整數索引 flood fill；**74 條斷言測試**。

**後端安全**：CORS 白名單（取代反射任意 origin）；session **SHA-256 雜湊存儲** + 登入輪換（明文回退僅限 UUID 形狀，杜絕雜湊 id 重放）；PIN/密碼**失敗鎖定**（指數退避）；`/api/health` 靜態化（零 D1 寫入）；熱路徑移除 DDL；events/games/friends 補限流；`moves_json` 32KB 上限 + 欄位驗證；progress status 嚴格枚舉（不再 500）；BYOK **SSRF 防護** + 家長密碼/PIN 重新驗證；好友列表 N+1 改 JOIN；HSTS/object-src/frame-ancestors；`app.onError`；每日 cron 清理過期 session 與舊事件；遷移 0006–0008。

**教練管線**：**輸出安全過濾**（與聊天共用 blocklist + 語言文字驗證 + 句數上限，失敗回退句庫）；AbortController + 8s 總鏈 deadline（單槽 2.5s）；D1 熔斷器（3 次失敗跳過）；Cache API 回應快取（{{name}} 佔位符，可跨孩子共用，名字不外送）；Groq/OpenRouter JSON mode + Gemini responseSchema + safetySettings 最嚴；取消按小時輪換；句庫按 skillTag 分組；provider 失敗遙測。

**課程**：修正 L07/L16/L18/L19（名實相符，腳本序列由引擎導出）；place_n 課加 goal 判定；aiLevel 曲線；**新增 L21–L26**（引征/劫爭/做眼/殺眼/對殺數氣/官子數地，取經歸途線，三語）；徽章本地化。

**UI/UX**：SVG 棋盤（畫線 + 星位 + 交叉點落子 + 座標）+ 落子/提子動畫 + AI 思考延遲；提子托盤；勝利 confetti + 徽章解鎖動畫；≥768px 平板橫排；44px 觸控目標 + 震動；終局數地面板 + 地盤標記。

**重構**：main.ts 2341 行 → main(啟動)/state/router/shell/events/screens/*/board/battle/friends/coach 等模組；後端抽出 middleware（cors/rateLimit/guards/body）+ shared/blocklist + ssrf；刪 providers/none.ts。

**測試/CI**：GitHub Actions（typecheck + engine + validate-lessons + check-locales + 三輪紅藍對抗 + build）；`validate-lessons.ts` 於 CI 模擬每課解出（26/26 可通關）；`adversarial.test.ts` 三輪 150/150（本輪即揪出並修復一個 session 重放漏洞）。

## v0.7.5 奇幻體驗收尾

- 地圖站標圖示、淡入、旅程裝飾  
- 過關閃星、歡迎頁光暈  
- 首次地圖溫柔提示（說明＋知道了）  
- 閃爍星點裝飾（reduced-motion 可關）  

## v0.7.4 吉卜力感奇幻 UI

- 水彩天空／雲／草地背景  
- 紙感卡片、圓潤按鈕、柔和陰影  
- 大眼溫柔吉祥物（原創，非任何 IP）  
- 棋盤暖木、進度條與地圖路徑童話化  

## v0.7.3 遊戲內完整說明 + 對抗複測

- 站內「遊戲說明／遊び方ガイド」九章目錄（註冊、地圖、棋盤、悟空、好友、姿勢、護眼、家長、分享）  
- 歡迎頁與地圖均可進入  
- 紅藍軍複測通過（教練／好友／跳關／訊息盜讀／HTML 暱稱等）  

## v0.7.0 好友與聊天

- 用**對方暱稱**加好友（不知暱稱無法搜尋陌生人）  
- 雙向請求或接受後成為好友  
- 簡易聊天彈窗（短訊息、禁連結、頻率限制）  
- 分享邀請文案（暱稱 + 網站連結）  

## v0.6.3 紅藍軍極限自檢修復

- 教練 API **必須登入**（防免費額盜刷）+ 用戶級速率限制  
- 暱稱消毒：禁 HTML／腳本字元  
- 分析事件必須登入  
- 吃子賽雙方同時達標：分高者勝、同分平局  
- boardSummary 長度上限

## 網址

| 優先 | URL |
|------|-----|
| **主** | **https://go.tdtc.indevs.in** |
| 備 | https://go.tdtc.dpdns.org |
| 備 | https://kids-go.phrixusjhon.workers.dev |

GitHub：https://github.com/AI-Phrixus/kids-go  

## v0.6.1 自檢修復

- **P0**：禁止跳關 `POST /progress`（必須上一課 completed）  
- 課表 `playable` 與 `locked` 對齊  
- 教練鏈：CF → 站點免費額（Groq/OpenRouter/Gemini secrets）→ 用戶 BYOK → 句庫  
- CF 模型改 8b-fast + 3b 回退；提示詞強制繁中  
- 見 [FREE-AI.md](./FREE-AI.md)  

## v0.6 完善

- 三語字串補全（自由對弈、家長統計、錯誤、怎麼玩）
- 通關後「下一課」；課內步驟進度點；課中也可「顯示氣」
- 自由對弈：AI 難度、雙方停手結束、悔棋保留
- 棋盤 a11y：aria、鍵盤方向鍵、Enter 落子、focus 環
- 表單 Enter 送出、教練 2.5s 冷卻、瀏覽器返回
- 完整日文隱私說明 + 怎麼玩手冊
- Service Worker 離線殼（不緩存 API）+ 離線橫幅
- 靜態教練多句輪換；家長摘要一鍵複製
- 引擎測試：劫、吃子賽、AI 優先提子
- `run_worker_first` 確保 CSP / 安全標頭套在 HTML

## v0.5 回顧

- PWA manifest + favicon、悔棋、顯示氣、繼續上一課、CSP、引擎測試  

## 產品目標

見 [GOALS.md](./GOALS.md) — 主線已完成。  

## v0.7.6 三輪對抗測試

- 腳本 `scripts/adversarial-3rounds.sh` 連續 3 輪 **PASS=132 FAIL=0**
- 註冊限流 10→30/分（校園共用 IP）
- 覆蓋：未授權、XSS 暱稱、跳關、好友盜讀、訊息過濾、BYOK http、CSP
