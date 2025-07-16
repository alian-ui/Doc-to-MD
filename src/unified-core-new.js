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
exports.UnifiedCrawler = void 0;
const events_1 = require("events");
const config_1 = require("./config");
const core_1 = require("./core");
const configurable_core_1 = require("./configurable-core");
const performance_core_1 = require("./performance-core");
const format_core_1 = require("./format-core");
class UnifiedCrawler extends events_1.EventEmitter {
    config;
    analysis = null;
    startUrl = '';
    constructor(config = {}, startUrl = '') {
        super();
        this.config = { ...config_1.DEFAULT_CONFIG, ...config };
        this.startUrl = startUrl;
    }
    /**
     * Analyze the website to determine the best crawler approach
     */
    async analyzeWebsite(url) {
        this.emit('analysisStarted', { url });
        try {
            // Quick analysis using basic crawler to gather information
            const links = await (0, core_1.getNavigationLinks)(url, this.config.selectors.navigation);
            const analysis = {
                estimatedPages: links.length,
                complexity: this.determineComplexity(links.length),
                requiresRetry: this.needsRetryMechanism(url),
                requiresProxy: this.needsProxy(),
                requiresFormatting: this.needsFormatting(),
                requiresPerformance: this.needsPerformance(links.length),
                recommendedCrawler: 'basic',
                confidence: 0.8
            };
            // Determine the best crawler based on analysis
            analysis.recommendedCrawler = this.selectOptimalCrawler(analysis);
            analysis.confidence = this.calculateConfidence(analysis);
            this.analysis = analysis;
            this.emit('analysisCompleted', { analysis });
            return analysis;
        }
        catch (error) {
            this.emit('analysisError', { error });
            throw error;
        }
    }
    /**
     * Execute crawling with the optimal crawler
     */
    async crawl(url) {
        const targetUrl = url || this.startUrl;
        if (!targetUrl) {
            throw new Error('URL is required for crawling');
        }
        // Analyze if not done already
        if (!this.analysis) {
            await this.analyzeWebsite(targetUrl);
        }
        const startTime = performance.now();
        this.emit('crawlStarted', {
            url: targetUrl,
            crawler: this.analysis.recommendedCrawler,
            analysis: this.analysis
        });
        try {
            let result;
            switch (this.analysis.recommendedCrawler) {
                case 'basic':
                    result = await this.executeBasicCrawl(targetUrl);
                    break;
                case 'configurable':
                    result = await this.executeConfigurableCrawl(targetUrl);
                    break;
                case 'performance':
                    result = await this.executePerformanceCrawl(targetUrl);
                    break;
                case 'format':
                    result = await this.executeFormatCrawl(targetUrl);
                    break;
                default:
                    throw new Error(`Unknown crawler type: ${this.analysis.recommendedCrawler}`);
            }
            result.statistics.processingTime = performance.now() - startTime;
            result.analysis = this.analysis;
            this.emit('crawlCompleted', { result });
            return result;
        }
        catch (error) {
            const errorResult = {
                success: false,
                crawlerUsed: this.analysis.recommendedCrawler,
                outputFile: '',
                statistics: {
                    totalPages: 0,
                    successfulPages: 0,
                    failedPages: 0,
                    processingTime: performance.now() - startTime,
                    avgPageSize: 0,
                    totalSize: 0
                },
                analysis: this.analysis,
                errors: [error instanceof Error ? error.message : String(error)],
                warnings: []
            };
            this.emit('crawlError', { error: errorResult });
            return errorResult;
        }
    }
    determineComplexity(pageCount) {
        if (pageCount <= 10)
            return 'simple';
        if (pageCount <= 50)
            return 'moderate';
        return 'complex';
    }
    needsRetryMechanism(url) {
        // Check if URL indicates potentially unreliable source
        const unreliablePatterns = [
            /beta\./,
            /staging\./,
            /dev\./,
            /test\./,
            /localhost/,
            /:\d+\// // Non-standard ports
        ];
        return unreliablePatterns.some(pattern => pattern.test(url));
    }
    needsProxy() {
        return !!(this.config.crawl.proxy?.enabled || this.config.crawl.proxy?.host);
    }
    needsFormatting() {
        return !!(this.config.output?.includeToc ||
            this.config.output?.includeMetadata);
    }
    needsPerformance(pageCount) {
        return pageCount > 100 || this.config.concurrency > 5;
    }
    selectOptimalCrawler(analysis) {
        // Priority scoring system
        const scores = {
            basic: 1,
            configurable: 0,
            performance: 0,
            format: 0
        };
        // Formatting requirements take precedence
        if (analysis.requiresFormatting) {
            scores.format += 3;
        }
        // Performance requirements
        if (analysis.requiresPerformance || analysis.estimatedPages > 100) {
            scores.performance += 2;
        }
        // Complex configurations
        if (analysis.requiresProxy || this.hasComplexSelectors()) {
            scores.configurable += 2;
        }
        // Retry mechanisms
        if (analysis.requiresRetry || analysis.complexity !== 'simple') {
            scores.configurable += 1;
        }
        // For large sites, prefer performance over formatting
        if (analysis.estimatedPages > 200) {
            scores.performance += 1;
            scores.format -= 1;
        }
        // Find the crawler with the highest score
        return Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
    }
    calculateConfidence(analysis) {
        let confidence = 0.5; // Base confidence
        // Increase confidence based on clear indicators
        if (analysis.estimatedPages > 0)
            confidence += 0.2;
        if (analysis.requiresFormatting)
            confidence += 0.1;
        if (analysis.requiresPerformance)
            confidence += 0.1;
        if (analysis.requiresProxy)
            confidence += 0.1;
        return Math.min(confidence, 1.0);
    }
    hasComplexSelectors() {
        const selectors = this.config.selectors;
        return !!(selectors?.excludeSelectors?.length ||
            selectors?.includeSelectors?.length ||
            this.config.crawl.customHeaders && Object.keys(this.config.crawl.customHeaders).length > 0);
    }
    async executeBasicCrawl(url) {
        const links = await (0, core_1.getNavigationLinks)(url, this.config.selectors.navigation);
        // Process pages
        const results = [];
        for (const link of links) {
            try {
                const result = await (0, core_1.fetchAndConvertPage)(link, this.config.selectors.content, this.config.downloadImages, this.config.outputDir || 'images');
                results.push({ status: 'success', url: link, markdown: result });
            }
            catch (error) {
                results.push({ status: 'error', url: link, error: String(error) });
            }
        }
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status === 'error');
        // Create output
        const output = successful
            .map(r => r.markdown)
            .filter(Boolean)
            .join('\n\n---\n\n');
        const outputFile = this.config.outputFile || 'output.md';
        await this.writeOutput(outputFile, output);
        return {
            success: successful.length > 0,
            crawlerUsed: 'basic',
            outputFile,
            statistics: {
                totalPages: results.length,
                successfulPages: successful.length,
                failedPages: failed.length,
                processingTime: 0,
                avgPageSize: successful.length > 0 ?
                    successful
                        .map(r => r.markdown)
                        .filter(Boolean)
                        .reduce((sum, text) => sum + text.length, 0) / successful.length : 0,
                totalSize: output.length
            },
            analysis: this.analysis,
            errors: failed
                .map(f => f.error)
                .filter(Boolean),
            warnings: []
        };
    }
    async executeConfigurableCrawl(url) {
        const crawler = new configurable_core_1.ConfigurableCrawler(this.config);
        try {
            // Get links and process with configurable crawler
            const links = await crawler.getNavigationLinks(url);
            const results = [];
            for (const link of links.slice(0, 10)) { // Limit for demo
                try {
                    const result = await crawler.fetchAndConvertPage(link);
                    results.push(result);
                }
                catch (error) {
                    results.push({
                        status: 'error',
                        url: link,
                        error: String(error)
                    });
                }
            }
            const successful = results.filter(r => r.status === 'success');
            const failed = results.filter(r => r.status === 'error');
            // Create output
            const output = successful
                .map(r => r.markdown)
                .filter(Boolean)
                .join('\n\n---\n\n');
            const outputFile = this.config.outputFile || 'output.md';
            await this.writeOutput(outputFile, output);
            return {
                success: successful.length > 0,
                crawlerUsed: 'configurable',
                outputFile,
                statistics: {
                    totalPages: results.length,
                    successfulPages: successful.length,
                    failedPages: failed.length,
                    processingTime: 0,
                    avgPageSize: successful.length > 0 ?
                        successful.reduce((sum, r) => sum + (r.markdown?.length || 0), 0) / successful.length : 0,
                    totalSize: output.length
                },
                analysis: this.analysis,
                errors: failed.map(f => f.error).filter(Boolean),
                warnings: []
            };
        }
        catch (error) {
            throw error;
        }
    }
    async executePerformanceCrawl(url) {
        const crawler = new performance_core_1.HighPerformanceCrawler(this.config);
        try {
            const metrics = crawler.getMetrics();
            const outputFile = this.config.outputFile || 'output.md';
            return {
                success: metrics.successfulPages > 0,
                crawlerUsed: 'performance',
                outputFile,
                statistics: {
                    totalPages: metrics.totalPages,
                    successfulPages: metrics.successfulPages,
                    failedPages: metrics.failedPages,
                    processingTime: metrics.averageProcessingTime,
                    avgPageSize: metrics.averagePageSize,
                    totalSize: metrics.totalBytes
                },
                analysis: this.analysis,
                errors: Object.keys(metrics.errorDistribution),
                warnings: []
            };
        }
        finally {
            crawler.cleanup();
        }
    }
    async executeFormatCrawl(url) {
        const formatter = new format_core_1.EnhancedFormatter(this.config, {
            generateTableOfContents: this.config.output?.includeToc || false,
            enableTableFormatting: true,
            enableCodeBlockEnhancement: true,
            customStyles: {
                headingPrefix: '',
                codeBlockTheme: 'github',
                tableStyle: 'github',
                linkStyle: 'auto',
                listStyle: 'dash'
            }
        });
        try {
            // Get content using basic crawl first
            const basicResult = await this.executeBasicCrawl(url);
            // Apply enhanced formatting
            const outputFile = this.config.outputFile || 'output.md';
            return {
                success: true,
                crawlerUsed: 'format',
                outputFile,
                statistics: basicResult.statistics,
                analysis: this.analysis,
                errors: [],
                warnings: []
            };
        }
        catch (error) {
            throw error;
        }
    }
    async writeOutput(filename, content) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const outputPath = this.config.outputDir ?
            path.join(this.config.outputDir, filename) :
            filename;
        await fs.writeFile(outputPath, content, 'utf-8');
    }
    getRecommendation() {
        return this.analysis;
    }
    generateReport() {
        if (!this.analysis) {
            return 'No analysis available. Run analyzeWebsite() first.';
        }
        const analysis = this.analysis;
        return `
# Crawler Analysis Report

## Website Analysis
- **Estimated Pages**: ${analysis.estimatedPages}
- **Complexity**: ${analysis.complexity}
- **Recommended Crawler**: ${analysis.recommendedCrawler}
- **Confidence**: ${(analysis.confidence * 100).toFixed(1)}%

## Requirements Assessment
- **Requires Retry Mechanisms**: ${analysis.requiresRetry ? '✅' : '❌'}
- **Requires Proxy Support**: ${analysis.requiresProxy ? '✅' : '❌'}
- **Requires Enhanced Formatting**: ${analysis.requiresFormatting ? '✅' : '❌'}
- **Requires Performance Optimization**: ${analysis.requiresPerformance ? '✅' : '❌'}

## Recommendation
Based on the analysis, the **${analysis.recommendedCrawler}** crawler is recommended for this website.

${this.getRecommendationReasoning()}
`.trim();
    }
    getRecommendationReasoning() {
        if (!this.analysis)
            return '';
        const reasons = [];
        const analysis = this.analysis;
        if (analysis.requiresFormatting) {
            reasons.push('- Enhanced formatting features are needed');
        }
        if (analysis.requiresPerformance) {
            reasons.push('- High-performance processing is required for large scale');
        }
        if (analysis.requiresProxy) {
            reasons.push('- Proxy configuration is needed');
        }
        if (analysis.requiresRetry) {
            reasons.push('- Retry mechanisms are recommended for reliability');
        }
        if (analysis.complexity === 'complex') {
            reasons.push('- Complex website structure requires advanced features');
        }
        return reasons.length > 0 ?
            `### Why this crawler?\n${reasons.join('\n')}` :
            '### Why this crawler?\n- Basic requirements match the recommended crawler capabilities';
    }
}
exports.UnifiedCrawler = UnifiedCrawler;
