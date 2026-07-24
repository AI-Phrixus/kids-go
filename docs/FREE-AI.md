# 免費高效能教練 AI 評測與綁定（Kids Igo）

> 更新：2026-07-24 · 產品需求：兒童短句提示、繁中/日/英、低延遲、**盡量永久免費、開源權重優先、不綁 CF 付費**

## 綜合評測（給本產品）

| 方案 | 模型級別 | 永久免費額 | 速度 | 隱私/訓練 | OpenAI 相容 | 適配度 |
|------|----------|------------|------|-----------|-------------|--------|
| **Cloudflare Workers AI**（已內建） | 約 3B–8B 開源 | 約 1 萬 Neurons/日 | 中 | 好 | 部分 | ✅ 預設必備 |
| **Groq** | **Llama 3.3 70B** 等開源 | ~1000 次/日、30 RPM | **極快** | 宣稱不用於訓練 | ✅ | ⭐ **首選備援** |
| **OpenRouter free** | 20+ 開源 free 模型 | ~50 次/日（儲值可升） | 中–快 | 好 | ✅ | ⭐ 模型多樣備援 |
| **Google Gemini free** | Gemini Flash | 高 RPD | 快 | **非歐盟可能用於訓練** | 部分 | 額度大，隱私次之 |
| **Cerebras free** | Llama 3.3 70B | ~1M tokens/日 | 極快 | 好 | ✅ | 可作進階 |
| **Mistral Experiment** | Small/Large | ~1B tokens/月 | 中 | **需同意訓練** | ✅ | 額度大、隱私差 |
| 本地 Ollama | 自選開源 | 無限 | 取決於硬體 | 最佳 | ✅ | 不適合本站無伺服器 |

**結論（Kids Igo）**

1. **維持 CF Workers AI 為第一層**（零 Key、同帳號、防付費超額軟上限）。  
2. **站點級升級首選：Groq（Llama 3.3 70B）** — 真正開源權重、免費額夠兒童產品、延遲最佳。  
3. **次選：OpenRouter free** — 一個 Key 試多個 free 開源模型。  
4. Gemini 作可選（額度大，注意訓練政策）。  

我**無法代你自動註冊**這些服務（需人機驗證 / 郵箱 / OAuth）。請依下列教程拿 Key，再把字串給我或自行 `wrangler secret put`。

---

## 鏈路（v0.6.1）

```text
① Cloudflare Workers AI（免費）
  → 失敗/軟上限
② 站點 secrets：GROQ / OPENROUTER / GOOGLE（可選免費額）
  → 失敗
③ 使用者設定頁 BYOK
  → 失敗
④ 本地句庫 static
```

---

## 教程 A：Groq（推薦 · 約 5 分鐘）

1. 開啟 https://console.groq.com/  
2. 用 Google / GitHub / 郵箱註冊並登入（**通常免信用卡**）。  
3. 左側 **API Keys** → **Create API Key** → 複製 `gsk_…`。  
4. 預設模型建議：`llama-3.3-70b-versatile`（開源 Llama 3.3 70B）。  

**把 Key 綁到站點（你執行，或貼給我代跑）：**

```bash
cd /Users/phrixusjhon/kids-go
npx wrangler secret put GROQ_API_KEY
# 貼上 gsk_… 後 Enter

# 可選覆寫模型
npx wrangler secret put GROQ_MODEL
# 輸入：llama-3.3-70b-versatile
```

或在網頁 **設定 → 預設範本「Groq」→ 貼 Key → 勾選「略過 CF」若想優先用 70B → 儲存 → 測試連線**。

---

## 教程 B：OpenRouter free（多模型）

1. 開啟 https://openrouter.ai/  
2. 註冊登入 → **Keys** → Create Key。  
3. 免費模型建議用自動路由：`openrouter/free`（或見 https://openrouter.ai/collections/free-models ；`:free` 列表會變）。  
4. 免費用量約 **50 次/日**；儲值 $10 可提高 free 模型日上限（非必須）。  
5. 範例裡的 `openai/gpt-4o` **不是免費**，需 OpenRouter 餘額；本站預設走 free 路由。  

```bash
npx wrangler secret put OPENROUTER_API_KEY
# 可選
npx wrangler secret put OPENROUTER_MODEL
# openrouter/free
```

---

## 教程 C：Google Gemini free

1. 開啟 https://aistudio.google.com/apikey  
2. Create API key（Google 帳號）。  
3. 注意：部分地區**提示可能用於改進模型**。  

```bash
npx wrangler secret put GOOGLE_API_KEY
```

或設定頁選 Gemini 預設。

---

## 驗證

```bash
curl -sS https://go.tdtc.indevs.in/api/health | jq .coach
# freeTierConfigured: true 且 freeTierProviders 含 groq / openrouter 即成功
```

登入後點「問悟空」：  
- 未滿 CF 軟上限 → 多半 `source: workers_ai`  
- 滿了或 CF 失敗 → `source: byok`（Groq/OpenRouter 等）

---

## 我不能自動做的事

- 無法代替你完成 reCAPTCHA / 郵箱驗證 / OAuth。  
- 請註冊後把 **API Key 私訊或貼在本機終端**（**不要 commit 到 Git**）。  

拿到 Key 後回覆一句「Groq Key 好了」並貼上，或自行跑上面的 `wrangler secret put`。
