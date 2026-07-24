# v0.4.1 自檢修復清單

| Bug | 修復 |
|-----|------|
| 點選練習 `tryPlay` 翻轉執子，L10 多步問答錯亂 | 問答只高亮，不落子改盤 |
| 快速註冊暱稱可重複，登入撞帳 | `nickname_taken` 409 |
| Cookie 在 localhost 帶 Secure 可能丟 session | HTTPS 才 Secure |
| BYOK resolve 在有 Google env key 時誤搶 openai 相容 | 按 provider kind 分支 |
| preferByok 誤把全局 env key 當「略過 CF」條件 | 僅用戶勾選且有用戶 BYOK |
| 分析寫入失敗拖垮 UI | events 失敗仍 200；stats try/catch |
| 吃子音效不准 | 比對提子前後 captured |
| 引擎回歸 | `npm run test:engine` |
