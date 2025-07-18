#!/usr/bin/env node
"use strict";
/**
 * Doc-to-MD Configurable Crawler v2.1.1
 *
 * Advanced documentation crawler with enterprise features:
 * - Comprehensive proxy support (HTTP/HTTPS/SOCKS)
 * - Single Page Fallback for JavaScript-heavy sites
 * - Fragment navigation handling for SPA frameworks
 * - Bot protection bypass strategies
 * - Custom headers and authentication
 * - Rate limiting and SSL configuration
 *
 * New in v2.1.0:
 * - Single Page Fallback mechanism (lines 168-200)
 * - Automatic detection of navigation failures
 * - Enhanced support for Slate framework documentation
 * - Successful AxiDraw CLI API processing (109,199 characters)
 *
 * v2.1.1 Updates:
 * - Enhanced documentation and GitHub release preparation
 * - Improved file organization and version consistency
 */
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
exports.main = main;
exports.processDocumentation = processDocumentation;
exports.createConfigFromArgs = createConfigFromArgs;
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const p_limit_1 = __importDefault(require("p-limit"));
const config_1 = require("./config");
const configurable_core_1 = require("./configurable-core");
// --- Configuration from CLI Arguments ---
function createConfigFromArgs(args) {
    const config = {};
    // Basic settings
    if (args['nav-selector']) {
        config.selectors = {
            ...config_1.DEFAULT_CONFIG.selectors,
            ...config.selectors,
            navigation: args['nav-selector']
        };
    }
    if (args['content-selector']) {
        config.selectors = {
            ...config_1.DEFAULT_CONFIG.selectors,
            ...config.selectors,
            content: args['content-selector']
        };
    }
    if (args.output)
        config.outputFile = args.output;
    if (args['output-dir'])
        config.outputDir = args['output-dir'];
    if (args['download-images'] !== undefined)
        config.downloadImages = args['download-images'];
    if (args.concurrency)
        config.concurrency = args.concurrency;
    if (args.verbose !== undefined)
        config.verbose = args.verbose;
    if (args['dry-run'] !== undefined)
        config.dryRun = args['dry-run'];
    if (args['continue-on-error'] !== undefined)
        config.continueOnError = args['continue-on-error'];
    // Crawl settings
    if (args.timeout || args['user-agent'] || args['max-retries']) {
        config.crawl = { ...config_1.DEFAULT_CONFIG.crawl };
        if (args.timeout)
            config.crawl.timeout = args.timeout;
        if (args['user-agent'])
            config.crawl.userAgent = args['user-agent'];
        if (args['max-retries'])
            config.crawl.retry.maxRetries = args['max-retries'];
    }
    // Custom headers
    if (args['custom-headers'] && args['custom-headers'].length > 0) {
        config.crawl = config.crawl || { ...config_1.DEFAULT_CONFIG.crawl };
        config.crawl.customHeaders = {};
        for (const header of args['custom-headers']) {
            const [key, value] = header.split(':', 2);
            if (key && value) {
                config.crawl.customHeaders[key.trim()] = value.trim();
            }
        }
    }
    // Proxy settings
    if (args['proxy-host']) {
        config.crawl = config.crawl || { ...config_1.DEFAULT_CONFIG.crawl };
        config.crawl.proxy = {
            enabled: true,
            host: args['proxy-host'],
            port: args['proxy-port'] || 8080,
            protocol: 'http'
        };
        if (args['proxy-username'] && args['proxy-password']) {
            config.crawl.proxy.auth = {
                username: args['proxy-username'],
                password: args['proxy-password']
            };
        }
    }
    // Rate limiting
    if (args['rate-limit']) {
        config.crawl = config.crawl || { ...config_1.DEFAULT_CONFIG.crawl };
        config.crawl.rateLimit = {
            enabled: true,
            requestsPerSecond: args['rate-limit'],
            burstSize: Math.max(5, args['rate-limit'] * 2),
            respectRobotsTxt: true
        };
    }
    // Exclude selectors
    if (args['exclude-selectors'] && args['exclude-selectors'].length > 0) {
        config.selectors = config.selectors || { ...config_1.DEFAULT_CONFIG.selectors };
        config.selectors.excludeSelectors = [...config_1.DEFAULT_CONFIG.selectors.excludeSelectors, ...args['exclude-selectors']];
    }
    // Output settings
    if (args['include-metadata'] !== undefined || args['include-toc'] !== undefined ||
        args['toc-max-depth'] || args['max-image-size'] || args['image-formats']) {
        config.output = { ...config_1.DEFAULT_CONFIG.output };
        if (args['include-metadata'] !== undefined)
            config.output.includeMetadata = args['include-metadata'];
        if (args['include-toc'] !== undefined)
            config.output.includeToc = args['include-toc'];
        if (args['toc-max-depth'])
            config.output.tocMaxDepth = args['toc-max-depth'];
        if (args['max-image-size'])
            config.output.maxImageSize = args['max-image-size'];
        if (args['image-formats'])
            config.output.imageFormats = args['image-formats'];
    }
    return config;
}
// --- Main Processing Function ---
async function processDocumentation(config) {
    const startTime = Date.now();
    console.log('🚀 Starting documentation processing...\n');
    console.log((0, config_1.getConfigSummary)(config));
    console.log('');
    if (config.dryRun) {
        console.log('🔍 DRY RUN MODE - No files will be written\n');
    }
    try {
        const crawler = new configurable_core_1.ConfigurableCrawler(config);
        // Get navigation links
        console.log(`📂 Extracting navigation links...`);
        const baseUrl = argv._[0]; // First positional argument should be URL
        if (!baseUrl) {
            console.error('❌ URL is required as the first argument');
            process.exit(1);
        }
        const links = await crawler.getNavigationLinks(baseUrl);
        if (links.length === 0) {
            console.log('⚠️ No navigation links found. Attempting single-page extraction...');
            // Fallback: Extract content from the base URL directly
            try {
                const singlePageResult = await crawler.fetchAndConvertPage(baseUrl);
                if (singlePageResult.status === 'success' && singlePageResult.markdown) {
                    console.log('✅ Single-page extraction successful!');
                    // Process as single page
                    const results = [singlePageResult];
                    const successful = results.filter(r => r.status === 'success');
                    console.log(`📊 Processing Summary:`);
                    console.log(`   ✅ Successful: ${successful.length} (single page)`);
                    console.log(`   📝 Content length: ${singlePageResult.markdown.length} characters`);
                    console.log(`   📝 Word count: ${singlePageResult.wordCount || 'N/A'}`);
                    // Generate output if not dry run
                    if (!config.dryRun) {
                        console.log(`\n📝 Generating output...`);
                        await generateOutput(successful, config);
                        console.log(`✅ Output saved to: ${path.resolve(config.outputDir, config.outputFile)}`);
                    }
                    const totalTime = Date.now() - startTime;
                    console.log(`\n🎉 Single-page processing completed in ${Math.round(totalTime / 1000)}s`);
                    return;
                }
                else {
                    console.error('❌ Single-page extraction also failed:', singlePageResult.error);
                    process.exit(1);
                }
            }
            catch (error) {
                console.error('❌ Single-page extraction failed:', error);
                process.exit(1);
            }
        }
        console.log(`✅ Found ${links.length} pages to process\n`);
        // Process pages with concurrency limit
        const limit = (0, p_limit_1.default)(config.concurrency);
        const results = [];
        let processed = 0;
        const tasks = links.map(url => limit(async () => {
            const result = await crawler.fetchAndConvertPage(url);
            processed++;
            if (config.verbose) {
                const progress = Math.round((processed / links.length) * 100);
                console.log(`📄 [${progress}%] ${result.status === 'success' ? '✅' : '❌'} ${url}`);
            }
            else {
                process.stdout.write(`\r📊 Progress: ${processed}/${links.length} (${Math.round((processed / links.length) * 100)}%)`);
            }
            return result;
        }));
        results.push(...await Promise.all(tasks));
        console.log('\n');
        // Generate summary
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status === 'error');
        console.log(`📊 Processing Summary:`);
        console.log(`   ✅ Successful: ${successful.length}`);
        console.log(`   ❌ Failed: ${failed.length}`);
        if (successful.length > 0) {
            const totalWords = successful.reduce((sum, r) => sum + (r.wordCount || 0), 0);
            const totalImages = successful.reduce((sum, r) => sum + (r.imageCount || 0), 0);
            const avgProcessingTime = successful.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successful.length;
            console.log(`   📝 Total words: ${totalWords.toLocaleString()}`);
            console.log(`   🖼️  Total images: ${totalImages}`);
            console.log(`   ⏱️  Avg processing time: ${Math.round(avgProcessingTime)}ms`);
        }
        if (failed.length > 0 && config.verbose) {
            console.log(`\n❌ Failed URLs:`);
            for (const result of failed) {
                console.log(`   - ${result.url}: ${result.error}`);
            }
        }
        // Generate output if not dry run
        if (!config.dryRun && successful.length > 0) {
            console.log(`\n📝 Generating output...`);
            await generateOutput(successful, config);
            console.log(`✅ Output saved to: ${path.resolve(config.outputDir, config.outputFile)}`);
        }
        const totalTime = Date.now() - startTime;
        console.log(`\n🎉 Processing completed in ${Math.round(totalTime / 1000)}s`);
    }
    catch (error) {
        console.error(`❌ Fatal error:`, error);
        process.exit(1);
    }
}
async function generateOutput(results, config) {
    let output = '';
    // Add main title
    output += `# Documentation\n\n`;
    output += `Generated on: ${new Date().toISOString()}\n`;
    output += `Total pages: ${results.length}\n\n`;
    // Add table of contents if enabled
    if (config.output.includeToc) {
        output += `## Table of Contents\n\n`;
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result.status === 'success' && result.title) {
                const slug = result.title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                output += `${i + 1}. [${result.title}](#${slug})\n`;
            }
        }
        output += '\n---\n\n';
    }
    // Add content
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'success') {
            output += `${result.markdown}\n\n`;
            if (i < results.length - 1) {
                output += '---\n\n';
            }
        }
    }
    // Ensure output directory exists
    await fs.mkdir(config.outputDir, { recursive: true });
    // Write output based on format
    const outputPath = path.resolve(config.outputDir, config.outputFile);
    switch (config.output.format) {
        case 'markdown':
            await fs.writeFile(outputPath, output, 'utf-8');
            break;
        case 'html':
            // Would need markdown-to-html converter
            await fs.writeFile(outputPath.replace('.md', '.html'), `<pre>${output}</pre>`, 'utf-8');
            break;
        case 'json':
            await fs.writeFile(outputPath.replace('.md', '.json'), JSON.stringify(results, null, 2), 'utf-8');
            break;
    }
}
// --- CLI Setup ---
const argv = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .usage('Usage: $0 [options] <url>')
    .example('$0 -n ".nav" -c ".content" -o docs.md https://example.com', 'Basic usage')
    .example('$0 --config config.json https://example.com', 'Use configuration file')
    .example('$0 --init-config config.json https://example.com', 'Initialize configuration file')
    // Basic options
    .option('nav-selector', {
    alias: 'n',
    type: 'string',
    description: 'CSS selector for navigation links'
})
    .option('content-selector', {
    alias: 'c',
    type: 'string',
    description: 'CSS selector for main content'
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
    default: 5
})
    // Advanced crawling options
    .option('timeout', {
    type: 'number',
    description: 'Request timeout in milliseconds',
    default: 15000
})
    .option('user-agent', {
    type: 'string',
    description: 'Custom User-Agent header'
})
    .option('max-retries', {
    type: 'number',
    description: 'Maximum number of retries',
    default: 3
})
    .option('rate-limit', {
    type: 'number',
    description: 'Maximum requests per second'
})
    .option('custom-headers', {
    type: 'array',
    description: 'Custom headers (format: "Key: Value")',
    default: []
})
    // Proxy options
    .option('proxy-host', {
    type: 'string',
    description: 'Proxy server hostname'
})
    .option('proxy-port', {
    type: 'number',
    description: 'Proxy server port',
    default: 8080
})
    .option('proxy-username', {
    type: 'string',
    description: 'Proxy authentication username'
})
    .option('proxy-password', {
    type: 'string',
    description: 'Proxy authentication password'
})
    // Content filtering
    .option('exclude-selectors', {
    type: 'array',
    description: 'CSS selectors to exclude from content',
    default: []
})
    // Output formatting
    .option('include-metadata', {
    type: 'boolean',
    description: 'Include page metadata in output',
    default: true
})
    .option('include-toc', {
    type: 'boolean',
    description: 'Include table of contents',
    default: false
})
    .option('toc-max-depth', {
    type: 'number',
    description: 'Maximum heading depth for TOC',
    default: 3
})
    .option('max-image-size', {
    type: 'number',
    description: 'Maximum image size in MB',
    default: 10
})
    .option('image-formats', {
    type: 'array',
    description: 'Allowed image formats',
    default: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']
})
    // Configuration file options
    .option('config', {
    type: 'string',
    description: 'Path to configuration file'
})
    .option('save-config', {
    type: 'string',
    description: 'Save current settings to configuration file'
})
    .option('init-config', {
    type: 'string',
    description: 'Initialize a new configuration file'
})
    // General options
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
    .option('continue-on-error', {
    type: 'boolean',
    description: 'Continue processing if some pages fail',
    default: true
})
    .demandCommand(1, 'Please provide a URL to process')
    .help()
    .alias('help', 'h')
    .parseSync();
// --- Main Execution ---
async function main() {
    try {
        const url = argv._[0];
        // Handle configuration file initialization
        if (argv['init-config']) {
            await (0, config_1.initializeConfigFile)(argv['init-config'], url);
            return;
        }
        // Load configuration
        let config = config_1.DEFAULT_CONFIG;
        // Load from config file if specified
        if (argv.config) {
            const fileConfig = await (0, config_1.loadConfigFromFile)(argv.config);
            config = (0, config_1.mergeConfigs)(config, fileConfig);
        }
        // Apply CLI arguments
        const cliConfig = createConfigFromArgs(argv);
        config = (0, config_1.mergeConfigs)(config, cliConfig);
        // Ensure required selectors are set
        if (!config.selectors.navigation) {
            console.error('❌ Navigation selector is required. Use -n or --nav-selector');
            process.exit(1);
        }
        if (!config.selectors.content) {
            console.error('❌ Content selector is required. Use -c or --content-selector');
            process.exit(1);
        }
        // Validate configuration
        const validation = (0, config_1.validateConfig)(config);
        if (!validation.valid) {
            console.error('❌ Configuration validation failed:');
            for (const error of validation.errors) {
                console.error(`   - ${error}`);
            }
            process.exit(1);
        }
        // Save configuration if requested
        if (argv['save-config']) {
            await (0, config_1.saveConfigToFile)(config, argv['save-config']);
        }
        // Process documentation
        await processDocumentation(config);
    }
    catch (error) {
        console.error('❌ Application error:', error);
        process.exit(1);
    }
}
// Run main function
if (require.main === module) {
    main().catch(console.error);
}
