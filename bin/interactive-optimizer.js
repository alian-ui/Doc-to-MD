#!/usr/bin/env node

/**
 * Interactive Optimization Tool for Doc-to-MD
 * ユーザーガイド型で100%に近づける最適化ツール
 */

const readline = require('readline');
const { execSync } = require('child_process');
const fs = require('fs');

class InteractiveOptimizer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async optimize(url) {
    console.log('🎯 Doc-to-MD インタラクティブ最適化ツール');
    console.log('============================================');
    
    // Step 1: 事前分析
    console.log('\n📊 Step 1: サイト適性分析中...');
    const analysis = await this.analyzeWebsite(url);
    
    // Step 2: 結果評価とガイダンス
    const strategy = this.determineStrategy(analysis);
    console.log(`\n🎯 推奨戦略: ${strategy.name}`);
    console.log(`📈 期待成功率: ${strategy.successRate}%`);
    
    // Step 3: ユーザー選択
    const proceed = await this.askUser(
      `\n${strategy.description}\n続行しますか？ (y/n): `
    );
    
    if (!proceed) return;
    
    // Step 4: 最適化実行
    await this.executeOptimization(url, strategy);
    
    // Step 5: 結果検証と改善提案
    await this.validateAndImprove(url);
  }

  async analyzeWebsite(url) {
    try {
      const result = execSync(`doc-to-md "${url}" --analyze --verbose`, 
        { encoding: 'utf8' });
      
      return this.parseAnalysisResult(result);
    } catch (error) {
      console.error('分析エラー:', error.message);
      return { confidence: 0, pages: 0, complexity: 'unknown' };
    }
  }

  parseAnalysisResult(output) {
    const confidenceMatch = output.match(/Confidence: ([\d.]+)%/);
    const pagesMatch = output.match(/Estimated pages: (\d+)/);
    const complexityMatch = output.match(/Complexity: (\w+)/);
    
    return {
      confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0,
      pages: pagesMatch ? parseInt(pagesMatch[1]) : 0,
      complexity: complexityMatch ? complexityMatch[1] : 'unknown',
      output
    };
  }

  determineStrategy(analysis) {
    if (analysis.confidence >= 90) {
      return {
        name: '🚀 高速実行',
        successRate: 95,
        description: '✅ 高い成功率が期待できます。標準設定で実行します。',
        command: 'doc-to-md'
      };
    } else if (analysis.confidence >= 70) {
      return {
        name: '🔧 調整実行', 
        successRate: 85,
        description: '⚙️ 設定調整で成功率を向上させます。',
        command: 'doc-to-md --configurable --enhanced'
      };
    } else {
      return {
        name: '🛠️ 手動最適化',
        successRate: 70,
        description: '⚠️ 手動でセレクターを調整する必要があります。',
        command: 'interactive'
      };
    }
  }

  async askUser(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  async executeOptimization(url, strategy) {
    console.log(`\n🚀 実行中: ${strategy.command}...`);
    
    try {
      if (strategy.command === 'interactive') {
        await this.interactiveManualOptimization(url);
      } else {
        const fullCommand = `${strategy.command} "${url}"`;
        console.log(`実行コマンド: ${fullCommand}`);
        execSync(fullCommand, { stdio: 'inherit' });
      }
    } catch (error) {
      console.error('実行エラー:', error.message);
      await this.suggestTroubleshooting(url);
    }
  }

  async interactiveManualOptimization(url) {
    console.log('\n🛠️ 手動最適化モード');
    console.log('サイトを調査して適切なセレクターを見つけます...');
    
    // ブラウザでサイトを開く提案
    const openBrowser = await this.askUser(
      'ブラウザでサイトを開いて調査しますか？ (y/n): '
    );
    
    if (openBrowser) {
      execSync(`open "${url}"`);
      console.log('\n🔍 ブラウザで以下を確認してください:');
      console.log('1. 開発者ツール (F12) を開く');
      console.log('2. ナビゲーション要素を右クリック → "検証"');
      console.log('3. CSS セレクターをメモ (.nav, #menu, etc.)');
    }
    
    // セレクター入力
    const navSelector = await this.askInput(
      '\nナビゲーションセレクター (例: .nav, .sidebar): '
    );
    
    const contentSelector = await this.askInput(
      'コンテンツセレクター (例: main, .content): '
    );
    
    // カスタムコマンド実行
    const customCommand = `doc-to-md "${url}" --selector-nav "${navSelector}" --selector-content "${contentSelector}"`;
    console.log(`\n実行: ${customCommand}`);
    execSync(customCommand, { stdio: 'inherit' });
  }

  async askInput(question) {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }

  async validateAndImprove(url) {
    console.log('\n📊 結果検証中...');
    
    // 出力ファイルの確認
    if (fs.existsSync('unified-output.md')) {
      const stats = fs.statSync('unified-output.md');
      const lineCount = fs.readFileSync('unified-output.md', 'utf8').split('\n').length;
      
      console.log(`📄 生成ファイル: unified-output.md`);
      console.log(`📏 サイズ: ${Math.round(stats.size / 1024)}KB`);
      console.log(`📝 行数: ${lineCount}`);
      
      if (lineCount > 100) {
        console.log('✅ 良好な結果が得られました！');
      } else {
        console.log('⚠️ 内容が少ない可能性があります。');
        await this.suggestImprovements();
      }
    } else {
      console.log('❌ 出力ファイルが見つかりません。');
      await this.suggestTroubleshooting(url);
    }
    
    this.rl.close();
  }

  async suggestImprovements() {
    console.log('\n💡 改善提案:');
    console.log('1. より広範囲なセレクターを試す');
    console.log('2. --enhanced オプションで動的コンテンツ対応');
    console.log('3. --timeout 30000 でタイムアウト延長');
  }

  async suggestTroubleshooting(url) {
    console.log('\n🔧 トラブルシューティング:');
    console.log('1. サイトがアクセス可能か確認');
    console.log('2. JavaScript必須サイトの場合は --enhanced 使用');
    console.log('3. 認証が必要な場合は事前ログイン');
    console.log(`4. 手動でのブラウザ確認: ${url}`);
  }
}

// CLI実行
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.log('使用法: node interactive-optimizer.js <URL>');
    process.exit(1);
  }
  
  const optimizer = new InteractiveOptimizer();
  optimizer.optimize(url).catch(console.error);
}

module.exports = InteractiveOptimizer;
