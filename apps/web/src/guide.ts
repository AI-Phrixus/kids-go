import type { Locale } from "./i18n";

export type GuideSection = {
  id: string;
  title: string;
  html: string;
};

/** In-game full user guide (safe HTML, no user input). */
export function guideSections(locale: Locale): GuideSection[] {
  if (locale === "ja") return JA;
  if (locale === "en") return EN;
  return ZH;
}

const ZH: GuideSection[] = [
  {
    id: "start",
    title: "1. 開始西行",
    html: `
      <p>Kids Igo 是給約 10～11 歲小朋友的<strong>圍棋啟蒙遊戲</strong>，用《西遊記》取經路學戰略思維，也照顧眼睛與坐姿。</p>
      <ul>
        <li><strong>快速註冊</strong>：暱稱 + 6 位數字 PIN（請家長幫忙記住；舊帳號仍可用原本的 4～6 位 PIN 登入）。</li>
        <li><strong>家長註冊</strong>：郵箱 + 密碼 + 孩子暱稱，方便看進度摘要。</li>
        <li>暱稱不能含特殊符號（&lt; &gt; 等），以保護安全。</li>
        <li>語言可在右上角切換：日本語／繁中／English。</li>
      </ul>`,
  },
  {
    id: "map",
    title: "2. 西行地圖與課程",
    html: `
      <ul>
        <li>地圖上有 <strong>L01～L20</strong> 關卡，需依序通關解鎖下一關。</li>
        <li>每關：故事／說明 → 有時點棋盤答題 → <strong>人機試練</strong>。</li>
        <li>通關可獲星星與徽章；可按「下一課」繼續。</li>
        <li>「繼續上一課」會打開目前可玩的下一站。</li>
      </ul>
      <p>口訣：<strong>金角銀邊草肚皮</strong>——先角、再邊、後中央。</p>`,
  },
  {
    id: "board",
    title: "3. 棋盤怎麼玩",
    html: `
      <ul>
        <li>棋子下在<strong>交叉點</strong>上，黑先白後。</li>
        <li><strong>氣</strong>：棋子旁邊的空交叉點；氣被圍完就會被提走。</li>
        <li>可開「顯示氣」幫助數數；自由對弈可悔一手、停一手。</li>
        <li>自由對弈有：隨意、先吃 5、先吃 10；可調 AI 難度。</li>
        <li>鍵盤：方向鍵移動、Enter／空白鍵落子（練習時也可用）。</li>
      </ul>`,
  },
  {
    id: "coach",
    title: "4. 問悟空（AI 教練）",
    html: `
      <ul>
        <li>試練或自由對弈可按「問悟空」拿短提示。</li>
        <li>系統優先用<strong>免費高效能</strong>教練鏈（Groq → OpenRouter → Gemini → CF → 句庫）。</li>
        <li>每日有軟上限，用完會自動換備援，不會突然收費。</li>
        <li>家長可在「設定」自行填第三方 API（選用）。</li>
      </ul>`,
  },
  {
    id: "friends",
    title: "5. 好友與聊天",
    html: `
      <ul>
        <li><strong>沒有陌生人列表</strong>：必須知道對方<strong>暱稱</strong>才能加好友。</li>
        <li>你加對方、對方也加你（或接受邀請）→ 成為好友。</li>
        <li>聊天：短訊息、禁止貼網址；預設<strong>隨口聊天</strong>。</li>
        <li>可選「咒語任務」：對上秘密暗號再傳訊——像小遊戲，不是罰寫作業。</li>
        <li>「邀請同學」可複製分享文案（暱稱 + 網站連結）。</li>
      </ul>
      <p>安全提醒：只把暱稱告訴信任的同學與家長。</p>`,
  },
  {
    id: "fun-type",
    title: "6. 好玩的傳訊與姿勢",
    html: `
      <ul>
        <li>聊天上方有<strong>舒服姿勢小提示</strong>（護脊、坐滿椅子、螢幕別太低、手指輕點）。</li>
        <li>點提示旁按鈕可換下一條，像西遊路上的小提醒。</li>
        <li>咒語任務：對上暗號有能量條與通關次數，錯了叫「小妖怪」，再試就好。</li>
        <li>一切以<strong>好玩、交朋友</strong>為先，不強迫枯燥練打字。</li>
      </ul>`,
  },
  {
    id: "eyes",
    title: "7. 護眼休息",
    html: `
      <ul>
        <li>大約每 20 分鐘會出現「路邊歇腳站」，遠眺約 20 秒。</li>
        <li>悟空／八戒風格的護眼小儀式（眨眼、搓手心等）。</li>
        <li>今日螢幕時間偏長會溫柔提醒（不是處罰）。</li>
        <li>我們<strong>不宣稱</strong>治療近視，只是養成好習慣。</li>
      </ul>`,
  },
  {
    id: "parent",
    title: "8. 家長與隱私",
    html: `
      <ul>
        <li>「家長摘要」：進度、星星、徽章、近 30 日使用概況。</li>
        <li>可一鍵複製摘要給自己記錄。</li>
        <li>資料在你部署的 Cloudflare D1；無公開排行、無陌生人配對。</li>
        <li>PIN／郵箱請家長保管；刪帳需部署者處理。</li>
      </ul>`,
  },
  {
    id: "share",
    title: "9. 分享與連結",
    html: `
      <p>網站：<strong>https://go.tdtc.indevs.in</strong></p>
      <p>跟同學說：「我的暱稱是 ○○，打開網站用暱稱加我，一起西行學圍棋！」</p>
      <p>版本會顯示在頁面底部。遇到問題可請家長查看隱私說明或重新登入。</p>`,
  },
];

const JA: GuideSection[] = [
  {
    id: "start",
    title: "1. 旅のはじめ方",
    html: `
      <p>Kids Igo は 10〜11 歳向けの<strong>囲碁入門ゲーム</strong>。西遊記の旅で戦略を学び、目と姿勢も大切にします。</p>
      <ul>
        <li><strong>かんたん登録</strong>：なまえ + 6桁 PIN（保護者と一緒に覚えてね。既存アカウントは元の4〜6桁でログインできます）。</li>
        <li><strong>保護者登録</strong>：メール + パスワード + 子どものなまえ。</li>
        <li>なまえに &lt; &gt; などの記号は使えません。</li>
        <li>右上で 日本語／繁中／English を切り替え。</li>
      </ul>`,
  },
  {
    id: "map",
    title: "2. 地図とレッスン",
    html: `
      <ul>
        <li>L01〜L20 を順にクリアして次を解放。</li>
        <li>各駅：物語 →（ときどき盤でクイズ）→ <strong>人機の試練</strong>。</li>
        <li>クリアで星とバッジ。「つづきから」で次の駅へ。</li>
      </ul>
      <p>ことわざ：<strong>金角銀辺草肚皮</strong>（角→辺→中央）。</p>`,
  },
  {
    id: "board",
    title: "3. 盤の遊び方",
    html: `
      <ul>
        <li>交点に置く。黒が先。</li>
        <li><strong>気</strong>がなくなると取られる。「気を表示」が便利。</li>
        <li>自由対局：気まま／先取5／先取10、AIの強さ、一手戻す、パス。</li>
        <li>キーボード：矢印で移動、Enter／Space で置く。</li>
      </ul>`,
  },
  {
    id: "coach",
    title: "4. 悟空に聞く",
    html: `
      <ul>
        <li>短いヒントをくれる無料コーチ連鎖（Groq→OpenRouter→Gemini→CF→定型文）。</li>
        <li>日次ソフト上限あり。有料課金を勝手にしません。</li>
        <li>設定で第三者 API も可（任意）。</li>
      </ul>`,
  },
  {
    id: "friends",
    title: "5. ともだちとチャット",
    html: `
      <ul>
        <li>公開リストなし。<strong>なまえを知っている人だけ</strong>追加可能。</li>
        <li>お互い追加（または承認）でなかまに。</li>
        <li>短いメッセージ、URL 禁止。既定は気ままトーク。</li>
        <li>任意の「合図ミッション」で遊べる（宿題ではない）。</li>
        <li>招待文をコピーしてクラスメートに共有。</li>
      </ul>`,
  },
  {
    id: "fun-type",
    title: "6. 楽しい合図と姿勢",
    html: `
      <ul>
        <li>チャット上に<strong>らくな姿勢ヒント</strong>（背すじ、足、画面の高さ、やさしい指）。</li>
        <li>合図ミッションはゲーム感覚。間違いは「小妖怪」、もう一度でOK。</li>
        <li>まずは楽しさとともだち優先。</li>
      </ul>`,
  },
  {
    id: "eyes",
    title: "7. 目の休憩",
    html: `
      <ul>
        <li>約20分ごとに休憩の駅。遠くを20秒。</li>
        <li>近視を治すとは言いません。習慣づくりです。</li>
      </ul>`,
  },
  {
    id: "parent",
    title: "8. 保護者とプライバシー",
    html: `
      <ul>
        <li>保護者まとめ：進捗・星・バッジ・利用概況。</li>
        <li>公開ランキングや知らない人との対局なし。</li>
        <li>PIN／メールは保護者と管理。</li>
      </ul>`,
  },
  {
    id: "share",
    title: "9. 共有",
    html: `
      <p>URL：<strong>https://go.tdtc.indevs.in</strong></p>
      <p>「なまえは ○○。サイトでなまえを入れてなかまになって！」</p>`,
  },
];

const EN: GuideSection[] = [
  {
    id: "start",
    title: "1. Getting started",
    html: `
      <p>Kids Igo is a <strong>Go starter game</strong> for ages ~10–11, wrapped in Journey to the West — strategy, eyes, and comfy posture.</p>
      <ul>
        <li><strong>Quick sign-up</strong>: nickname + a 6-digit PIN (parents help remember; existing accounts can still log in with their original 4–6 digits).</li>
        <li><strong>Parent sign-up</strong>: email + password + child nickname for progress summary.</li>
        <li>No special markup characters in nicknames (&lt; &gt; …).</li>
        <li>Switch language top-right: Japanese / Traditional Chinese / English.</li>
      </ul>`,
  },
  {
    id: "map",
    title: "2. Map & lessons",
    html: `
      <ul>
        <li>Levels <strong>L01–L20</strong> unlock in order.</li>
        <li>Each stop: story → optional board quiz → <strong>trial vs AI</strong>.</li>
        <li>Earn stars & badges; use Continue / Next lesson.</li>
      </ul>
      <p>Proverb: <strong>gold corners, silver sides, grass belly</strong>.</p>`,
  },
  {
    id: "board",
    title: "3. How the board works",
    html: `
      <ul>
        <li>Place on <strong>intersections</strong>; Black plays first.</li>
        <li><strong>Liberties</strong> = empty spots next to a group; zero liberties → capture.</li>
        <li>Free play: casual / race 5 / race 10, AI level, undo, pass, show liberties.</li>
        <li>Keyboard: arrows + Enter/Space to place.</li>
      </ul>`,
  },
  {
    id: "coach",
    title: "4. Ask Wukong (AI coach)",
    html: `
      <ul>
        <li>Short kid-friendly hints.</li>
        <li>Free high-perf chain: Groq → OpenRouter free → Gemini free → CF → offline phrases.</li>
        <li>Soft daily cap; no surprise CF overage from this app’s design.</li>
        <li>Optional third-party API in Settings.</li>
      </ul>`,
  },
  {
    id: "friends",
    title: "5. Friends & chat",
    html: `
      <ul>
        <li><strong>No stranger directory</strong> — add only by exact <strong>nickname</strong>.</li>
        <li>Mutual add or accept → friends.</li>
        <li>Short messages, no links. Default free chat.</li>
        <li>Optional “spell quest” is a mini-game, not homework.</li>
        <li>Share invite text (nickname + site URL).</li>
      </ul>`,
  },
  {
    id: "fun-type",
    title: "6. Fun signals & posture",
    html: `
      <ul>
        <li>Rotating <strong>comfy posture tips</strong> (spine, feet, screen height, soft fingers).</li>
        <li>Spell quest = match a secret signal for fun power-ups.</li>
        <li>Joy and friends first — never a dry typing class.</li>
      </ul>`,
  },
  {
    id: "eyes",
    title: "7. Eye-care breaks",
    html: `
      <ul>
        <li>About every 20 minutes: rest station, look far ~20 seconds.</li>
        <li>We do <strong>not</strong> claim to cure myopia — good habits only.</li>
      </ul>`,
  },
  {
    id: "parent",
    title: "8. Parents & privacy",
    html: `
      <ul>
        <li>Parent summary: progress, stars, badges, 30-day usage sketch.</li>
        <li>No public leaderboards or stranger matchmaking.</li>
        <li>Parents manage PIN/email.</li>
      </ul>`,
  },
  {
    id: "share",
    title: "9. Share",
    html: `
      <p>Site: <strong>https://go.tdtc.indevs.in</strong></p>
      <p>“My nickname is ○○ — open the site and add me by nickname!”</p>`,
  },
];

export function guideTocHtml(locale: Locale): string {
  return guideSections(locale)
    .map((s) => `<a class="guide-toc-link" href="#guide-${s.id}">${escape(s.title)}</a>`)
    .join("");
}

export function guideBodyHtml(locale: Locale): string {
  return guideSections(locale)
    .map(
      (s) =>
        `<section class="guide-sec" id="guide-${s.id}">
          <h3>${escape(s.title)}</h3>
          ${s.html}
        </section>`,
    )
    .join("");
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
