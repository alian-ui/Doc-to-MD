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
const p_limit_1 = __importDefault(require("p-limit"));
const yargs_1 = __importDefault(require("yargs"));
const helpers_1 = require("yargs/helpers");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
// Import enhanced core functionality
const enhanced_core_1 = require("./enhanced-core");
// --- Enhanced Argument Parsing ---
async function parseArgs() {
    return (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .options({
        url: {
            type: 'string',
            demandOption: true,
            describe: 'Starting URL to crawl'
        },
        navSelector: {
            type: 'string',
            demandOption: true,
            describe: 'CSS selector for the navigation area'
        },
        contentSelector: {
            type: 'string',
            demandOption: true,
            describe: 'CSS selector for the main content area'
        },
        output: {
            type: 'string',
            default: 'output.md',
            alias: 'o',
            describe: 'Output file name'
        },
        concurrency: {
            type: 'number',
            default: 5,
            alias: 'c',
            describe: 'Number of concurrent requests'
        },
        downloadImages: {
            type: 'boolean',
            default: false,
            describe: 'Download images and point to local files'
        },
        outputDir: {
            type: 'string',
            default: '.',
            describe: 'Directory to save output file and images'
        },
        timeout: {
            type: 'number',
            default: 15000,
            describe: 'Request timeout in milliseconds'
        },
        maxRetries: {
            type: 'number',
            default: 3,
            describe: 'Maximum number of retry attempts'
        },
        retryDelay: {
            type: 'number',
            default: 1000,
            describe: 'Base delay between retries in milliseconds'
        },
        userAgent: {
            type: 'string',
            default: 'Doc-to-MD/1.0.0 (Web Documentation Crawler)',
            describe: 'Custom User-Agent string'
        },
        validateUrls: {
            type: 'boolean',
            default: true,
            describe: 'Validate URLs before processing'
        },
        continueOnError: {
            type: 'boolean',
            default: true,
            describe: 'Continue processing even if some pages fail'
        },
        verbose: {
            type: 'boolean',
            default: false,
            alias: 'v',
            describe: 'Enable verbose logging'
        }
    })
        .help()
        .alias('help', 'h')
        .example('$0 --url "https://docs.example.com" --navSelector ".sidebar" --contentSelector ".main-content"', 'Basic usage')
        .example('$0 --url "https://docs.example.com" --navSelector ".nav" --contentSelector "article" --downloadImages --maxRetries 5', 'With image download and custom retry settings')
        .argv;
}
function createProgressStats(total) {
    return {
        total,
        completed: 0,
        successful: 0,
        failed: 0,
        errors: new Map()
    };
}
function updateProgress(stats, result) {
    stats.completed++;
    if (result.status === 'success') {
        stats.successful++;
    }
    else {
        stats.failed++;
        const errorCount = stats.errors.get(result.errorType) || 0;
        stats.errors.set(result.errorType, errorCount + 1);
    }
}
function printProgressReport(stats, verbose) {
    const percentage = Math.round((stats.completed / stats.total) * 100);
    console.log(`\n📊 Progress Report:`);
    console.log(`   Total pages: ${stats.total}`);
    console.log(`   Completed: ${stats.completed}/${stats.total} (${percentage}%)`);
    console.log(`   ✅ Successful: ${stats.successful}`);
    console.log(`   ❌ Failed: ${stats.failed}`);
    if (stats.errors.size > 0 && verbose) {
        console.log(`\n🔍 Error Breakdown:`);
        for (const [errorType, count] of stats.errors.entries()) {
            console.log(`   ${errorType}: ${count} errors`);
        }
    }
}
// --- Enhanced Main Execution ---
async function main() {
    const argv = await parseArgs();
    const { url, navSelector, contentSelector, output, concurrency, downloadImages, outputDir, timeout, maxRetries, retryDelay, userAgent, validateUrls, continueOnError, verbose } = argv;
    // Create crawl options from CLI arguments
    const crawlOptions = {
        timeout,
        userAgent,
        validateUrls,
        retry: {
            maxRetries,
            baseDelay: retryDelay,
            maxDelay: retryDelay * 10,
            retryOnStatus: [408, 429, 500, 502, 503, 504]
        }
    };
    console.log('🚀 Starting Doc-to-MD crawler...');
    if (verbose) {
        console.log('⚙️  Configuration:');
        console.log(`   URL: ${url}`);
        console.log(`   Navigation Selector: ${navSelector}`);
        console.log(`   Content Selector: ${contentSelector}`);
        console.log(`   Concurrency: ${concurrency}`);
        console.log(`   Timeout: ${timeout}ms`);
        console.log(`   Max Retries: ${maxRetries}`);
        console.log(`   User Agent: ${userAgent}`);
        console.log(`   Validate URLs: ${validateUrls}`);
        console.log(`   Continue on Error: ${continueOnError}`);
    }
    const limit = (0, p_limit_1.default)(concurrency);
    const imagesDir = path.join(outputDir, 'images');
    // Create output directory
    try {
        await fs.mkdir(outputDir, { recursive: true });
        if (downloadImages) {
            await fs.mkdir(imagesDir, { recursive: true });
            console.log(`📁 Created images directory at: ${imagesDir}`);
        }
    }
    catch (error) {
        console.error(`❌ Failed to create output directories: ${error}`);
        return;
    }
    // Extract navigation links
    const navResult = await (0, enhanced_core_1.getNavigationLinks)(url, navSelector, crawlOptions);
    if (navResult.errors.length > 0) {
        console.warn(`⚠️  Navigation extraction warnings:`);
        for (const error of navResult.errors) {
            console.warn(`   ${error}`);
        }
        if (navResult.links.length === 0) {
            console.error('❌ No navigation links found. Please check your --navSelector.');
            return;
        }
    }
    console.log(`📋 Found ${navResult.links.length} pages to process`);
    const stats = createProgressStats(navResult.links.length);
    // Process pages with enhanced error handling
    const promises = navResult.links.map(link => limit(async () => {
        const result = await (0, enhanced_core_1.fetchAndConvertPage)(link, contentSelector, downloadImages, imagesDir, crawlOptions);
        updateProgress(stats, result);
        if (verbose) {
            if (result.status === 'success') {
                console.log(`✅ [${stats.completed}/${stats.total}] ${link}`);
            }
            else {
                console.log(`❌ [${stats.completed}/${stats.total}] ${link} - ${result.errorType}: ${result.error}`);
            }
        }
        else {
            // Simple progress indicator
            process.stdout.write(result.status === 'success' ? '.' : 'x');
        }
        return result;
    }));
    const results = await Promise.all(promises);
    if (!verbose) {
        console.log(); // New line after progress dots
    }
    printProgressReport(stats, verbose);
    // Separate successful and failed results
    const successfulPages = new Map();
    const failedPages = [];
    for (const result of results) {
        if (result.status === 'success') {
            successfulPages.set(result.url, result.markdown);
        }
        else {
            failedPages.push(result);
        }
    }
    // Check if we should continue with partial results
    if (failedPages.length > 0 && !continueOnError && failedPages.length === results.length) {
        console.error('\n❌ All pages failed to process. Use --continueOnError to generate partial output.');
        return;
    }
    // Generate output
    if (successfulPages.size > 0) {
        let fullMarkdown = '';
        // Add header with metadata
        fullMarkdown += `# Documentation Export\n\n`;
        fullMarkdown += `**Source:** ${url}\n`;
        fullMarkdown += `**Generated:** ${new Date().toISOString()}\n`;
        fullMarkdown += `**Pages:** ${successfulPages.size}/${navResult.links.length}\n\n`;
        if (failedPages.length > 0) {
            fullMarkdown += `**Note:** ${failedPages.length} pages failed to process.\n\n`;
        }
        fullMarkdown += `---\n\n`;
        // Add successful pages in original order
        for (const link of navResult.links) {
            if (successfulPages.has(link)) {
                fullMarkdown += successfulPages.get(link) + '\n\n---\n\n';
            }
        }
        const outputPath = path.join(outputDir, output);
        await fs.writeFile(outputPath, fullMarkdown);
        console.log(`\n✅ Successfully created markdown file: ${outputPath}`);
    }
    else {
        console.error('\n❌ No successful pages to generate output.');
    }
    // Report failed pages
    if (failedPages.length > 0) {
        console.log('\n📋 Failed Pages Report:');
        // Group errors by type
        const errorGroups = new Map();
        for (const failure of failedPages) {
            const group = errorGroups.get(failure.errorType) || [];
            group.push(failure);
            errorGroups.set(failure.errorType, group);
        }
        for (const [errorType, failures] of errorGroups.entries()) {
            console.log(`\n   ${errorType.toUpperCase()} ERRORS (${failures.length}):`);
            for (const failure of failures.slice(0, 5)) { // Show max 5 per type
                console.log(`   • ${failure.url}`);
                if (verbose) {
                    console.log(`     ${failure.error}`);
                }
            }
            if (failures.length > 5) {
                console.log(`   ... and ${failures.length - 5} more`);
            }
        }
        // Save detailed error report
        if (verbose) {
            const errorReportPath = path.join(outputDir, 'error-report.json');
            const errorReport = {
                timestamp: new Date().toISOString(),
                totalPages: navResult.links.length,
                successfulPages: successfulPages.size,
                failedPages: failedPages.length,
                errors: failedPages.map(f => ({
                    url: f.url,
                    error: f.error,
                    errorType: f.errorType,
                    httpStatus: f.httpStatus,
                    retryCount: f.retryCount
                }))
            };
            await fs.writeFile(errorReportPath, JSON.stringify(errorReport, null, 2));
            console.log(`\n📄 Detailed error report saved: ${errorReportPath}`);
        }
    }
    console.log('\n🎉 Crawling completed!');
}
// Error handling for the main function
main().catch(error => {
    console.error('\n💥 Fatal error:', error.message);
    if (error.stack) {
        console.error(error.stack);
    }
    process.exit(1);
});
