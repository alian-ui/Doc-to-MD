# Doc-to-MD トラブルシューティングガイド

## 🚨 よくあるエラーと解決法

### **1. シェルエラー: "no matches found"**
```bash
# ❌ 問題のあるコマンド
doc-to-md https://site.com?param=value

# ✅ 解決法: URLを引用符で囲む
doc-to-md "https://site.com?param=value"
```

### **2. オプション名エラー**
```bash
# ❌ 間違ったオプション
--enhances    # ✅ 正: --enhanced
--analyse     # ✅ 正: --analyze  
--verbos      # ✅ 正: --verbose
```

### **3. 大規模サイトでのクロール失敗**
```bash
# 症状: 分析成功 → 実行失敗
# 原因: Bot保護、Rate limiting、メモリ不足

# 解決策1: 設定を保守的に
doc-to-md "URL" --concurrent 1 --timeout 180000

# 解決策2: User-Agent変更
doc-to-md "URL" --user-agent "Mozilla/5.0..."

# 解決策3: セクション別分割
doc-to-md "URL/section1" --performance
doc-to-md "URL/section2" --performance
```

### **4. JavaScript必須サイト**
```bash
# 症状: "totalPages: 0" または空のコンテンツ
# 解決策: Enhanced mode
doc-to-md "URL" --enhanced --wait-time 5000
```

### **5. タイムアウト問題**
```bash
# 解決策: タイムアウト延長 + リトライ増加
doc-to-md "URL" --timeout 120000 --retry 5
```

## 🎯 サイト別推奨アプローチ

### **企業技術文書 (Google, Microsoft, AWS)**
```bash
# 1. まず小さなセクションで試行
doc-to-md "https://docs.company.com/specific-page" --analyze

# 2. 保守的設定で実行
doc-to-md "URL" --performance --concurrent 1 --timeout 120000
```

### **オープンソース文書 (React, Vue, Docker)**
```bash
# 通常の設定で成功率高
doc-to-md "URL" --configurable --enhanced
```

### **カスタム/不明サイト**
```bash
# 段階的アプローチ
doc-to-md "URL" --analyze --verbose
# → 結果に基づいて最適化
```

## 🔧 デバッグ用コマンド

```bash
# 詳細ログで問題特定
doc-to-md "URL" --analyze --verbose

# ネットワーク接続確認
curl -I "URL"

# robots.txt確認
curl "https://domain.com/robots.txt"

# セレクター手動確認
doc-to-md "URL" --selector-nav "発見したセレクター" --dry-run
```

## 🚨 **実世界での失敗パターンと対策**

### **パターン4: JavaScript重厚サイト (SPA/Framework)**

#### **症状**
- ✅ 分析段階: 50-80%信頼度で「成功」判定
- ✅ セレクター発見: `.toc`, `.content`など正常識別
- ❌ 実行段階: 全クローラーで`Crawl failed`

#### **具体例: AxiDraw CLI API**
```bash
URL: https://axidraw.com/doc/cli_api/
分析結果: 70% confidence, 50 pages, configurable推奨
実行結果: ❌ "Crawl failed" - 0 pages extracted

# 問題の根本原因
curl -s "https://axidraw.com/doc/cli_api/" | grep -c "script"
# → 15+ JavaScript files (Slate framework)
```

#### **原因診断**
```bash
# 1. フレームワーク確認
curl -s "URL" | grep -i "slate\|react\|vue\|angular"

# 2. 静的コンテンツ密度
HTML_SIZE=$(curl -s "URL" | wc -c)
CONTENT_LINES=$(curl -s "URL" | grep -o "<p>" | wc -l)
echo "HTML: ${HTML_SIZE}bytes, Content: ${CONTENT_LINES}lines"
# 比率が悪い → JavaScript生成コンテンツ

# 3. ナビゲーション構造
curl -s "URL" | grep -o "href=\"#[^\"]*\"" | head -5
# Fragment navigation → SPA routing
```

#### **推奨対策**
```bash
# 対策1: 分析段階での早期検出
doc-to-md "URL" --analyze --verbose
# confidence < 75% → 手動対応推奨

# 対策2: ブラウザ手動変換
# 1. ブラウザでサイト開く
# 2. 全選択 (Cmd+A) 
# 3. 適切なMarkdown変換ツール使用

# 対策3: セクション別個別取得
# 重要なセクションのみ手動で
```

#### **将来対応**
```typescript
// v2.2.0で実装予定
interface BrowserModeConfig {
  enabled: boolean;
  waitTime: number;        // 5000ms推奨
  renderTimeout: number;   // 30000ms上限
  scrollBehavior: 'auto' | 'smooth' | 'disabled';
}
```

### **🎯 解決済み事例: AxiDraw CLI API (Slate Framework)**

#### **最終診断結果**
```bash
✅ サイトアクセス: HTTP 200, 163KB HTML
✅ コンテンツ発見: .content クラスに完全なドキュメント
✅ 手動抽出成功: curl で直接取得可能
❌ ツール実行失敗: ナビゲーションリンク0件 → 処理ページ0件
```

#### **根本原因: Slateフレームワークの特殊な構造**
```bash
# 問題の詳細分析
curl -s "https://axidraw.com/doc/cli_api/" | grep -c "script"
# → 15+ JavaScript files

curl -s "https://axidraw.com/doc/cli_api/" | grep -o 'href="#[^"]*"'
# → Fragment navigation (#introduction, #installation, etc.)

# しかし: configurableクローラーは同ドメインリンクを期待
# 実際: Fragment navigation のみでページ間リンクなし
```

#### **即座に使える回避策**

**方法1: 手動抽出 (最も確実)**
```bash
# 1. curlでコンテンツを直接取得
curl -s "https://axidraw.com/doc/cli_api/" | 
grep -A 100000 '<div class="content">' | 
grep -B 100000 '</div>' > axidraw-raw.html

# 2. HTMLからMarkdownに変換 (Pandoc使用)
pandoc axidraw-raw.html -f html -t markdown -o axidraw-docs.md
```

**方法2: ブラウザ拡張活用**
- **MarkDownload**: Chrome/Edge拡張
- **Web Clipper**: Notion用
- **SingleFile**: 完全なページ保存

#### **ツール改善の優先度**

**v2.2.0 実装予定**
1. **Fragment navigation 対応**: `#anchor` リンクの処理
2. **Single-page フォールバック**: ナビゲーション失敗時の自動切り替え
3. **Framework検出**: Slate/GitBook/Docsifyの自動識別

#### **現実的な期待値調整**

```
サイトタイプ              従来予測    実測値    推奨対応
──────────────────────────────────────────────────────
Slate Documentation       70-80%     25-35%    手動抽出
GitBook v2/v3             65-75%     30-40%    ブラウザ拡張
Docsify SPA               60-70%     20-30%    将来機能待ち
```

#### **成功判定の新基準**

**Phase 1: 事前チェック**
```bash
if confidence < 75% && javascript_count > 10:
    recommend_manual_extraction()
```

**Phase 2: 実行時フォールバック**
```bash
if navigation_links == 0:
    attempt_single_page_extraction()
```

この事例により、**80%測定成功率**の透明性と、**複雑なサイトでの限界**が明確に実証されました。
