# Doc-to-MD 開発ガイドライン

## 🎯 開発環境の使用方法

### 1. **ローカル開発でのコマンド実行**

#### **A. 推奨：npm scriptsを使用**
```bash
# 基本的なdoc-to-md実行（推奨）
npm run dev -- "https://example.com" --verbose

# 各クローラーの個別実行
npm run dev:unified -- "https://example.com" --analyze
npm run dev:configurable -- "https://example.com" --verbose
npm run dev:performance -- "https://example.com" --concurrent 3
npm run dev:format -- "https://example.com" --include-toc
npm run dev:enhanced -- "https://example.com" --retry 5
```

#### **B. 直接実行（明示的な方法）**
```bash
# TypeScript直接実行（開発時の推奨）
npm run start-unified -- "https://example.com"

# JavaScript直接実行（デバッグ時）
node bin/doc-to-md.js "https://example.com"
node bin/unified.js "https://example.com"
node bin/configurable.js "https://example.com"
```

#### **C. 避けるべき方法**
```bash
# ❌ グローバルコマンドは開発時は使用しない
doc-to-md "https://example.com"          # 予期しない動作の可能性
doc-to-md-unified "https://example.com"  # 同上
```

### 2. **開発フェーズ別の使用方法**

#### **Phase 1: 新機能開発**
```bash
# TypeScript開発環境で実行
npm run start-unified -- "https://test-site.com" --verbose

# 変更をリアルタイムで確認
npm run build && npm run dev -- "https://test-site.com"
```

#### **Phase 2: 機能テスト**
```bash
# JavaScript版での動作確認
npm run dev:unified -- "https://test-site.com" --analyze
npm run dev:configurable -- "https://test-site.com" --dry
```

#### **Phase 3: 統合テスト**
```bash
# 全クローラーでのテスト
npm run dev:unified -- "https://vue.js.org/"
npm run dev:configurable -- "https://react.dev/"
npm run dev:performance -- "https://docs.docker.com/"
```

#### **Phase 4: リリース前テスト**
```bash
# グローバルインストールでの最終テスト
npm run global:install
doc-to-md "https://production-site.com"
npm run global:uninstall  # テスト後はアンインストール
```

## 🔧 開発環境の設定

### 1. **必須の環境変数**
```bash
# 開発モード識別用
export DOC_TO_MD_DEV=true

# デバッグレベル設定
export DOC_TO_MD_DEBUG=verbose
```

### 2. **エイリアス設定（オプション）**
```bash
# ~/.bashrc または ~/.zshrc に追加
alias doc-dev='npm run dev --'
alias doc-dev-unified='npm run dev:unified --'
alias doc-dev-config='npm run dev:configurable --'

# 使用例
doc-dev "https://example.com" --verbose
```

### 3. **VS Code設定**
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "npm.scriptExplorerAction": "run",
  "terminal.integrated.env.osx": {
    "DOC_TO_MD_DEV": "true"
  }
}
```

## 🧪 テスト戦略

### 1. **単体テスト**
```bash
# 個別コンポーネントテスト
npm run test-configurable
npm run test-performance
npm run test-format
npm run test-unified

# 全体テスト
npm test
```

### 2. **統合テスト**
```bash
# 実際のサイトでのテスト
npm run dev:unified -- "https://vue.js.org/" --analyze
npm run dev:configurable -- "https://react.dev/" --verbose
npm run dev:performance -- "https://docs.docker.com/" --dry
```

### 3. **リグレッションテスト**
```bash
# 既知の成功サイトでのテスト
npm run dev -- "https://marpit.marp.app/" --verbose
npm run dev -- "https://tailwindcss.com/" --configurable
```

## 🚀 デプロイメントとリリース

### 1. **バージョン管理**
```bash
# 開発版
"version": "2.2.0-dev"        # 開発中
"version": "2.2.0-alpha.1"    # アルファ版
"version": "2.2.0-beta.1"     # ベータ版
"version": "2.2.0-rc.1"       # リリース候補
"version": "2.2.0"            # 正式リリース
```

### 2. **リリース前チェックリスト**
```bash
# 1. ビルド確認
npm run build

# 2. 全テスト実行
npm test

# 3. 実際のサイトでのテスト
npm run dev -- "https://vue.js.org/" --verbose
npm run dev -- "https://react.dev/" --verbose
npm run dev -- "https://docs.docker.com/" --verbose

# 4. グローバルインストールテスト
npm run global:install
doc-to-md "https://example.com"
npm run global:uninstall

# 5. パッケージングテスト
npm pack
```

### 3. **リリース手順**
```bash
# 1. バージョン更新
npm version patch  # 2.2.0-dev → 2.2.0

# 2. 最終ビルド
npm run build

# 3. リリース（将来的にnpm publishを使用）
npm run global:install  # ローカルテスト用
```

## 🔍 デバッグとトラブルシューティング

### 1. **詳細ログの有効化**
```bash
# 最大レベルのデバッグ情報
npm run dev -- "https://example.com" --verbose

# 分析のみ実行
npm run dev -- "https://example.com" --analyze --verbose
```

### 2. **問題の特定**
```bash
# 段階的デバッグ
npm run dev -- "https://example.com" --analyze     # 1. 分析段階
npm run dev -- "https://example.com" --dry         # 2. 実行準備
npm run dev -- "https://example.com" --verbose     # 3. 実際の実行
```

### 3. **エラーハンドリング**
```bash
# 継続実行モード
npm run dev -- "https://example.com" --continue-on-error

# リトライ設定
npm run dev -- "https://example.com" --retry 5 --timeout 30000
```

## 📊 パフォーマンス監視

### 1. **実行時間測定**
```bash
# 時間測定付き実行
time npm run dev -- "https://example.com"

# 詳細統計
npm run dev -- "https://example.com" --verbose | grep -E "(Statistics|time|pages)"
```

### 2. **メモリ使用量監視**
```bash
# Node.jsメモリ使用量
node --inspect bin/doc-to-md.js "https://example.com"

# システムリソース監視
npm run dev -- "https://example.com" --verbose &
top -p $!
```

## 🛡️ セキュリティとベストプラクティス

### 1. **安全な開発環境**
```bash
# 開発時は明示的なローカル実行
npm run dev -- "https://example.com"

# 重要なサイトのテスト前は確認
npm run dev -- "https://important-site.com" --analyze --dry
```

### 2. **環境分離**
```bash
# 開発環境と本番環境の分離
if [[ "$DOC_TO_MD_DEV" == "true" ]]; then
  alias doc-to-md="npm run dev --"
fi
```

### 3. **データ保護**
```bash
# 一時ファイルの適切な管理
npm run dev -- "https://example.com" --output "temp-$(date +%s).md"

# 機密情報を含む可能性のあるサイトは注意
npm run dev -- "https://internal-site.com" --dry --verbose
```

## 🎯 推奨されるワークフロー

### 1. **日常的な開発**
```bash
# 1. 機能開発
npm run start-unified -- "https://test-site.com"

# 2. ビルドと確認
npm run build
npm run dev -- "https://test-site.com"

# 3. テスト
npm run test-unified
```

### 2. **新機能の追加**
```bash
# 1. 分析から開始
npm run dev -- "https://new-site.com" --analyze --verbose

# 2. 段階的実装
npm run dev -- "https://new-site.com" --dry --verbose
npm run dev -- "https://new-site.com" --verbose

# 3. 統合テスト
npm run dev:unified -- "https://new-site.com"
npm run dev:configurable -- "https://new-site.com"
```

### 3. **バグ修正**
```bash
# 1. 問題の再現
npm run dev -- "https://problematic-site.com" --verbose

# 2. 修正の確認
npm run dev -- "https://problematic-site.com" --analyze
npm run dev -- "https://problematic-site.com" --dry

# 3. 修正の検証
npm run dev -- "https://problematic-site.com"
```

## 🔗 関連リソース

### 1. **ドキュメント**
- [README.md](./README.md) - 基本的な使用方法
- [DOCUMENTATION.md](./DOCUMENTATION.md) - 詳細なAPI仕様
- [TROUBLESHOOTING.md](./troubleshooting-guide.md) - トラブルシューティング

### 2. **設定ファイル**
- [tsconfig.json](./tsconfig.json) - TypeScript設定
- [jest.config.js](./jest.config.js) - テスト設定
- [package.json](./package.json) - プロジェクト設定

### 3. **実行例**
```bash
# 成功例
npm run dev -- "https://vue.js.org/" --verbose
npm run dev -- "https://react.dev/" --verbose
npm run dev -- "https://marpit.marp.app/" --verbose

# 複雑な例
npm run dev -- "https://docs.docker.com/" --configurable --timeout 30000
```

---

## 🚨 重要な注意事項

1. **開発時は必ず `npm run dev` を使用**
2. **グローバルコマンドは最終テスト時のみ使用**
3. **重要なサイトでは事前に `--analyze` と `--dry` を使用**
4. **環境変数 `DOC_TO_MD_DEV=true` を設定**
5. **定期的に `npm run global:update` でグローバル版を更新**

これらのガイドラインに従うことで、安全で効率的な開発環境を維持できます。
