#!/usr/bin/env node
/**
 * Real-world Documentation Sites Testing Script
 * Tests doc-to-md against various popular documentation sites
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_SITES = [
  {
    name: 'Vue.js Documentation',
    url: 'https://vuejs.org/guide/',
    expectedComplexity: 'complex',
    expectedCrawler: 'configurable',
    notes: 'Modern SPA with dynamic navigation'
  },
  {
    name: 'Docker Documentation',
    url: 'https://docs.docker.com/get-started/',
    expectedComplexity: 'moderate',
    expectedCrawler: 'configurable',
    notes: 'Multi-section documentation'
  },
  {
    name: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript',
    expectedComplexity: 'complex',
    expectedCrawler: 'performance',
    notes: 'Extensive hierarchical navigation'
  },
  {
    name: 'Node.js API Documentation',
    url: 'https://nodejs.org/docs/latest/api/',
    expectedComplexity: 'complex',
    expectedCrawler: 'performance',
    notes: 'API reference style'
  },
  {
    name: 'React Documentation',
    url: 'https://react.dev/learn',
    expectedComplexity: 'moderate',
    expectedCrawler: 'format',
    notes: 'Modern tutorial-style documentation'
  },
  {
    name: 'Express.js Documentation',
    url: 'https://expressjs.com/en/starter/installing.html',
    expectedComplexity: 'simple',
    expectedCrawler: 'basic',
    notes: 'Simple traditional documentation'
  }
];

async function testSite(site) {
  return new Promise((resolve, reject) => {
    const command = `doc-to-md "${site.url}" --analyze --verbose`;
    
    console.log(`\n🧪 Testing: ${site.name}`);
    console.log(`📍 URL: ${site.url}`);
    console.log(`📋 Expected: ${site.expectedComplexity} complexity, ${site.expectedCrawler} crawler`);
    console.log(`📝 Notes: ${site.notes}`);
    console.log(`🔧 Command: ${command}\n`);
    
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error testing ${site.name}:`, error.message);
        resolve({ site, success: false, error: error.message });
        return;
      }
      
      // Parse output
      const lines = stdout.split('\n');
      let estimatedPages = 0;
      let complexity = '';
      let recommendedCrawler = '';
      let confidence = 0;
      
      lines.forEach(line => {
        if (line.includes('Estimated pages:')) {
          estimatedPages = parseInt(line.split(':')[1].trim());
        }
        if (line.includes('Complexity:')) {
          complexity = line.split(':')[1].trim();
        }
        if (line.includes('Recommended crawler:')) {
          recommendedCrawler = line.split(':')[1].trim();
        }
        if (line.includes('Confidence:')) {
          confidence = parseFloat(line.split(':')[1].replace('%', '').trim());
        }
      });
      
      const result = {
        site,
        success: true,
        results: {
          estimatedPages,
          complexity,
          recommendedCrawler,
          confidence,
          matchesExpected: {
            complexity: complexity === site.expectedComplexity,
            crawler: recommendedCrawler === site.expectedCrawler
          }
        },
        output: stdout
      };
      
      console.log(`✅ Completed: ${site.name}`);
      console.log(`📊 Results: ${estimatedPages} pages, ${complexity} complexity, ${recommendedCrawler} crawler (${confidence}%)`);
      console.log(`🎯 Accuracy: Complexity ${result.results.matchesExpected.complexity ? '✅' : '❌'}, Crawler ${result.results.matchesExpected.crawler ? '✅' : '❌'}\n`);
      
      resolve(result);
    });
  });
}

async function runAllTests() {
  console.log('🚀 Starting Real-world Documentation Sites Testing');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const site of TEST_SITES) {
    try {
      const result = await testSite(site);
      results.push(result);
      
      // Wait a bit between tests to be respectful
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Failed to test ${site.name}:`, error);
    }
  }
  
  // Generate summary report
  console.log('\n📊 TESTING SUMMARY');
  console.log('=' .repeat(60));
  
  const successful = results.filter(r => r.success);
  const complexityAccuracy = successful.filter(r => r.results.matchesExpected.complexity).length;
  const crawlerAccuracy = successful.filter(r => r.results.matchesExpected.crawler).length;
  
  console.log(`✅ Successful tests: ${successful.length}/${results.length}`);
  console.log(`🎯 Complexity prediction accuracy: ${complexityAccuracy}/${successful.length} (${Math.round(complexityAccuracy/successful.length*100)}%)`);
  console.log(`🎯 Crawler recommendation accuracy: ${crawlerAccuracy}/${successful.length} (${Math.round(crawlerAccuracy/successful.length*100)}%)`);
  
  console.log('\n📝 Detailed Results:');
  successful.forEach(result => {
    const { site, results: res } = result;
    console.log(`\n🌐 ${site.name}`);
    console.log(`  📍 URL: ${site.url}`);
    console.log(`  📊 Pages: ${res.estimatedPages}`);
    console.log(`  🔧 Complexity: ${res.complexity} ${res.matchesExpected.complexity ? '✅' : '❌ (expected: ' + site.expectedComplexity + ')'}`);
    console.log(`  🤖 Crawler: ${res.recommendedCrawler} ${res.matchesExpected.crawler ? '✅' : '❌ (expected: ' + site.expectedCrawler + ')'}`);
    console.log(`  📈 Confidence: ${res.confidence}%`);
  });
  
  // Save detailed report
  const reportFile = `real-world-test-report-${Date.now()}.json`;
  fs.writeFileSync(reportFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportFile}`);
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, TEST_SITES };
