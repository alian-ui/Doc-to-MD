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
exports.HighPerformanceCrawler = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const p_limit_1 = __importDefault(require("p-limit"));
const events_1 = require("events");
const perf_hooks_1 = require("perf_hooks");
const configurable_core_1 = require("./configurable-core");
// --- High-Performance Crawler ---
class HighPerformanceCrawler extends events_1.EventEmitter {
    config;
    baseCrawler;
    metrics; // Will be initialized in initializeMetrics
    streamingOptions;
    cacheOptions;
    optimizationOptions;
    urlCache = new Map();
    contentBuffer = [];
    memoryMonitor;
    processedUrls = new Set();
    urlQueue = [];
    constructor(config, streamingOptions = {}, cacheOptions = {}, optimizationOptions = {}) {
        super();
        this.config = config;
        this.baseCrawler = new configurable_core_1.ConfigurableCrawler(config);
        // Default streaming options
        this.streamingOptions = {
            batchSize: 10,
            flushInterval: 5000,
            maxMemoryMB: 512,
            enableStreaming: true,
            backpressureThreshold: 0.8,
            ...streamingOptions
        };
        // Default cache options
        this.cacheOptions = {
            enabled: true,
            maxCacheSize: 1000,
            cacheTTL: 3600000, // 1 hour
            persistToDisk: false,
            cacheDirectory: '.cache',
            ...cacheOptions
        };
        // Default optimization options
        this.optimizationOptions = {
            enableCompression: true,
            enableDeduplication: true,
            enableLazyLoading: true,
            enablePrefetching: true,
            maxConcurrentImages: 5,
            chunkedProcessing: true,
            chunkSize: 50,
            ...optimizationOptions
        };
        this.initializeMetrics();
        this.setupMemoryMonitoring();
    }
    initializeMetrics() {
        this.metrics = {
            startTime: perf_hooks_1.performance.now(),
            totalPages: 0,
            successfulPages: 0,
            failedPages: 0,
            totalBytes: 0,
            averagePageSize: 0,
            averageProcessingTime: 0,
            peakMemoryUsage: 0,
            memoryUsageHistory: [],
            throughputPagesPerSecond: 0,
            errorDistribution: {},
            slowestPages: [],
            largestPages: []
        };
    }
    setupMemoryMonitoring() {
        if (this.memoryMonitor) {
            clearInterval(this.memoryMonitor);
        }
        this.memoryMonitor = setInterval(() => {
            const memUsage = process.memoryUsage();
            const currentMB = memUsage.heapUsed / (1024 * 1024);
            this.metrics.memoryUsageHistory.push(currentMB);
            this.metrics.peakMemoryUsage = Math.max(this.metrics.peakMemoryUsage, currentMB);
            // Keep only last 100 measurements
            if (this.metrics.memoryUsageHistory.length > 100) {
                this.metrics.memoryUsageHistory.shift();
            }
            // Emit memory warning if threshold exceeded
            if (currentMB > this.streamingOptions.maxMemoryMB * this.streamingOptions.backpressureThreshold) {
                this.emit('memoryWarning', { current: currentMB, limit: this.streamingOptions.maxMemoryMB });
            }
            // Force garbage collection if available
            if (global.gc && currentMB > this.streamingOptions.maxMemoryMB * 0.9) {
                global.gc();
            }
        }, 1000);
    }
    async crawlWithStreaming(baseUrl) {
        try {
            this.emit('crawlStarted', { baseUrl, config: this.config });
            // Phase 1: Discover all URLs with optimization
            const urls = await this.discoverUrlsOptimized(baseUrl);
            this.metrics.totalPages = urls.length;
            this.emit('urlsDiscovered', { count: urls.length, urls });
            // Phase 2: Process URLs with chunked streaming
            if (this.optimizationOptions.chunkedProcessing) {
                await this.processUrlsInChunks(urls);
            }
            else {
                await this.processUrlsConcurrent(urls);
            }
            // Phase 3: Finalize and generate metrics
            await this.finalizeCrawl();
            this.metrics.endTime = perf_hooks_1.performance.now();
            this.calculateFinalMetrics();
            this.emit('crawlCompleted', { metrics: this.metrics });
            return this.metrics;
        }
        catch (error) {
            this.emit('crawlError', { error });
            throw error;
        }
        finally {
            this.cleanup();
        }
    }
    async discoverUrlsOptimized(baseUrl) {
        const startTime = perf_hooks_1.performance.now();
        this.emit('urlDiscoveryStarted', { baseUrl });
        // Use caching for URL discovery
        const cacheKey = `urls:${baseUrl}`;
        if (this.cacheOptions.enabled && this.urlCache.has(cacheKey)) {
            const cached = this.urlCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheOptions.cacheTTL) {
                this.emit('urlsCacheHit', { count: cached.urls.length });
                return cached.urls;
            }
        }
        const urls = await this.baseCrawler.getNavigationLinks(baseUrl);
        // Prioritize URLs based on patterns
        const prioritizedUrls = this.prioritizeUrls(urls);
        // Cache the results
        if (this.cacheOptions.enabled) {
            this.urlCache.set(cacheKey, {
                urls: prioritizedUrls,
                timestamp: Date.now()
            });
        }
        const discoveryTime = perf_hooks_1.performance.now() - startTime;
        this.emit('urlDiscoveryCompleted', {
            count: prioritizedUrls.length,
            time: discoveryTime
        });
        return prioritizedUrls;
    }
    prioritizeUrls(urls) {
        // Assign priorities based on URL patterns
        const urlsWithPriority = urls.map(url => {
            let priority = 1; // Default priority
            // Higher priority for index/overview pages
            if (url.match(/\/(index|overview|introduction|getting-started)/i)) {
                priority = 3;
            }
            // Medium priority for guides and tutorials
            else if (url.match(/\/(guide|tutorial|how-to)/i)) {
                priority = 2;
            }
            // Lower priority for reference/API docs
            else if (url.match(/\/(api|reference|changelog)/i)) {
                priority = 0.5;
            }
            return { url, priority };
        });
        // Sort by priority (highest first)
        urlsWithPriority.sort((a, b) => b.priority - a.priority);
        return urlsWithPriority.map(item => item.url);
    }
    async processUrlsInChunks(urls) {
        const chunkSize = this.optimizationOptions.chunkSize;
        const totalChunks = Math.ceil(urls.length / chunkSize);
        this.emit('chunkProcessingStarted', { totalChunks, chunkSize });
        for (let i = 0; i < urls.length; i += chunkSize) {
            const chunk = urls.slice(i, i + chunkSize);
            const chunkIndex = Math.floor(i / chunkSize);
            this.emit('chunkStarted', { chunkIndex, chunkSize: chunk.length });
            // Process chunk with concurrency control
            await this.processUrlsWithBackpressure(chunk);
            // Flush buffer if needed
            if (this.contentBuffer.length >= this.streamingOptions.batchSize) {
                await this.flushBuffer();
            }
            // Memory check between chunks
            const memUsage = process.memoryUsage().heapUsed / (1024 * 1024);
            if (memUsage > this.streamingOptions.maxMemoryMB * 0.8) {
                await this.flushBuffer();
                if (global.gc)
                    global.gc();
            }
            this.emit('chunkCompleted', {
                chunkIndex,
                completed: i + chunk.length,
                total: urls.length,
                memoryUsage: memUsage
            });
        }
    }
    async processUrlsConcurrent(urls) {
        const limit = (0, p_limit_1.default)(this.config.concurrency);
        const tasks = urls.map(url => limit(() => this.processUrlWithOptimizations(url)));
        await Promise.allSettled(tasks);
    }
    async processUrlsWithBackpressure(urls) {
        const limit = (0, p_limit_1.default)(this.config.concurrency);
        let processed = 0;
        const processNext = async () => {
            if (processed >= urls.length)
                return;
            const currentUrl = urls[processed++];
            try {
                const result = await this.processUrlWithOptimizations(currentUrl);
                this.addToBuffer(result);
                // Check backpressure
                const memUsage = process.memoryUsage().heapUsed / (1024 * 1024);
                if (memUsage > this.streamingOptions.maxMemoryMB * this.streamingOptions.backpressureThreshold) {
                    await this.flushBuffer();
                    // Small delay to allow memory cleanup
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            catch (error) {
                this.emit('pageError', { url: currentUrl, error });
            }
            // Continue processing
            if (processed < urls.length) {
                setImmediate(processNext);
            }
        };
        // Start concurrent processing
        const concurrentTasks = Array.from({ length: Math.min(this.config.concurrency, urls.length) }, () => processNext());
        await Promise.all(concurrentTasks);
    }
    async processUrlWithOptimizations(url) {
        const pageStartTime = perf_hooks_1.performance.now();
        // Deduplication check
        if (this.optimizationOptions.enableDeduplication && this.processedUrls.has(url)) {
            return {
                status: 'error',
                url,
                error: 'Duplicate URL skipped',
                processingTime: 0
            };
        }
        this.processedUrls.add(url);
        try {
            // Check cache first
            const cacheKey = `page:${url}`;
            if (this.cacheOptions.enabled && this.urlCache.has(cacheKey)) {
                const cached = this.urlCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheOptions.cacheTTL) {
                    this.emit('pageCacheHit', { url });
                    return cached.result;
                }
            }
            // Process the page
            const result = await this.baseCrawler.fetchAndConvertPage(url);
            // Calculate metrics for this page
            const processingTime = perf_hooks_1.performance.now() - pageStartTime;
            const pageSize = result.markdown?.length || 0;
            this.updatePageMetrics(result, processingTime, pageSize);
            // Cache successful results
            if (this.cacheOptions.enabled && result.status === 'success') {
                this.urlCache.set(cacheKey, {
                    result,
                    timestamp: Date.now()
                });
                // Clean cache if it gets too large
                if (this.urlCache.size > this.cacheOptions.maxCacheSize) {
                    this.cleanCache();
                }
            }
            this.emit('pageProcessed', {
                url,
                status: result.status,
                processingTime,
                pageSize
            });
            return result;
        }
        catch (error) {
            const processingTime = perf_hooks_1.performance.now() - pageStartTime;
            this.updateErrorMetrics(error, processingTime);
            return {
                status: 'error',
                url,
                error: error instanceof Error ? error.message : String(error),
                processingTime
            };
        }
    }
    updatePageMetrics(result, processingTime, pageSize) {
        if (result.status === 'success') {
            this.metrics.successfulPages++;
            this.metrics.totalBytes += pageSize;
            // Track slowest pages
            this.metrics.slowestPages.push({ url: result.url, processingTime });
            this.metrics.slowestPages.sort((a, b) => b.processingTime - a.processingTime);
            this.metrics.slowestPages = this.metrics.slowestPages.slice(0, 10);
            // Track largest pages
            this.metrics.largestPages.push({ url: result.url, size: pageSize });
            this.metrics.largestPages.sort((a, b) => b.size - a.size);
            this.metrics.largestPages = this.metrics.largestPages.slice(0, 10);
        }
        else {
            this.metrics.failedPages++;
            // Track error distribution
            const errorType = this.categorizeError(result.error || 'Unknown');
            this.metrics.errorDistribution[errorType] = (this.metrics.errorDistribution[errorType] || 0) + 1;
        }
    }
    updateErrorMetrics(error, processingTime) {
        this.metrics.failedPages++;
        const errorType = this.categorizeError(error.message || String(error));
        this.metrics.errorDistribution[errorType] = (this.metrics.errorDistribution[errorType] || 0) + 1;
    }
    categorizeError(errorMessage) {
        if (errorMessage.includes('timeout'))
            return 'timeout';
        if (errorMessage.includes('404') || errorMessage.includes('Not Found'))
            return 'not_found';
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden'))
            return 'forbidden';
        if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error'))
            return 'server_error';
        if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED'))
            return 'network';
        if (errorMessage.includes('Content not found'))
            return 'content_missing';
        return 'other';
    }
    addToBuffer(result) {
        this.contentBuffer.push(result);
        // Auto-flush if buffer size exceeded
        if (this.contentBuffer.length >= this.streamingOptions.batchSize) {
            setImmediate(() => this.flushBuffer());
        }
    }
    async flushBuffer() {
        if (this.contentBuffer.length === 0)
            return;
        const batchToFlush = [...this.contentBuffer];
        this.contentBuffer = [];
        this.emit('bufferFlushing', { batchSize: batchToFlush.length });
        // Process the batch (could write to file, send to stream, etc.)
        await this.processBatch(batchToFlush);
        this.emit('bufferFlushed', { batchSize: batchToFlush.length });
    }
    async processBatch(batch) {
        // This could be customized based on output requirements
        // For now, we'll just emit the batch for external processing
        this.emit('batchReady', { batch });
    }
    cleanCache() {
        // Remove oldest entries to maintain cache size
        const entries = Array.from(this.urlCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        const toRemove = entries.slice(0, Math.floor(this.cacheOptions.maxCacheSize * 0.2));
        toRemove.forEach(([key]) => this.urlCache.delete(key));
        this.emit('cacheCleared', { removedCount: toRemove.length });
    }
    async finalizeCrawl() {
        // Flush any remaining content
        await this.flushBuffer();
        // Persist cache if enabled
        if (this.cacheOptions.persistToDisk && this.urlCache.size > 0) {
            await this.persistCache();
        }
    }
    async persistCache() {
        try {
            await fs.mkdir(this.cacheOptions.cacheDirectory, { recursive: true });
            const cacheData = Object.fromEntries(this.urlCache.entries());
            const cacheFile = path.join(this.cacheOptions.cacheDirectory, 'crawl-cache.json');
            await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
            this.emit('cachePersisted', { file: cacheFile, entries: this.urlCache.size });
        }
        catch (error) {
            this.emit('cachePersistError', { error });
        }
    }
    calculateFinalMetrics() {
        const totalTime = (this.metrics.endTime - this.metrics.startTime) / 1000; // Convert to seconds
        this.metrics.averagePageSize = this.metrics.successfulPages > 0 ?
            this.metrics.totalBytes / this.metrics.successfulPages : 0;
        this.metrics.throughputPagesPerSecond = this.metrics.totalPages / totalTime;
        // Calculate average processing time from slowest pages data
        if (this.metrics.slowestPages.length > 0) {
            const totalProcessingTime = this.metrics.slowestPages.reduce((sum, page) => sum + page.processingTime, 0);
            this.metrics.averageProcessingTime = totalProcessingTime / this.metrics.slowestPages.length;
        }
    }
    cleanup() {
        if (this.memoryMonitor) {
            clearInterval(this.memoryMonitor);
            this.memoryMonitor = undefined;
        }
        // Clear caches
        this.urlCache.clear();
        this.contentBuffer = [];
        this.processedUrls.clear();
        this.urlQueue = [];
    }
    getMetrics() {
        return { ...this.metrics };
    }
    getMemoryUsage() {
        const current = process.memoryUsage().heapUsed / (1024 * 1024);
        return {
            current,
            peak: this.metrics.peakMemoryUsage,
            history: [...this.metrics.memoryUsageHistory]
        };
    }
    clearCache() {
        this.urlCache.clear();
        this.emit('cacheCleared', { removedCount: 'all' });
    }
}
exports.HighPerformanceCrawler = HighPerformanceCrawler;
