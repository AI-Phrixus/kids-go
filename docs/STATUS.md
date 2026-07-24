# 狀態快照

> **版本**：v0.6.3  
> **更新**：2026-07-24  

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
