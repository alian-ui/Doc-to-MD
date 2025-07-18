#!/bin/bash

# Doc-to-MD Development Environment Setup
# Source this file in your shell profile: source ./scripts/dev-setup.sh

echo "🚀 Setting up Doc-to-MD development environment..."

# 環境変数の設定
export DOC_TO_MD_DEV=true
export DOC_TO_MD_DEBUG=verbose

# 開発用エイリアス
alias doc-dev='npm run dev --'
alias doc-dev-unified='npm run dev:unified --'
alias doc-dev-config='npm run dev:configurable --'
alias doc-dev-performance='npm run dev:performance --'
alias doc-dev-format='npm run dev:format --'
alias doc-dev-enhanced='npm run dev:enhanced --'

# 便利なエイリアス
alias doc-analyze='npm run dev -- --analyze --verbose'
alias doc-dry='npm run dev -- --dry --verbose'
alias doc-test='npm run dev -- --analyze --dry --verbose'

# グローバル管理用エイリアス
alias doc-global-install='npm run global:install'
alias doc-global-uninstall='npm run global:uninstall'
alias doc-global-update='npm run global:update'

# 開発用テストサイト
alias doc-test-vue='npm run dev -- "https://vue.js.org/" --verbose'
alias doc-test-react='npm run dev -- "https://react.dev/" --verbose'
alias doc-test-marpit='npm run dev -- "https://marpit.marp.app/" --verbose'
alias doc-test-docker='npm run dev -- "https://docs.docker.com/" --verbose'

# 開発用関数
doc-dev-help() {
    echo "📋 Doc-to-MD Development Commands:"
    echo ""
    echo "🔧 Basic Development:"
    echo "  doc-dev [URL]              - Run development version"
    echo "  doc-dev-unified [URL]      - Run unified crawler"
    echo "  doc-dev-config [URL]       - Run configurable crawler"
    echo "  doc-analyze [URL]          - Analyze website only"
    echo "  doc-dry [URL]              - Dry run (no files created)"
    echo "  doc-test [URL]             - Full analysis + dry run"
    echo ""
    echo "🧪 Test Sites:"
    echo "  doc-test-vue              - Test with Vue.js docs"
    echo "  doc-test-react            - Test with React docs"
    echo "  doc-test-marpit           - Test with Marpit docs"
    echo "  doc-test-docker           - Test with Docker docs"
    echo ""
    echo "🌐 Global Management:"
    echo "  doc-global-install        - Install globally"
    echo "  doc-global-uninstall      - Uninstall globally"
    echo "  doc-global-update         - Update global version"
    echo ""
    echo "📖 More help: cat DEVELOPMENT-GUIDE.md"
}

# 開発者向けの便利な関数
doc-dev-analyze() {
    if [[ -z "$1" ]]; then
        echo "❌ Usage: doc-dev-analyze [URL]"
        echo "   Example: doc-dev-analyze https://example.com"
        return 1
    fi
    
    echo "🔍 Analyzing $1..."
    npm run dev -- "$1" --analyze --verbose
}

doc-dev-test() {
    if [[ -z "$1" ]]; then
        echo "❌ Usage: doc-dev-test [URL]"
        echo "   Example: doc-dev-test https://example.com"
        return 1
    fi
    
    echo "🧪 Testing $1..."
    echo "1. Analysis phase..."
    npm run dev -- "$1" --analyze --verbose
    
    echo ""
    echo "2. Dry run phase..."
    npm run dev -- "$1" --dry --verbose
    
    echo ""
    echo "✅ Test completed. Ready for actual execution:"
    echo "   npm run dev -- \"$1\" --verbose"
}

doc-dev-full-test() {
    if [[ -z "$1" ]]; then
        echo "❌ Usage: doc-dev-full-test [URL]"
        echo "   Example: doc-dev-full-test https://example.com"
        return 1
    fi
    
    echo "🚀 Full test of $1 with all crawlers..."
    
    echo "1. Unified crawler..."
    npm run dev:unified -- "$1" --analyze
    
    echo ""
    echo "2. Configurable crawler..."
    npm run dev:configurable -- "$1" --analyze
    
    echo ""
    echo "3. Performance crawler..."
    npm run dev:performance -- "$1" --analyze
    
    echo ""
    echo "4. Format crawler..."
    npm run dev:format -- "$1" --analyze
    
    echo ""
    echo "✅ Full analysis completed."
}

# 現在の開発環境状態を表示
doc-dev-status() {
    echo "📊 Doc-to-MD Development Environment Status:"
    echo ""
    echo "Environment Variables:"
    echo "  DOC_TO_MD_DEV: $DOC_TO_MD_DEV"
    echo "  DOC_TO_MD_DEBUG: $DOC_TO_MD_DEBUG"
    echo ""
    echo "Current Version:"
    echo "  Local: $(npm run dev -- --version 2>/dev/null || echo 'Not available')"
    echo "  Global: $(doc-to-md --version 2>/dev/null || echo 'Not installed')"
    echo ""
    echo "Available Commands:"
    echo "  Type 'doc-dev-help' for full command list"
}

# セットアップ完了メッセージ
echo "✅ Doc-to-MD development environment ready!"
echo ""
echo "🎯 Quick Start:"
echo "  doc-dev-help                    - Show all commands"
echo "  doc-dev-status                  - Show current status"
echo "  doc-dev [URL] --verbose         - Run development version"
echo "  doc-analyze [URL]               - Analyze website only"
echo "  doc-test-vue                    - Test with Vue.js docs"
echo ""
echo "📖 Full guide: cat DEVELOPMENT-GUIDE.md"
