#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  DocToMdConfig, 
  loadConfigFromFile, 
  mergeConfigs, 
  validateConfig,
  getConfigSummary,
  DEFAULT_CONFIG 
} from './config';
import { 
  HighPerformanceCrawler, 
  PerformanceMetrics,
  StreamingOptions,
  CacheOptions,
  OptimizationOptions 
} from './performance-core';
import { ConfigurablePageResult } from './configurable-core';

interface PerformanceCliOptions {
  'nav-selector': string;
  'content-selector': string;
  output: string;
  'output-dir': string;
  'download-images': boolean;
  concurrency: number;
  config: string;
  verbose: boolean;
  'dry-run': boolean;
  
  // Performance options
  'batch-size': number;
  'max-memory': number;
  'enable-streaming': boolean;
  'enable-cache': boolean;
  'cache-ttl': number;
  'chunk-size': number;
  'enable-compression': boolean;
  'enable-deduplication': boolean;
  'prefetch-enabled': boolean;
  'max-concurrent-images': number;
  
  // Monitoring options
  'performance-report': boolean;
  'memory-monitor': boolean;
  'export-metrics': string;
  'real-time-stats': boolean;
  
  _: (string | number)[];
  $0: string;
}

// Performance monitoring utilities
class PerformanceMonitor {
  private startTime: number = Date.now();
  private pageCount: number = 0;
  private errorCount: number = 0;
  private memorySnapshots: Array<{ time: number; memory: number }> = [];
  private isMonitoring: boolean = false;
  private monitorInterval?: NodeJS.Timeout;

  start(): void {
    this.isMonitoring = true;
    this.startTime = Date.now();
    
    // Monitor memory usage every 5 seconds
    this.monitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memorySnapshots.push({
        time: Date.now() - this.startTime,
        memory: memUsage.heapUsed / (1024 * 1024) // MB
      });
      
      // Keep only last 100 snapshots
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots.shift();
      }
    }, 5000);
  }

  stop(): void {
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }

  updateStats(successful: boolean): void {
    this.pageCount++;
    if (!successful) {
      this.errorCount++;
    }
  }

  getCurrentStats(): any {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const currentMemory = process.memoryUsage().heapUsed / (1024 * 1024);
    
    return {
      elapsedTime: Math.round(elapsed),
      pagesProcessed: this.pageCount,
      errors: this.errorCount,
      pagesPerSecond: elapsed > 0 ? (this.pageCount / elapsed).toFixed(2) : '0',
      currentMemoryMB: Math.round(currentMemory),
      peakMemoryMB: Math.round(Math.max(...this.memorySnapshots.map(s => s.memory), currentMemory))
    };
  }

  getMemoryHistory(): Array<{ time: number; memory: number }> {
    return [...this.memorySnapshots];
  }
}

// Real-time progress display
class ProgressDisplay {
  private lastUpdate: number = 0;
  private updateInterval: number = 1000; // Update every second

  update(stats: any, force: boolean = false): void {
    const now = Date.now();
    if (!force && now - this.lastUpdate < this.updateInterval) {
      return;
    }

    this.lastUpdate = now;
    
    // Clear line and display stats
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(
      `📊 ${stats.pagesProcessed} pages | ` +
      `⚡ ${stats.pagesPerSecond} p/s | ` +
      `🕐 ${stats.elapsedTime}s | ` +
      `💾 ${stats.currentMemoryMB}MB | ` +
      `❌ ${stats.errors} errors`
    );
  }

  finish(): void {
    process.stdout.write('\n');
  }
}

// Create CLI options from arguments
function createPerformanceConfig(args: PerformanceCliOptions): {
  config: DocToMdConfig;
  streamingOptions: StreamingOptions;
  cacheOptions: CacheOptions;
  optimizationOptions: OptimizationOptions;
} {
  const config: Partial<DocToMdConfig> = {};

  // Basic settings
  if (args['nav-selector']) {
    config.selectors = { 
      ...DEFAULT_CONFIG.selectors, 
      navigation: args['nav-selector'] 
    };
  }
  if (args['content-selector']) {
    config.selectors = { 
      ...DEFAULT_CONFIG.selectors, 
      ...config.selectors, 
      content: args['content-selector'] 
    };
  }

  if (args.output) config.outputFile = args.output;
  if (args['output-dir']) config.outputDir = args['output-dir'];
  if (args['download-images'] !== undefined) config.downloadImages = args['download-images'];
  if (args.concurrency) config.concurrency = args.concurrency;
  if (args.verbose !== undefined) config.verbose = args.verbose;
  if (args['dry-run'] !== undefined) config.dryRun = args['dry-run'];

  const finalConfig = mergeConfigs(DEFAULT_CONFIG, config);

  // Streaming options
  const streamingOptions: StreamingOptions = {
    batchSize: args['batch-size'] || 10,
    flushInterval: 5000,
    maxMemoryMB: args['max-memory'] || 512,
    enableStreaming: args['enable-streaming'] !== false,
    backpressureThreshold: 0.8
  };

  // Cache options
  const cacheOptions: CacheOptions = {
    enabled: args['enable-cache'] !== false,
    maxCacheSize: 1000,
    cacheTTL: args['cache-ttl'] || 3600000,
    persistToDisk: false,
    cacheDirectory: '.cache'
  };

  // Optimization options
  const optimizationOptions: OptimizationOptions = {
    enableCompression: args['enable-compression'] !== false,
    enableDeduplication: args['enable-deduplication'] !== false,
    enableLazyLoading: true,
    enablePrefetching: args['prefetch-enabled'] !== false,
    maxConcurrentImages: args['max-concurrent-images'] || 5,
    chunkedProcessing: true,
    chunkSize: args['chunk-size'] || 50
  };

  return { config: finalConfig, streamingOptions, cacheOptions, optimizationOptions };
}

// Main processing function with performance monitoring
async function processWithPerformanceMonitoring(
  baseUrl: string,
  config: DocToMdConfig,
  streamingOptions: StreamingOptions,
  cacheOptions: CacheOptions,
  optimizationOptions: OptimizationOptions,
  options: {
    performanceReport: boolean;
    memoryMonitor: boolean;
    exportMetrics?: string;
    realTimeStats: boolean;
  }
): Promise<void> {
  const monitor = new PerformanceMonitor();
  const progress = new ProgressDisplay();
  const allResults: ConfigurablePageResult[] = [];

  if (options.memoryMonitor) {
    monitor.start();
  }

  console.log('🚀 Starting high-performance documentation processing...\n');
  console.log(getConfigSummary(config));
  console.log('\n📊 Performance Configuration:');
  console.log(`   Streaming: ${streamingOptions.enableStreaming ? 'Enabled' : 'Disabled'}`);
  console.log(`   Batch Size: ${streamingOptions.batchSize}`);
  console.log(`   Max Memory: ${streamingOptions.maxMemoryMB}MB`);
  console.log(`   Cache: ${cacheOptions.enabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   Chunk Size: ${optimizationOptions.chunkSize}`);
  console.log(`   Deduplication: ${optimizationOptions.enableDeduplication ? 'Enabled' : 'Disabled'}`);
  console.log('');

  try {
    const crawler = new HighPerformanceCrawler(
      config,
      streamingOptions,
      cacheOptions,
      optimizationOptions
    );

    // Set up event listeners for real-time monitoring
    crawler.on('crawlStarted', (data) => {
      console.log(`🎯 Target: ${data.baseUrl}`);
    });

    crawler.on('urlsDiscovered', (data) => {
      console.log(`🔍 Discovered ${data.count} URLs to process`);
    });

    crawler.on('urlsCacheHit', (data) => {
      console.log(`⚡ Cache hit for URL discovery (${data.count} URLs)`);
    });

    crawler.on('chunkStarted', (data) => {
      console.log(`📦 Processing chunk ${data.chunkIndex + 1} (${data.chunkSize} pages)`);
    });

    crawler.on('chunkCompleted', (data) => {
      if (options.realTimeStats) {
        console.log(`✅ Chunk completed: ${data.completed}/${data.total} (${Math.round((data.completed / data.total) * 100)}%) | Memory: ${Math.round(data.memoryUsage)}MB`);
      }
    });

    crawler.on('pageProcessed', (data) => {
      monitor.updateStats(data.status === 'success');
      
      if (options.realTimeStats) {
        progress.update(monitor.getCurrentStats());
      }
    });

    crawler.on('pageCacheHit', (data) => {
      if (config.verbose) {
        console.log(`⚡ Cache hit: ${data.url}`);
      }
    });

    crawler.on('memoryWarning', (data) => {
      console.log(`\n⚠️  Memory warning: ${Math.round(data.current)}MB / ${data.limit}MB`);
    });

    crawler.on('batchReady', (data) => {
      // Collect results for final output
      allResults.push(...data.batch);
      
      if (config.verbose) {
        console.log(`📦 Batch processed: ${data.batch.length} pages`);
      }
    });

    crawler.on('bufferFlushing', (data) => {
      if (config.verbose) {
        console.log(`🔄 Flushing buffer: ${data.batchSize} pages`);
      }
    });

    crawler.on('cacheCleared', (data) => {
      if (config.verbose) {
        console.log(`🧹 Cache cleared: ${data.removedCount} entries`);
      }
    });

    // Start the crawling process
    const metrics = await crawler.crawlWithStreaming(baseUrl);

    if (options.realTimeStats) {
      progress.finish();
    }

    // Generate final output if not dry run
    if (!config.dryRun) {
      console.log('\n📝 Generating final output...');
      await generateOptimizedOutput(allResults, config);
    }

    // Display performance report
    if (options.performanceReport) {
      displayPerformanceReport(metrics, monitor);
    }

    // Export metrics if requested
    if (options.exportMetrics) {
      await exportMetrics(metrics, monitor, options.exportMetrics);
    }

  } catch (error) {
    console.error('\n❌ Processing failed:', error);
    throw error;
  } finally {
    monitor.stop();
  }
}

async function generateOptimizedOutput(results: ConfigurablePageResult[], config: DocToMdConfig): Promise<void> {
  const successful = results.filter(r => r.status === 'success');
  
  if (successful.length === 0) {
    console.log('⚠️  No successful pages to generate output');
    return;
  }

  // Create output directory
  await fs.mkdir(config.outputDir, { recursive: true });

  let output = '';
  
  // Add header with metadata
  output += `# Documentation\n\n`;
  output += `Generated: ${new Date().toISOString()}\n`;
  output += `Total pages: ${successful.length}\n`;
  output += `Failed pages: ${results.length - successful.length}\n\n`;

  // Add table of contents if enabled
  if (config.output.includeToc) {
    output += `## Table of Contents\n\n`;
    successful.forEach((result, index) => {
      if (result.title) {
        const slug = result.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
        output += `${index + 1}. [${result.title}](#${slug})\n`;
      }
    });
    output += '\n---\n\n';
  }

  // Add content with memory-efficient processing
  for (let i = 0; i < successful.length; i++) {
    const result = successful[i];
    if (result.markdown) {
      output += result.markdown;
      if (i < successful.length - 1) {
        output += '\n\n---\n\n';
      }
    }
    
    // Periodic memory check for very large outputs
    if (i % 100 === 0 && global.gc) {
      global.gc();
    }
  }

  const outputPath = path.resolve(config.outputDir, config.outputFile);
  await fs.writeFile(outputPath, output, 'utf-8');
  
  console.log(`✅ Output generated: ${outputPath}`);
  console.log(`📊 Final size: ${(Buffer.byteLength(output, 'utf8') / (1024 * 1024)).toFixed(2)}MB`);
}

function displayPerformanceReport(metrics: PerformanceMetrics, monitor: PerformanceMonitor): void {
  const finalStats = monitor.getCurrentStats();
  
  console.log('\n📊 Performance Report');
  console.log('========================');
  console.log(`⏱️  Total Time: ${finalStats.elapsedTime}s`);
  console.log(`📄 Pages Processed: ${metrics.totalPages}`);
  console.log(`✅ Successful: ${metrics.successfulPages}`);
  console.log(`❌ Failed: ${metrics.failedPages}`);
  console.log(`⚡ Throughput: ${metrics.throughputPagesPerSecond.toFixed(2)} pages/second`);
  console.log(`📊 Average Page Size: ${(metrics.averagePageSize / 1024).toFixed(2)}KB`);
  console.log(`🎯 Success Rate: ${((metrics.successfulPages / metrics.totalPages) * 100).toFixed(1)}%`);
  console.log(`💾 Peak Memory: ${Math.round(metrics.peakMemoryUsage)}MB`);
  console.log(`📈 Total Data: ${(metrics.totalBytes / (1024 * 1024)).toFixed(2)}MB`);

  if (Object.keys(metrics.errorDistribution).length > 0) {
    console.log('\n❌ Error Distribution:');
    Object.entries(metrics.errorDistribution).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  }

  if (metrics.slowestPages.length > 0) {
    console.log('\n🐌 Slowest Pages (top 5):');
    metrics.slowestPages.slice(0, 5).forEach((page, index) => {
      console.log(`   ${index + 1}. ${page.url} (${Math.round(page.processingTime)}ms)`);
    });
  }

  if (metrics.largestPages.length > 0) {
    console.log('\n📏 Largest Pages (top 5):');
    metrics.largestPages.slice(0, 5).forEach((page, index) => {
      console.log(`   ${index + 1}. ${page.url} (${(page.size / 1024).toFixed(2)}KB)`);
    });
  }
}

async function exportMetrics(metrics: PerformanceMetrics, monitor: PerformanceMonitor, exportPath: string): Promise<void> {
  const exportData = {
    metrics,
    systemStats: monitor.getCurrentStats(),
    memoryHistory: monitor.getMemoryHistory(),
    exportedAt: new Date().toISOString()
  };

  await fs.writeFile(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`📊 Metrics exported to: ${exportPath}`);
}

// CLI setup
const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 [options] <url>')
  .example('$0 -n ".nav" -c ".content" --real-time-stats https://example.com', 'Basic usage with real-time monitoring')
  .example('$0 --config config.json --performance-report --export-metrics metrics.json https://docs.example.com', 'Advanced performance monitoring')
  
  // Basic options
  .option('nav-selector', {
    alias: 'n',
    type: 'string',
    description: 'CSS selector for navigation links',
    demandOption: true
  })
  .option('content-selector', {
    alias: 'c',
    type: 'string',
    description: 'CSS selector for main content',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    type: 'string',
    description: 'Output file name',
    default: 'output.md'
  })
  .option('output-dir', {
    type: 'string',
    description: 'Output directory',
    default: '.'
  })
  .option('download-images', {
    alias: 'i',
    type: 'boolean',
    description: 'Download images locally',
    default: false
  })
  .option('concurrency', {
    type: 'number',
    description: 'Number of concurrent requests',
    default: 8
  })
  .option('config', {
    type: 'string',
    description: 'Path to configuration file'
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Verbose output',
    default: false
  })
  .option('dry-run', {
    type: 'boolean',
    description: 'Perform dry run without writing files',
    default: false
  })
  
  // Performance options
  .option('batch-size', {
    type: 'number',
    description: 'Batch size for streaming processing',
    default: 20
  })
  .option('max-memory', {
    type: 'number',
    description: 'Maximum memory usage in MB',
    default: 1024
  })
  .option('enable-streaming', {
    type: 'boolean',
    description: 'Enable streaming processing',
    default: true
  })
  .option('enable-cache', {
    type: 'boolean',
    description: 'Enable caching',
    default: true
  })
  .option('cache-ttl', {
    type: 'number',
    description: 'Cache TTL in milliseconds',
    default: 3600000
  })
  .option('chunk-size', {
    type: 'number',
    description: 'Chunk size for processing',
    default: 100
  })
  .option('enable-compression', {
    type: 'boolean',
    description: 'Enable content compression',
    default: true
  })
  .option('enable-deduplication', {
    type: 'boolean',
    description: 'Enable URL deduplication',
    default: true
  })
  .option('prefetch-enabled', {
    type: 'boolean',
    description: 'Enable prefetching optimization',
    default: true
  })
  .option('max-concurrent-images', {
    type: 'number',
    description: 'Maximum concurrent image downloads',
    default: 10
  })
  
  // Monitoring options
  .option('performance-report', {
    type: 'boolean',
    description: 'Show detailed performance report',
    default: false
  })
  .option('memory-monitor', {
    type: 'boolean',
    description: 'Enable memory monitoring',
    default: true
  })
  .option('export-metrics', {
    type: 'string',
    description: 'Export metrics to JSON file'
  })
  .option('real-time-stats', {
    type: 'boolean',
    description: 'Show real-time processing statistics',
    default: false
  })
  
  .demandCommand(1, 'Please provide a URL to process')
  .help()
  .alias('help', 'h')
  .parseSync() as any as PerformanceCliOptions;

// Main execution
async function main() {
  try {
    const baseUrl = argv._[0] as string;
    
    // Load and merge configuration
    let config = DEFAULT_CONFIG;
    if (argv.config) {
      const fileConfig = await loadConfigFromFile(argv.config);
      config = mergeConfigs(config, fileConfig);
    }
    
    const { 
      config: finalConfig, 
      streamingOptions, 
      cacheOptions, 
      optimizationOptions 
    } = createPerformanceConfig(argv);
    
    const mergedConfig = mergeConfigs(config, finalConfig);
    
    // Validate configuration
    const validation = validateConfig(mergedConfig);
    if (!validation.valid) {
      console.error('❌ Configuration validation failed:');
      validation.errors.forEach(error => console.error(`   - ${error}`));
      process.exit(1);
    }
    
    // Process with performance monitoring
    await processWithPerformanceMonitoring(
      baseUrl,
      mergedConfig,
      streamingOptions,
      cacheOptions,
      optimizationOptions,
      {
        performanceReport: argv['performance-report'],
        memoryMonitor: argv['memory-monitor'],
        exportMetrics: argv['export-metrics'],
        realTimeStats: argv['real-time-stats']
      }
    );
    
  } catch (error) {
    console.error('❌ Application error:', error);
    process.exit(1);
  }
}

// Run main function
if (require.main === module) {
  main().catch(console.error);
}

export { main, processWithPerformanceMonitoring, PerformanceMonitor };
