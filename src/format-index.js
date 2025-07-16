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
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const format_core_1 = require("./format-core");
const config_1 = require("./config");
async function main() {
    const argv = await (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .usage('Usage: $0 [options] <url>')
        .option('url', {
        type: 'string',
        description: 'The base URL to start crawling from',
        demandOption: true
    })
        .option('config', {
        alias: 'c',
        type: 'string',
        description: 'Path to configuration file'
    })
        .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output file path',
        default: 'enhanced-output.md'
    })
        .option('output-dir', {
        type: 'string',
        description: 'Output directory',
        default: '.'
    })
        .option('nav-selector', {
        alias: 'n',
        type: 'string',
        description: 'CSS selector for navigation elements'
    })
        .option('content-selector', {
        alias: 's',
        type: 'string',
        description: 'CSS selector for main content'
    })
        .option('enable-tables', {
        type: 'boolean',
        description: 'Enable enhanced table formatting',
        default: true
    })
        .option('enable-code-blocks', {
        type: 'boolean',
        description: 'Enable enhanced code block formatting',
        default: true
    })
        .option('enable-images', {
        type: 'boolean',
        description: 'Enable enhanced image formatting',
        default: true
    })
        .option('enable-links', {
        type: 'boolean',
        description: 'Enable enhanced link formatting',
        default: true
    })
        .option('generate-toc', {
        type: 'boolean',
        description: 'Generate table of contents',
        default: true
    })
        .option('include-breadcrumbs', {
        type: 'boolean',
        description: 'Include breadcrumb navigation',
        default: true
    })
        .option('add-page-breaks', {
        type: 'boolean',
        description: 'Add page breaks between sections',
        default: false
    })
        .option('heading-prefix', {
        type: 'string',
        description: 'Prefix to add to all headings',
        default: ''
    })
        .option('code-theme', {
        choices: ['github', 'monokai', 'solarized', 'default'],
        description: 'Code block theme',
        default: 'github'
    })
        .option('table-style', {
        choices: ['github', 'grid', 'simple'],
        description: 'Table formatting style',
        default: 'github'
    })
        .option('link-style', {
        choices: ['inline', 'reference', 'auto'],
        description: 'Link formatting style',
        default: 'auto'
    })
        .option('list-style', {
        choices: ['dash', 'asterisk', 'plus'],
        description: 'List bullet style',
        default: 'dash'
    })
        .option('include-metadata', {
        type: 'boolean',
        description: 'Include metadata in output',
        default: true
    })
        .option('include-stats', {
        type: 'boolean',
        description: 'Include statistics in output',
        default: true
    })
        .option('separate-pages', {
        type: 'boolean',
        description: 'Separate pages with horizontal rules',
        default: true
    })
        .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Enable verbose logging',
        default: false
    })
        .help()
        .alias('help', 'h')
        .example('$0 --nav-selector ".nav" --content-selector ".content" https://docs.example.com', 'Basic enhanced formatting')
        .example('$0 --config config.json --generate-toc --include-stats https://docs.example.com', 'With configuration file and enhanced features')
        .example('$0 --code-theme monokai --table-style grid --add-page-breaks https://docs.example.com', 'Custom styling options')
        .argv;
    try {
        console.log('🎨 Enhanced Doc-to-MD Formatter');
        console.log('================================\n');
        // Load configuration
        let config = { ...config_1.DEFAULT_CONFIG };
        if (argv.config) {
            console.log(`📁 Loading configuration from: ${argv.config}`);
            const fileConfig = await (0, config_1.loadConfigFromFile)(argv.config);
            config = { ...config, ...fileConfig };
        }
        // Override config with CLI arguments
        if (argv.navSelector) {
            config.selectors = { ...config.selectors, navigation: argv.navSelector };
        }
        if (argv.contentSelector) {
            config.selectors = { ...config.selectors, content: argv.contentSelector };
        }
        // Ensure required selectors are provided
        if (!config.selectors?.navigation || !config.selectors?.content) {
            throw new Error('Navigation and content selectors are required. Use --nav-selector and --content-selector or provide them in config file.');
        }
        // Setup formatting options
        const formattingOptions = {
            enablePrettier: false,
            enableTableFormatting: argv.enableTables,
            enableCodeBlockEnhancement: argv.enableCodeBlocks,
            enableLinkFormatting: argv.enableLinks,
            enableImageOptimization: argv.enableImages,
            generateTableOfContents: argv.generateToc,
            includeBreadcrumbs: argv.includeBreadcrumbs,
            addPageBreaks: argv.addPageBreaks,
            customStyles: {
                headingPrefix: argv.headingPrefix,
                codeBlockTheme: argv.codeTheme,
                tableStyle: argv.tableStyle,
                linkStyle: argv.linkStyle,
                listStyle: argv.listStyle
            }
        };
        // Setup output directory
        await fs.mkdir(argv.outputDir, { recursive: true });
        const outputPath = path.join(argv.outputDir, argv.output);
        if (argv.verbose) {
            console.log('Configuration:');
            console.log(`  URL: ${argv.url}`);
            console.log(`  Navigation Selector: ${config.selectors.navigation}`);
            console.log(`  Content Selector: ${config.selectors.content}`);
            console.log(`  Output: ${outputPath}`);
            console.log(`  Formatting Options:`, formattingOptions);
            console.log('');
        }
        // Initialize formatter
        const formatter = new format_core_1.EnhancedFormatter(config, formattingOptions);
        // Performance monitoring
        const startTime = Date.now();
        console.log(`🚀 Starting enhanced crawl from: ${argv.url}`);
        // Crawl with enhanced formatting
        const { results, globalToc, summary } = await formatter.crawlWithEnhancedFormatting(argv.url);
        // Generate output
        console.log(`📝 Generating enhanced output...`);
        await formatter.generateCombinedOutput(results, outputPath, {
            includeGlobalToc: argv.generateToc,
            includeMetadata: argv.includeMetadata,
            includeStats: argv.includeStats,
            separatePages: argv.separatePages
        });
        // Save detailed report
        if (argv.verbose) {
            const reportPath = path.join(argv.outputDir, 'formatting-report.json');
            const report = {
                timestamp: new Date().toISOString(),
                configuration: config,
                formattingOptions,
                summary,
                results: results.map(r => ({
                    url: r.url,
                    status: r.status,
                    wordCount: r.wordCount,
                    readingTime: r.readingTime,
                    tocEntries: r.tableOfContents?.length || 0,
                    error: r.status === 'error' ? r.error : undefined
                })),
                globalToc: globalToc.map(entry => ({
                    title: entry.title,
                    level: entry.level,
                    childrenCount: entry.children?.length || 0
                }))
            };
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            console.log(`📊 Detailed report saved to: ${reportPath}`);
        }
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        console.log('\n✨ Enhanced formatting completed successfully!');
        console.log('=====================================');
        console.log(`📄 Pages processed: ${summary.totalPages}`);
        console.log(`✅ Successful: ${summary.successfulPages}`);
        console.log(`❌ Failed: ${summary.failedPages}`);
        console.log(`📝 Total words: ${summary.totalWords.toLocaleString()}`);
        console.log(`⏱️  Reading time: ${summary.totalReadingTime} minutes`);
        console.log(`🕒 Processing time: ${duration.toFixed(2)}s`);
        console.log(`💾 Output saved to: ${outputPath}`);
        if (summary.failedPages > 0) {
            console.log('\n⚠️  Some pages failed to process:');
            results
                .filter(r => r.status === 'error')
                .forEach(r => {
                console.log(`   ${r.url}: ${r.error}`);
            });
        }
    }
    catch (error) {
        console.error('\n❌ Enhanced formatting failed:');
        console.error(error instanceof Error ? error.message : String(error));
        if (argv.verbose && error instanceof Error && error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}
// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('\n💥 Uncaught exception:', error.message);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    console.error('\n💥 Unhandled rejection:', reason);
    process.exit(1);
});
if (require.main === module) {
    main();
}
