# 「95%サイトで動く」の数字の根拠分析

## 📊 推定値の構成要素

### **実際のテスト結果から**
```bash
# 実証済みサイト (100%成功)
✅ Vue.js (74ページ) - Confidence: 100.0%
✅ React (59ページ) - Confidence: 100.0%  
✅ Tailscale KB (5ページ) - 成功事例
✅ Docker Docs (38ページ) - Confidence: 90.0%

# 失敗サイト
❌ Google Cloud SDK (442ページ) - Bot保護で失敗
❌ Microsoft Docs (推定) - 高度なBot保護
```

### **推定の内訳**

#### **成功率高 (Tier 1-2): 約30-40%のサイト**
- メジャーフレームワーク公式サイト
- オープンソースプロジェクト
- 標準的なSSG (Jekyll, Hugo, Gatsby)
- **期待成功率**: 95-100%

#### **成功率中 (Tier 3): 約40-50%のサイト**  
- 中小企業の技術文書
- GitHub Pages
- カスタムドキュメントサイト
- **期待成功率**: 80-90%

#### **成功率低 (Tier 4): 約15-20%のサイト**
- 大企業サイト (Google, Microsoft, AWS)
- 高度なBot保護サイト
- JavaScript重厚なSPA
- **期待成功率**: 50-70%

#### **成功困難 (Tier 5): 約5-10%のサイト**
- 金融機関、政府機関
- 認証必須サイト  
- 特殊技術 (Flash, PDF等)
- **期待成功率**: 10-30%

### **加重平均計算**
```
総合成功率 = 
  (30% × 97.5%) +  # Tier 1-2
  (45% × 85%) +    # Tier 3  
  (20% × 60%) +    # Tier 4
  (5% × 20%)       # Tier 5
  
= 29.25% + 38.25% + 12% + 1%
= 80.5%

# 最適化・調整後の推定
最適化後成功率 = 80.5% + 15% = 95.5%
```

## ⚠️ **推定値の限界と注意点**

### **サンプル数の不足**
- **実測サイト数**: ~10サイト
- **推定対象**: 数百万のドキュメントサイト
- **サンプル率**: <0.001% (統計的に不十分)

### **選択バイアス**
- テスト対象が有名サイトに偏重
- 成功しやすいサイトを優先的にテスト
- 失敗サイトの詳細分析が不十分

### **技術環境の変化**
- Bot保護技術の急速進歩
- 新しいフレームワークの登場
- セキュリティ要件の厳格化

## 🎯 **より正確な推定のための提案**

### **実証的データ収集計画**
```bash
# Phase 1: サンプル拡大 (100サイト)
- 各カテゴリから無作為抽出
- 成功/失敗の詳細記録
- 失敗原因の分類

# Phase 2: ユーザーフィードバック収集
- GitHub Issues での報告
- 成功/失敗事例の収集
- コミュニティからの改善提案

# Phase 3: 継続的監視
- 定期的な再テスト
- 成功率の経時変化追跡
- 新技術・新サイトへの対応
```

### **現実的な表現への修正**
```bash
# 現在の表現 (推定ベース)
❌ "95%のサイトで成功"

# より正確な表現  
✅ "テスト済みサイトの80-90%で成功"
✅ "一般的なドキュメントサイトで高い成功率"
✅ "メジャーフレームワークで95%以上の成功率"
```

## 📋 **修正された現実的な成功率表現**

### **✅ 正確な表現**
```bash
# ❌ 過大表現
"95%のサイトで動作"

# ✅ 実証ベース  
"テスト済みの主要フレームワークサイトで80-100%の成功率"
"React, Vue等のメジャーサイトで確実に動作"
"一般的なドキュメントサイトで高い成功率を期待"

# ✅ 条件付き表現
"適切な設定により多くのサイトで成功可能"
"Bot保護のない標準的サイトで高い成功率"
"ユーザー調整込みで90%以上の実用性"
```

### **🎯 今後の実証計画**
```bash
# Phase 1: データ収集拡大
- 50サイトでの体系的テスト
- 各カテゴリからの無作為抽出
- 成功/失敗の詳細記録

# Phase 2: コミュニティフィードバック
- GitHub Issues での報告収集
- ユーザー投稿による成功事例
- 失敗ケースの分析と改善

# Phase 3: 継続的更新
- 四半期ごとの成功率測定
- 新技術・新サイトへの対応
- 統計的に有意なデータ蓄積
```

### **📊 現実的な期待値設定**
```
サイトカテゴリ       実証済み成功率    推定成功率
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
メジャーフレームワーク    100% (4/4)      95-100%
オープンソース文書        データなし       85-95%
企業技術文書             0% (0/1)        60-80%
カスタムサイト           データなし       70-85%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
総合                    80% (4/5)       80-90%
```
