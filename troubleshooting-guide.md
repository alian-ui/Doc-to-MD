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
