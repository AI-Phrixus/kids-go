import type { Locale } from "./i18n";

/** Privacy policy copy (extracted from main.ts in the v0.8.0 refactor). */
export function privacyBodyHtml(locale: Locale): string {
  if (locale === "zh-Hant") {
    return `<h2>隱私與資料說明</h2>
        <p>本服務「Kids Igo」供家庭學習圍棋使用，部署於 Cloudflare。</p>
        <h3>我們收集什麼</h3>
        <ul>
          <li><strong>帳號</strong>：家長郵箱（可選）或暱稱+PIN；密碼／PIN 僅存雜湊。</li>
          <li><strong>進度</strong>：課通關、星數、徽章、對局摘要。</li>
          <li><strong>使用事件</strong>（近 30 日統計用）：開局、通關、護眼休息、自由對弈、教練提示次數——不含聊天全文。</li>
          <li><strong>AI 設定</strong>：你自願填寫的第三方 Base URL／API Key／Model（Key 回傳只顯示末四位）。</li>
        </ul>
        <h3>我們不做什麼</h3>
        <ul>
          <li>無公開排行榜、無陌生人對戰、不出售個資。</li>
          <li>不強制收集真實姓名、學校、地理位置。</li>
        </ul>
        <h3>AI 與跨境</h3>
        <ul>
          <li>預設優先免費額供應商與 Cloudflare Workers AI；額度到了改用你設定的第三方或本地句庫。</li>
          <li>若使用第三方 API，請求內容（盤面摘要）會送往該供應商，受其隱私政策約束；孩子暱稱不會送往第三方（以佔位符代替）。</li>
        </ul>
        <h3>兒童與家長</h3>
        <ul>
          <li>建議由家長協助註冊與保管 PIN／郵箱。</li>
          <li>「家長摘要」僅供已登入家庭帳號查看該孩子進度。</li>
          <li>修改 AI 設定需重新輸入家長密碼／PIN。</li>
        </ul>
        <h3>保存與刪除</h3>
        <ul>
          <li>資料保存在你的 Cloudflare 帳戶下 D1；操作者可依 Cloudflare 工具匯出或清除。</li>
          <li>若需刪帳，請聯繫部署者（本專案自建）。</li>
        </ul>`;
  }
  if (locale === "ja") {
    return `<h2>プライバシー</h2>
        <p>Kids Igo は家庭で囲碁を学ぶためのサービスです（Cloudflare 上）。</p>
        <h3>集めるもの</h3>
        <ul>
          <li><strong>アカウント</strong>：保護者メール（任意）またはなまえ+PIN。パスワード／PIN はハッシュのみ保存。</li>
          <li><strong>進捗</strong>：通関・星・バッジ・対局要約。</li>
          <li><strong>利用イベント</strong>（直近30日）：起動・通関・目休め・自由対局・ヒント回数。会話全文は保存しません。</li>
          <li><strong>AI 設定</strong>：任意の第三者 Base URL／API Key／Model（Key は末尾4桁のみ表示）。</li>
        </ul>
        <h3>しないこと</h3>
        <ul>
          <li>公開ランキング・見知らぬ人との対局・個人情報の販売なし。</li>
          <li>本名・学校・位置情報の強制収集なし。</li>
        </ul>
        <h3>AI</h3>
        <ul>
          <li>優先：無料枠プロバイダ → Cloudflare Workers AI → 第三者 BYOK → 定型文。</li>
          <li>第三者 API 利用時は盤面要約がその規約に従います。お子さまのなまえは第三者に送りません（プレースホルダに置換）。</li>
        </ul>
        <h3>お子さまと保護者</h3>
        <ul>
          <li>PIN／メールは保護者と一緒に管理してください。</li>
          <li>保護者まとめはその家庭の進捗のみ。</li>
          <li>AI 設定の変更にはパスワード／PIN の再入力が必要です。</li>
        </ul>`;
  }
  return `<h2>Privacy</h2>
        <p>Kids Igo stores account, progress, and aggregate usage events (lesson clear, eye breaks) in your Cloudflare D1.</p>
        <ul>
          <li>No public leaderboards or stranger matchmaking.</li>
          <li>Optional third-party AI keys stay in your settings (last 4 chars shown).</li>
          <li>Coach: free-tier providers and Cloudflare free AI first, then your BYOK, then offline phrases. The child's nickname is never sent to third parties (a placeholder is used).</li>
          <li>Parents should help manage PIN/email for children; changing AI settings requires re-entering the password/PIN.</li>
          <li>We do not sell personal data or force real name/school/location.</li>
        </ul>`;
}
