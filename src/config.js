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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.DEFAULT_ADVANCED_CRAWL_CONFIG = exports.DEFAULT_OUTPUT_CONFIG = exports.DEFAULT_RATE_LIMIT_CONFIG = exports.DEFAULT_PROXY_CONFIG = void 0;
exports.loadConfigFromFile = loadConfigFromFile;
exports.saveConfigToFile = saveConfigToFile;
exports.mergeConfigs = mergeConfigs;
exports.validateConfig = validateConfig;
exports.initializeConfigFile = initializeConfigFile;
exports.getConfigSummary = getConfigSummary;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const enhanced_core_1 = require("./enhanced-core");
// --- Default Configurations ---
exports.DEFAULT_PROXY_CONFIG = {
    enabled: false,
    protocol: 'http'
};
exports.DEFAULT_RATE_LIMIT_CONFIG = {
    enabled: false,
    requestsPerSecond: 2,
    burstSize: 5,
    respectRobotsTxt: true
};
exports.DEFAULT_OUTPUT_CONFIG = {
    format: 'markdown',
    includeMetadata: true,
    includeToc: false,
    tocMaxDepth: 3,
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
    preserveOriginalImages: false,
    imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    maxImageSize: 10 // 10MB
};
exports.DEFAULT_ADVANCED_CRAWL_CONFIG = {
    ...enhanced_core_1.DEFAULT_CRAWL_OPTIONS,
    proxy: exports.DEFAULT_PROXY_CONFIG,
    rateLimit: exports.DEFAULT_RATE_LIMIT_CONFIG,
    customHeaders: {},
    followRedirects: true,
    maxRedirects: 5,
    sslConfig: {
        rejectUnauthorized: true,
        allowSelfSigned: false
    },
    cookies: {
        enabled: false
    }
};
exports.DEFAULT_CONFIG = {
    crawl: exports.DEFAULT_ADVANCED_CRAWL_CONFIG,
    output: exports.DEFAULT_OUTPUT_CONFIG,
    selectors: {
        navigation: '.nav, .navigation, .sidebar, .toc, [role="navigation"], nav, .menu, .nav-list, .site-nav, .docs-nav, .documentation-nav, .doc-nav, .guide-nav, .api-nav, .reference-nav, aside nav, .left-sidebar, .right-sidebar',
        content: 'main, .content, .main-content, article, .article, .post, .post-content, .entry-content, [role="main"], .documentation-content, .doc-content, .guide-content, .api-content, .tutorial-content, section.content, .page-content, .article-body',
        excludeSelectors: ['.advertisement', '.sidebar-ads', '.footer', '.header', '.nav', '.navigation', '.breadcrumb', '.pagination', '.social-sharing', '.comments', '.related-posts', '.author-bio', '.newsletter-signup'],
        includeSelectors: []
    },
    concurrency: 5,
    downloadImages: false,
    outputDir: '.',
    outputFile: 'output.md',
    continueOnError: true,
    verbose: false,
    dryRun: false
};
// --- Configuration Management Functions ---
async function loadConfigFromFile(configPath) {
    try {
        const configExists = await fs.access(configPath).then(() => true).catch(() => false);
        if (!configExists) {
            console.warn(`⚠️  Config file not found: ${configPath}`);
            return {};
        }
        const configContent = await fs.readFile(configPath, 'utf-8');
        const ext = path.extname(configPath).toLowerCase();
        let config;
        switch (ext) {
            case '.json':
                config = JSON.parse(configContent);
                break;
            case '.yaml':
            case '.yml':
                // Note: Would need yaml parser dependency
                throw new Error('YAML config files require yaml parser dependency');
            default:
                throw new Error(`Unsupported config file format: ${ext}`);
        }
        console.log(`✅ Loaded configuration from: ${configPath}`);
        return config;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to load config file ${configPath}: ${message}`);
        throw error;
    }
}
async function saveConfigToFile(config, configPath) {
    try {
        const configDir = path.dirname(configPath);
        await fs.mkdir(configDir, { recursive: true });
        const ext = path.extname(configPath).toLowerCase();
        let content;
        switch (ext) {
            case '.json':
                content = JSON.stringify(config, null, 2);
                break;
            default:
                throw new Error(`Unsupported config file format: ${ext}`);
        }
        await fs.writeFile(configPath, content, 'utf-8');
        console.log(`✅ Configuration saved to: ${configPath}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`❌ Failed to save config file ${configPath}: ${message}`);
        throw error;
    }
}
function mergeConfigs(...configs) {
    const merged = { ...exports.DEFAULT_CONFIG };
    for (const config of configs) {
        if (config.crawl) {
            // Deep merge crawl configuration
            merged.crawl = {
                ...merged.crawl,
                ...config.crawl,
                retry: config.crawl.retry ? { ...merged.crawl.retry, ...config.crawl.retry } : merged.crawl.retry,
                proxy: config.crawl.proxy ? { ...merged.crawl.proxy, ...config.crawl.proxy } : merged.crawl.proxy,
                rateLimit: config.crawl.rateLimit ? { ...merged.crawl.rateLimit, ...config.crawl.rateLimit } : merged.crawl.rateLimit,
                customHeaders: config.crawl.customHeaders ? { ...merged.crawl.customHeaders, ...config.crawl.customHeaders } : merged.crawl.customHeaders,
                sslConfig: config.crawl.sslConfig ? { ...merged.crawl.sslConfig, ...config.crawl.sslConfig } : merged.crawl.sslConfig,
                cookies: config.crawl.cookies ? { ...merged.crawl.cookies, ...config.crawl.cookies } : merged.crawl.cookies
            };
        }
        if (config.output) {
            merged.output = { ...merged.output, ...config.output };
        }
        if (config.selectors) {
            merged.selectors = { ...merged.selectors, ...config.selectors };
        }
        // Merge other top-level properties
        Object.assign(merged, {
            concurrency: config.concurrency ?? merged.concurrency,
            downloadImages: config.downloadImages ?? merged.downloadImages,
            outputDir: config.outputDir ?? merged.outputDir,
            outputFile: config.outputFile ?? merged.outputFile,
            continueOnError: config.continueOnError ?? merged.continueOnError,
            verbose: config.verbose ?? merged.verbose,
            dryRun: config.dryRun ?? merged.dryRun
        });
    }
    return merged;
}
function validateConfig(config) {
    const errors = [];
    // Validate selectors
    if (!config.selectors.navigation) {
        errors.push('Navigation selector is required');
    }
    if (!config.selectors.content) {
        errors.push('Content selector is required');
    }
    // Validate crawl options
    if (config.crawl.timeout <= 0) {
        errors.push('Timeout must be positive');
    }
    if (config.crawl.retry.maxRetries < 0) {
        errors.push('Max retries cannot be negative');
    }
    if (config.crawl.retry.baseDelay <= 0) {
        errors.push('Base delay must be positive');
    }
    // Validate proxy config
    if (config.crawl.proxy.enabled) {
        if (!config.crawl.proxy.host) {
            errors.push('Proxy host is required when proxy is enabled');
        }
        if (!config.crawl.proxy.port || config.crawl.proxy.port <= 0) {
            errors.push('Valid proxy port is required when proxy is enabled');
        }
    }
    // Validate rate limiting
    if (config.crawl.rateLimit.enabled) {
        if (config.crawl.rateLimit.requestsPerSecond <= 0) {
            errors.push('Requests per second must be positive');
        }
        if (config.crawl.rateLimit.burstSize <= 0) {
            errors.push('Burst size must be positive');
        }
    }
    // Validate output config
    if (!['markdown', 'html', 'json'].includes(config.output.format)) {
        errors.push('Output format must be markdown, html, or json');
    }
    if (config.output.tocMaxDepth <= 0) {
        errors.push('TOC max depth must be positive');
    }
    if (config.output.maxImageSize <= 0) {
        errors.push('Max image size must be positive');
    }
    // Validate concurrency
    if (config.concurrency <= 0) {
        errors.push('Concurrency must be positive');
    }
    return { valid: errors.length === 0, errors };
}
async function initializeConfigFile(configPath, baseUrl) {
    const config = { ...exports.DEFAULT_CONFIG };
    // Try to detect common selectors based on URL
    if (baseUrl) {
        console.log(`🔍 Analyzing ${baseUrl} for common selectors...`);
        const detectedSelectors = await detectCommonSelectors(baseUrl);
        config.selectors = { ...config.selectors, ...detectedSelectors };
    }
    await saveConfigToFile(config, configPath);
    console.log(`📄 Initialized configuration file: ${configPath}`);
    console.log(`   Please review and customize the settings before running.`);
}
async function detectCommonSelectors(url) {
    // This would analyze the page and suggest selectors
    // For now, return common patterns
    return {
        navigation: 'nav, .nav, .navigation, .sidebar, .toc, [role="navigation"]',
        content: 'main, .main, .content, .main-content, article, [role="main"]',
        excludeSelectors: [
            '.advertisement', '.ads', '.sidebar-ads',
            '.footer', '.header', '.nav', '.navigation',
            '.breadcrumbs', '.pagination', '.comments',
            '.related-posts', '.social-sharing'
        ]
    };
}
function getConfigSummary(config) {
    const summary = [];
    summary.push(`📋 Configuration Summary:`);
    summary.push(`   Navigation Selector: ${config.selectors.navigation}`);
    summary.push(`   Content Selector: ${config.selectors.content}`);
    summary.push(`   Output Format: ${config.output.format}`);
    summary.push(`   Concurrency: ${config.concurrency}`);
    summary.push(`   Download Images: ${config.downloadImages}`);
    summary.push(`   Timeout: ${config.crawl.timeout}ms`);
    summary.push(`   Max Retries: ${config.crawl.retry.maxRetries}`);
    if (config.crawl.proxy.enabled) {
        summary.push(`   Proxy: ${config.crawl.proxy.protocol}://${config.crawl.proxy.host}:${config.crawl.proxy.port}`);
    }
    if (config.crawl.rateLimit.enabled) {
        summary.push(`   Rate Limit: ${config.crawl.rateLimit.requestsPerSecond} req/s`);
    }
    if (Object.keys(config.crawl.customHeaders).length > 0) {
        summary.push(`   Custom Headers: ${Object.keys(config.crawl.customHeaders).length} defined`);
    }
    if (config.selectors.excludeSelectors.length > 0) {
        summary.push(`   Exclude Selectors: ${config.selectors.excludeSelectors.length} defined`);
    }
    return summary.join('\n');
}
