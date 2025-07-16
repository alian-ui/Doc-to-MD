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
// Import core functionality
const core_1 = require("./core");
// --- Argument Parsing ---
async function parseArgs() {
    return (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
        .options({
        url: { type: 'string', demandOption: true, describe: 'Starting URL to crawl' },
        navSelector: { type: 'string', demandOption: true, describe: 'CSS selector for the navigation area' },
        contentSelector: { type: 'string', demandOption: true, describe: 'CSS selector for the main content area' },
        output: { type: 'string', default: 'output.md', alias: 'o', describe: 'Output file name' },
        concurrency: { type: 'number', default: 5, alias: 'c', describe: 'Number of concurrent requests' },
        downloadImages: { type: 'boolean', default: false, describe: 'Download images and point to local files' },
        outputDir: { type: 'string', default: '.', describe: 'Directory to save output file and images' },
    })
        .help()
        .alias('help', 'h')
        .argv;
}
// --- Main Execution ---
async function main() {
    const argv = await parseArgs();
    const { url, navSelector, contentSelector, output, concurrency, downloadImages, outputDir } = argv;
    const limit = (0, p_limit_1.default)(concurrency);
    const imagesDir = path.join(outputDir, 'images');
    if (downloadImages) {
        await fs.mkdir(imagesDir, { recursive: true });
        console.log(`Created images directory at: ${imagesDir}`);
    }
    const links = await (0, core_1.getNavigationLinks)(url, navSelector);
    if (links.length === 0) {
        console.error('No navigation links found. Please check your --navSelector.');
        return;
    }
    const promises = links.map(link => limit(() => (0, core_1.fetchAndConvertPage)(link, contentSelector, downloadImages, imagesDir)));
    const results = await Promise.all(promises);
    const successfulPages = new Map();
    const failedPages = [];
    for (const result of results) {
        if (result.status === 'success') {
            successfulPages.set(result.url, result.markdown);
        }
        else {
            failedPages.push({ url: result.url, error: result.error });
        }
    }
    let fullMarkdown = '';
    for (const link of links) {
        if (successfulPages.has(link)) {
            fullMarkdown += successfulPages.get(link) + '\n\n---\n\n';
        }
    }
    if (fullMarkdown) {
        const outputPath = path.join(outputDir, output);
        await fs.writeFile(outputPath, fullMarkdown);
        console.log(`\n✅ Successfully created markdown file: ${outputPath}`);
        console.log(`Processed ${links.length} pages: ${successfulPages.size} succeeded, ${failedPages.length} failed.`);
    }
    else {
        console.error('\n❌ Failed to generate any markdown content.');
    }
    if (failedPages.length > 0) {
        console.log('\n--- Failed Pages ---');
        for (const failure of failedPages) {
            console.log(`URL: ${failure.url}\nError: ${failure.error}\n`);
        }
    }
}
main();
