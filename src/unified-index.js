#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedMain = main;
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const unified_core_1 = require("./unified-core");
const config_1 = require("./config");
const fs = __importStar(require("fs/promises"));
const DEFAULT_CLI_CONFIG = {
    outputFile: 'unified-output.md',
    outputDir: '.', // Current directory instead of 'unified-output'
    concurrency: 3,
    verbose: false,
    dryRun: false
};
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .usage('Usage: $0 <url> [options]')
        .command('$0 <url>', 'Crawl website using optimal crawler selection', (yargs) => {
        return yargs.positional('url', {
            describe: 'URL to crawl',
            type: 'string',
            demandOption: true
        });
    })
        .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to configuration file (JSON)'
    })
        .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output filename',
        default: 'unified-output.md'
    })
        .option('analyze', {
        alias: 'a',
        type: 'boolean',
        description: 'Only analyze the website (no crawling)',
        default: false
    })
        .option('report', {
        alias: 'r',
        type: 'boolean',
        description: 'Generate analysis report',
        default: false
    })
        .option('crawler', {
        type: 'string',
        choices: ['basic', 'configurable', 'performance', 'format'],
        description: 'Force specific crawler (overrides analysis)'
    })
        .option('dry', {
        alias: 'd',
        type: 'boolean',
        description: 'Dry run (analyze only, no output files)',
        default: false
    })
        .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Verbose logging',
        default: false
    })
        .option('concurrency', {
        type: 'number',
        description: 'Number of concurrent requests',
        default: 3
    })
        .option('include-toc', {
        type: 'boolean',
        description: 'Include table of contents',
        default: false
    })
        .option('include-metadata', {
        type: 'boolean',
        description: 'Include page metadata',
        default: false
    })
        .option('proxy-host', {
        type: 'string',
        description: 'Proxy host'
    })
        .option('proxy-port', {
        type: 'number',
        description: 'Proxy port'
    })
        .help()
        .alias('help', 'h')
        .example('$0 https://docs.example.com', 'Crawl documentation with automatic crawler selection')
        .example('$0 https://docs.example.com --analyze', 'Analyze website without crawling')
        .example('$0 https://docs.example.com --crawler performance', 'Force performance crawler')
        .example('$0 https://docs.example.com --include-toc --include-metadata', 'Crawl with enhanced formatting')
        .argv;
    try {
        // Load configuration
        let config = { ...config_1.DEFAULT_CONFIG, ...DEFAULT_CLI_CONFIG };
        if (argv.config) {
            try {
                const fileConfig = await (0, config_1.loadConfigFromFile)(argv.config);
                config = { ...config, ...fileConfig };
                if (argv.verbose) {
                    console.log(`📖 Loaded configuration from: ${argv.config}`);
                }
            }
            catch (error) {
                console.error(`❌ Failed to load config file: ${error instanceof Error ? error.message : error}`);
                process.exit(1);
            }
        }
        // Override config with CLI arguments
        if (argv.output)
            config.outputFile = argv.output;
        if (argv.concurrency)
            config.concurrency = argv.concurrency;
        if (argv.verbose !== undefined)
            config.verbose = argv.verbose;
        if (argv.dry !== undefined)
            config.dryRun = argv.dry;
        if (argv['include-toc'] !== undefined) {
            config.output.includeToc = argv['include-toc'];
        }
        if (argv['include-metadata'] !== undefined) {
            config.output.includeMetadata = argv['include-metadata'];
        }
        if (argv['proxy-host']) {
            config.crawl.proxy.enabled = true;
            config.crawl.proxy.host = argv['proxy-host'];
            if (argv['proxy-port']) {
                config.crawl.proxy.port = argv['proxy-port'];
            }
        }
        // Validate URL
        const url = (argv.url || argv._[0]);
        if (!url) {
            console.error('❌ URL is required');
            process.exit(1);
        }
        if (argv.verbose) {
            console.log('🔧 Configuration:', JSON.stringify(config, null, 2));
        }
        // Initialize unified crawler
        const crawler = new unified_core_1.UnifiedCrawler(config, url);
        // Set up event listeners for verbose output
        if (argv.verbose) {
            crawler.on('analysisStarted', (data) => {
                console.log(`🔍 Starting analysis of: ${data.url}`);
            });
            crawler.on('analysisCompleted', (data) => {
                console.log(`✅ Analysis completed. Recommended crawler: ${data.analysis.recommendedCrawler}`);
            });
            crawler.on('crawlStarted', (data) => {
                console.log(`🚀 Starting crawl with ${data.crawler} crawler`);
            });
            crawler.on('crawlCompleted', (data) => {
                console.log(`✅ Crawl completed successfully`);
                console.log(`📊 Statistics:`, data.result.statistics);
            });
            crawler.on('crawlError', (data) => {
                console.error(`❌ Crawl error:`, data.error);
            });
        }
        // Perform analysis
        console.log(`🔍 Analyzing ${url}...`);
        const analysis = await crawler.analyzeWebsite(url);
        console.log(`📋 Analysis Results:`);
        console.log(`  • Estimated pages: ${analysis.estimatedPages}`);
        console.log(`  • Complexity: ${analysis.complexity}`);
        console.log(`  • Recommended crawler: ${analysis.recommendedCrawler}`);
        console.log(`  • Confidence: ${(analysis.confidence * 100).toFixed(1)}%`);
        console.log(`\n🔧 Requirements:`);
        console.log(`  • Retry mechanisms: ${analysis.requiresRetry ? '✅' : '❌'}`);
        console.log(`  • Proxy support: ${analysis.requiresProxy ? '✅' : '❌'}`);
        console.log(`  • Enhanced formatting: ${analysis.requiresFormatting ? '✅' : '❌'}`);
        console.log(`  • Performance optimization: ${analysis.requiresPerformance ? '✅' : '❌'}`);
        // Generate report if requested
        if (argv.report) {
            const report = crawler.generateReport();
            const reportFile = `analysis-report-${Date.now()}.md`;
            if (!config.dryRun) {
                await fs.writeFile(reportFile, report);
                console.log(`📊 Analysis report saved to: ${reportFile}`);
            }
            else {
                console.log(`\n📊 Analysis Report:\n${report}`);
            }
        }
        // Stop here if only analyzing
        if (argv.analyze) {
            console.log('✅ Analysis complete (analyze-only mode)');
            return;
        }
        // Override crawler selection if specified
        if (argv.crawler) {
            console.log(`🔧 Forcing ${argv.crawler} crawler (overriding analysis recommendation)`);
            crawler.analysis.recommendedCrawler = argv.crawler;
        }
        // Perform crawling
        if (!config.dryRun) {
            console.log(`🚀 Starting crawl...`);
            const result = await crawler.crawl(url);
            if (result.success) {
                console.log('✅ Crawl completed successfully!');
                console.log(`📄 Output file: ${result.outputFile}`);
                console.log(`🔧 Crawler used: ${result.crawlerUsed}`);
                console.log(`📊 Statistics:`);
                console.log(`  • Total pages: ${result.statistics.totalPages}`);
                console.log(`  • Successful: ${result.statistics.successfulPages}`);
                console.log(`  • Failed: ${result.statistics.failedPages}`);
                console.log(`  • Processing time: ${(result.statistics.processingTime / 1000).toFixed(2)}s`);
                console.log(`  • Average page size: ${Math.round(result.statistics.avgPageSize)} chars`);
                console.log(`  • Total size: ${Math.round(result.statistics.totalSize / 1024)}KB`);
                if (result.errors.length > 0) {
                    console.log(`⚠️  Errors encountered: ${result.errors.length}`);
                    if (argv.verbose) {
                        result.errors.forEach((error, i) => {
                            console.log(`  ${i + 1}. ${error}`);
                        });
                    }
                }
                if (result.warnings.length > 0) {
                    console.log(`⚠️  Warnings: ${result.warnings.length}`);
                    if (argv.verbose) {
                        result.warnings.forEach((warning, i) => {
                            console.log(`  ${i + 1}. ${warning}`);
                        });
                    }
                }
            }
            else {
                console.error('❌ Crawl failed');
                console.error('Errors:', result.errors.join(', '));
                process.exit(1);
            }
        }
        else {
            console.log('✅ Dry run complete (no files created)');
            console.log(`📄 Would create output file: ${config.outputFile}`);
            console.log(`🔧 Would use crawler: ${analysis.recommendedCrawler}`);
        }
    }
    catch (error) {
        console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
        if (argv.verbose && error instanceof Error && error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}
// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled promise rejection:', reason);
    process.exit(1);
});
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});
// Run if called directly
if (require.main === module) {
    main().catch((error) => {
        console.error('❌ Application error:', error);
        process.exit(1);
    });
}
