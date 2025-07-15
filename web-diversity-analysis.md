# ウェブドキュメント構造の多様性分析

## 🌐 現実世界のドキュメントサイト構造

### **Framework/Platform による構造差異**
1. **静的サイトジェネレーター**
   - Jekyll (GitHub Pages) → `_layouts/` ベース
   - Hugo → `{{ }}` テンプレート
   - Gatsby → GraphQL + React
   - Next.js → API Routes + SSR

2. **ドキュメントプラットフォーム**
   - GitBook → 独自JSON構造
   - Notion → 動的ブロック
   - Confluence → XHTML + マクロ
   - MediaWiki → PHP生成HTML

3. **カスタムCMS**
   - WordPress → プラグイン依存
   - Drupal → モジュール構造
   - 自社開発 → 完全独自

### **DOM構造のパターン例**
```html
<!-- パターンA: 標準的構造 -->
<nav class="sidebar">
  <ul>
    <li><a href="/guide">Guide</a></li>
  </ul>
</nav>
<main class="content">
  <article>Content</article>
</main>

<!-- パターンB: React SPA -->
<div id="root">
  <div data-reactroot="">
    <div class="app">
      <!-- 動的生成コンテンツ -->
    </div>
  </div>
</div>

<!-- パターンC: 独自フレームワーク -->
<xyz-navigation slot="nav"></xyz-navigation>
<xyz-content data-page="intro"></xyz-content>

<!-- パターンD: 複雑な入れ子 -->
<div class="layout">
  <div class="sidebar">
    <div class="nav-wrapper">
      <div class="nav-container">
        <nav role="navigation">
          <!-- 4層の入れ子ナビゲーション -->
        </nav>
      </div>
    </div>
  </div>
</div>
```

## 🚨 実際のトラブルシューティング事例

### **事例: Google Cloud SDK ドキュメント**
```bash
# URL: https://cloud.google.com/sdk/docs?hl=ja
# 問題: 442ページ検出するも実際のクロールに失敗

# 症状の診断
✅ 分析段階: 100% confidence, 442 pages detected
❌ 実行段階: totalPages: 0, 取得失敗
```

#### **原因分析と対策**

**可能性1: Rate Limiting / Bot Protection**
```bash
# 対策: User-Agentとrate limitを調整
doc-to-md "URL" --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" --delay 2000
```

**可能性2: JavaScript必須コンテンツ**
```bash
# 対策: ヘッドレスブラウザモード（将来実装）
doc-to-md "URL" --browser-mode --wait-time 5000
```

**可能性3: 地域制限・言語リダイレクト**
```bash
# 対策: 英語版や異なる地域で試行
doc-to-md "https://cloud.google.com/sdk/docs" --enhanced
```

**可能性4: 大規模サイトのメモリ制限**
```bash
# 対策: 並行度を下げて安定性優先
doc-to-md "URL" --performance --concurrent 1 --timeout 120000
```

### **🔧 段階的診断プロセス**

#### **ステップ1: 基本接続確認**
```bash
# サイトに直接アクセス可能か確認
curl -I "https://cloud.google.com/sdk/docs?hl=ja"

# robots.txtをチェック
curl "https://cloud.google.com/robots.txt"
```

#### **ステップ2: 簡単なページで試行**
```bash
# より単純なGoogle Docsページで検証
doc-to-md "https://cloud.google.com/sdk/gcloud" --analyze
```

#### **ステップ3: 代替アプローチ**
```bash
# 1. 英語版を試す
doc-to-md "https://cloud.google.com/sdk/docs" --performance

# 2. 特定のセクションから開始
doc-to-md "https://cloud.google.com/sdk/gcloud/reference" --enhanced

# 3. 手動セレクター指定
doc-to-md "URL" --selector-nav ".devsite-nav" --selector-content ".devsite-article-body"
```

### **📋 よくある大規模サイト問題と解決法**

| サイトタイプ | よくある問題 | 推奨解決法 |
|-------------|-------------|------------|
| Google Docs | Bot保護 | User-Agent変更 + 遅延 |
| Microsoft Docs | JavaScript必須 | Enhanced mode |
| AWS Docs | Rate limiting | 並行度削減 |
| GitHub Docs | 動的ロード | Wait time増加 |

### **🎯 確実な成功のための代替戦略**

```bash
# 戦略1: セクション別分割実行
doc-to-md "https://cloud.google.com/sdk/gcloud" --performance
doc-to-md "https://cloud.google.com/sdk/install" --performance

# 戦略2: より寛容な設定
doc-to-md "URL" --continue-on-error --retry 5 --timeout 180000

# 戦略3: 最小限モード
doc-to-md "URL" --concurrent 1 --no-images --basic
```

## 🛡️ Bot保護（Bot Protection）の詳細解説

### **Bot保護とは？**
Bot保護は、ウェブサイトが**自動化されたプログラム（ボット）の不正アクセスを防ぐ**ために導入するセキュリティ機能です。人間の正常なユーザーとボットを区別し、悪意のあるボットをブロックします。

### **🔍 Bot保護が検出する対象**

#### **悪意のあるボット**
- **スクレイピングボット**: データ大量取得
- **DDoS攻撃ボット**: サーバー負荷攻撃  
- **スパムボット**: 不正コンテンツ投稿
- **価格監視ボット**: 競合他社の自動調査
- **在庫確認ボット**: 商品情報の無断取得

#### **良性のボット（通常は許可）**
- **検索エンジンボット**: Google, Bing等
- **監視ボット**: サイト稼働確認
- **RSS/フィードリーダー**: コンテンツ配信

### **🔧 Bot保護の仕組み**

#### **1. リクエストパターン分析**
```bash
# 人間のアクセスパターン
訪問間隔: ランダム（2-30秒）
クリック順序: 非予測可能
滞在時間: ページ内容に応じて変動

# ボットのアクセスパターン  
訪問間隔: 一定（毎秒、数秒おき）
クリック順序: 体系的・順序立て
滞在時間: 非常に短い（<1秒）
```

#### **2. User-Agent検査**
```bash
# 典型的なボットUser-Agent（ブロック対象）
"Python-requests/2.25.1"
"curl/7.68.0" 
"Doc-to-MD/1.0.0 (Web Documentation Crawler)"  # ← 我々のツール

# 人間ブラウザのUser-Agent（許可）
"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36..."
```

#### **3. JavaScript チャレンジ**
```javascript
// Bot保護の典型的な仕組み
// 1. ページ読み込み時にJavaScriptで暗号化トークン生成
const token = generateCryptoToken();

// 2. そのトークンがないとコンテンツ表示されない
if (!validToken) {
  return "Access Denied";
}

// 3. ボットは通常JavaScriptを実行できないため失敗
```

#### **4. 行動分析**
```bash
# 人間の行動特徴
✅ マウス移動パターン
✅ スクロール速度の変動
✅ タイピング速度・間隔
✅ ページ滞在時間

# ボットの行動特徴  
❌ マウス移動なし
❌ 一定速度のスクロール
❌ タイピングなし
❌ 極短時間滞在
```

### **🌐 主要なBot保護サービス**

#### **Cloudflare Bot Management**
- 最も普及したBot保護サービス
- JavaScript チャレンジ + 機械学習
- Google, Microsoft, AWS等多くの企業サイトで使用

#### **Google reCAPTCHA**
- "私はロボットではありません"チェックボックス
- 画像認識チャレンジ
- 行動分析による透明認証

#### **AWS WAF (Web Application Firewall)**
- IP/地域ベースのブロック
- レート制限
- カスタムルール設定

### **🚨 Google Cloudサイトの事例分析**

#### **Google Cloud SDKで発生した問題**
```bash
# 症状
✅ 分析段階: 442ページ検出 (HTMLは取得可能)
❌ 実行段階: totalPages: 0 (コンテンツアクセス拒否)

# 原因: CloudflareによるBot検出
1. User-Agent "Doc-to-MD/1.0.0" → 明らかにボット
2. 高速連続アクセス → 非人間的パターン  
3. JavaScript未実行 → チャレンジ失敗
```

#### **段階的保護レベル**
```bash
# レベル1: 基本情報 (許可)
curl -I "https://cloud.google.com/sdk/docs"  # ✅ 成功

# レベル2: HTML構造 (条件付き許可)
curl "https://cloud.google.com/sdk/docs"     # ✅ 成功 

# レベル3: 実際のコンテンツ (厳格な保護)
doc-to-md → JavaScript Challenge → ❌ 失敗
```

### **🔧 Bot保護の回避・対処方法**

#### **方法1: 人間ブラウザの模倣**
```bash
# User-Agentを本物のブラウザに変更
doc-to-md "URL" \
  --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# より詳細なヘッダー設定
doc-to-md "URL" \
  --headers "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \
  --headers "Accept-Language: ja,en-US;q=0.7,en;q=0.3" \
  --headers "Accept-Encoding: gzip, deflate, br"
```

#### **方法2: アクセス速度の調整**
```bash
# 人間らしい間隔でアクセス
doc-to-md "URL" \
  --delay 3000 \          # 3秒間隔
  --random-delay \        # ランダム遅延
  --concurrent 1          # 並行アクセス数を1に制限
```

#### **方法3: JavaScript実行環境**
```bash
# ヘッドレスブラウザ使用（将来実装予定）
doc-to-md "URL" \
  --browser-mode \        # Puppeteer/Playwright使用
  --wait-time 5000 \      # JavaScript実行待機
  --viewport 1920x1080    # 本物のブラウザサイズ
```

#### **方法4: プロキシ・IP分散**
```bash
# 複数IPを使用してアクセス分散
doc-to-md "URL" \
  --proxy "http://proxy1.example.com:8080" \
  --rotate-proxy          # プロキシローテーション
```

### **🎯 実際の対処例**

#### **Google Cloud SDK の場合**
```bash
# 問題: CloudflareによるBot保護
# 解決策1: より人間らしいアクセス
doc-to-md "https://cloud.google.com/sdk/docs" \
  --user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36..." \
  --delay 5000 \
  --concurrent 1 \
  --timeout 180000

# 解決策2: セクション別分割アクセス
doc-to-md "https://cloud.google.com/sdk/gcloud/reference" --enhanced
doc-to-md "https://cloud.google.com/sdk/install" --enhanced

# 解決策3: 手動ブラウザでのアクセス確認
open "https://cloud.google.com/sdk/docs"
# → コンテンツを確認 → CSSセレクターを手動特定
```

### **⚖️ 倫理的・法的考慮事項**

#### **✅ 適切なBot利用**
- **robots.txt の遵守**: サイトのルール確認
- **適度なアクセス頻度**: サーバー負荷を考慮
- **個人利用・研究目的**: 商用利用は慎重に
- **公開ドキュメント**: アクセス権のある情報のみ

#### **❌ 避けるべき行為**
- **robots.txt無視**: 明示的な禁止を無視
- **過度なアクセス**: DDoS攻撃相当の負荷
- **商用データ窃取**: 著作権・利用規約違反
- **認証回避**: 不正アクセス行為

### **🔍 robots.txt の確認方法**

```bash
# サイトのボットルール確認
curl "https://cloud.google.com/robots.txt"

# 典型的なrobots.txt例
User-agent: *
Disallow: /admin/
Disallow: /private/
Allow: /docs/
Crawl-delay: 10

# Disallow対象は避ける、Crawl-delayは遵守
```

### **📊 Bot保護の強度レベル**

```
保護レベル    対象サイト例              対策の困難度
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
レベル1       個人ブログ、小規模サイト   ✅ 簡単
レベル2       中規模企業サイト           🔸 中程度  
レベル3       GitHub、Stack Overflow     🔸 やや困難
レベル4       Google、Microsoft、AWS     ❌ 困難
レベル5       金融、政府機関             ❌ ほぼ不可能
```
