"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const events_1 = require("events");
const performance_core_1 = require("./performance-core");
const config_1 = require("./config");
// Simple mock setup without complex typing
globals_1.jest.mock('./configurable-core', () => ({
    ConfigurableCrawler: globals_1.jest.fn().mockImplementation(() => ({
        getNavigationLinks: globals_1.jest.fn(),
        fetchAndConvertPage: globals_1.jest.fn(),
    }))
}));
describe('High-Performance Crawler Test Suite', () => {
    let config;
    let streamingOptions;
    let cacheOptions;
    let optimizationOptions;
    let crawler = null;
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
        config = {
            ...config_1.DEFAULT_CONFIG,
            selectors: {
                navigation: '.nav',
                content: '.content',
                excludeSelectors: [],
                includeSelectors: []
            },
            concurrency: 4
        };
        streamingOptions = {
            batchSize: 5,
            flushInterval: 1000,
            maxMemoryMB: 100,
            enableStreaming: true,
            backpressureThreshold: 0.8
        };
        cacheOptions = {
            enabled: true,
            maxCacheSize: 50,
            cacheTTL: 300000, // 5 minutes
            persistToDisk: false,
            cacheDirectory: '.test-cache'
        };
        optimizationOptions = {
            enableCompression: true,
            enableDeduplication: true,
            enableLazyLoading: true,
            enablePrefetching: true,
            maxConcurrentImages: 3,
            chunkedProcessing: true,
            chunkSize: 10
        };
    });
    afterEach(() => {
        // Clean up crawler if it was created
        if (crawler) {
            crawler.cleanup();
            crawler = null;
        }
        // Clean up any global state and timers
        globals_1.jest.clearAllTimers();
        globals_1.jest.clearAllMocks();
    });
    describe('Crawler Initialization', () => {
        it('should initialize with default options', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            expect(crawler).toBeInstanceOf(events_1.EventEmitter);
            expect(crawler.getMetrics()).toBeDefined();
        });
        it('should initialize with custom streaming options', () => {
            const customStreamingOptions = {
                batchSize: 20,
                flushInterval: 2000,
                maxMemoryMB: 256,
                enableStreaming: false,
                backpressureThreshold: 0.9
            };
            crawler = new performance_core_1.HighPerformanceCrawler(config, customStreamingOptions);
            expect(crawler).toBeInstanceOf(performance_core_1.HighPerformanceCrawler);
        });
    });
    describe('URL Discovery and Prioritization', () => {
        it('should prioritize URLs correctly', () => {
            const urls = [
                'https://example.com/api/reference',
                'https://example.com/guide/getting-started',
                'https://example.com/index',
                'https://example.com/tutorial/basics',
                'https://example.com/changelog'
            ];
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            const prioritized = crawler.prioritizeUrls(urls);
            // Guide and tutorial should be prioritized (they have priority 2)
            expect(prioritized.slice(0, 3)).toContain('https://example.com/guide/getting-started');
            expect(prioritized.slice(0, 3)).toContain('https://example.com/tutorial/basics');
            expect(prioritized.slice(0, 3)).toContain('https://example.com/index');
            // API and changelog should be lower
            expect(prioritized.indexOf('https://example.com/api/reference')).toBeGreaterThan(-1);
            expect(prioritized.indexOf('https://example.com/changelog')).toBeGreaterThan(-1);
        });
    });
    describe('Content Processing and Optimization', () => {
        it('should categorize errors correctly', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            expect(crawler.categorizeError('timeout of 10000ms exceeded')).toBe('timeout');
            expect(crawler.categorizeError('Request failed with status code 404')).toBe('not_found');
            expect(crawler.categorizeError('Request failed with status code 403')).toBe('forbidden');
            expect(crawler.categorizeError('Request failed with status code 500')).toBe('server_error');
            expect(crawler.categorizeError('ECONNREFUSED')).toBe('network');
            expect(crawler.categorizeError('Content not found using selector')).toBe('content_missing');
            expect(crawler.categorizeError('Unknown random error')).toBe('other');
        });
    });
    describe('Performance Metrics', () => {
        it('should initialize metrics correctly', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            const metrics = crawler.getMetrics();
            expect(metrics.startTime).toBeDefined();
            expect(metrics.totalPages).toBe(0);
            expect(metrics.successfulPages).toBe(0);
            expect(metrics.failedPages).toBe(0);
            expect(metrics.totalBytes).toBe(0);
            expect(metrics.errorDistribution).toEqual({});
            expect(metrics.slowestPages).toEqual([]);
            expect(metrics.largestPages).toEqual([]);
        });
        it('should update metrics correctly for successful pages', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            const result = {
                status: 'success',
                url: 'https://example.com/test',
                markdown: '# Test content',
                processingTime: 150
            };
            crawler.updatePageMetrics(result, 150, 1000);
            const metrics = crawler.getMetrics();
            expect(metrics.successfulPages).toBe(1);
            expect(metrics.failedPages).toBe(0);
            expect(metrics.totalBytes).toBe(1000);
            expect(metrics.slowestPages).toHaveLength(1);
            expect(metrics.slowestPages[0].url).toBe('https://example.com/test');
            expect(metrics.largestPages).toHaveLength(1);
            expect(metrics.largestPages[0].size).toBe(1000);
        });
        it('should update metrics correctly for failed pages', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            const result = {
                status: 'error',
                url: 'https://example.com/test',
                error: 'timeout of 10000ms exceeded'
            };
            crawler.updatePageMetrics(result, 5000, 0);
            const metrics = crawler.getMetrics();
            expect(metrics.successfulPages).toBe(0);
            expect(metrics.failedPages).toBe(1);
            expect(metrics.errorDistribution.timeout).toBe(1);
        });
        it('should track slowest and largest pages correctly', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            // Add multiple pages
            for (let i = 1; i <= 15; i++) {
                const result = {
                    status: 'success',
                    url: `https://example.com/page${i}`,
                    markdown: `# Page ${i}`,
                    processingTime: i * 100
                };
                crawler.updatePageMetrics(result, i * 100, i * 1000);
                // Manually increment totalPages since we're testing updatePageMetrics in isolation
                crawler.metrics.totalPages++;
            }
            const metrics = crawler.getMetrics();
            // Should only keep top 10 slowest pages
            expect(metrics.slowestPages).toHaveLength(10);
            expect(metrics.slowestPages[0].processingTime).toBe(1500); // Highest
            expect(metrics.slowestPages[9].processingTime).toBe(600); // 10th highest
            // Should only keep top 10 largest pages
            expect(metrics.largestPages).toHaveLength(10);
            expect(metrics.largestPages[0].size).toBe(15000); // Largest
            expect(metrics.largestPages[9].size).toBe(6000); // 10th largest
        });
    });
    describe('Memory Management', () => {
        it('should provide memory usage information', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config, streamingOptions);
            const memoryInfo = crawler.getMemoryUsage();
            expect(memoryInfo).toHaveProperty('current');
            expect(memoryInfo).toHaveProperty('peak');
            expect(memoryInfo).toHaveProperty('history');
            expect(typeof memoryInfo.current).toBe('number');
            expect(typeof memoryInfo.peak).toBe('number');
            expect(Array.isArray(memoryInfo.history)).toBe(true);
        });
        it('should clear cache on demand', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config, streamingOptions, cacheOptions);
            // Add some cache entries
            crawler.urlCache.set('test1', { data: 'test1' });
            crawler.urlCache.set('test2', { data: 'test2' });
            expect(crawler.urlCache.size).toBe(2);
            crawler.clearCache();
            expect(crawler.urlCache.size).toBe(0);
        });
        it('should handle buffer flushing', async () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config, streamingOptions);
            const flushEvents = [];
            const flushingHandler = (data) => flushEvents.push({ type: 'flushing', data });
            const flushedHandler = (data) => flushEvents.push({ type: 'flushed', data });
            crawler.on('bufferFlushing', flushingHandler);
            crawler.on('bufferFlushed', flushedHandler);
            try {
                // Add items to buffer
                for (let i = 0; i < 3; i++) {
                    crawler.addToBuffer({
                        status: 'success',
                        url: `https://example.com/page${i}`,
                        markdown: `# Page ${i}`
                    });
                }
                await crawler.flushBuffer();
                expect(flushEvents.length).toBeGreaterThan(0);
            }
            finally {
                // Clean up event listeners
                crawler.removeListener('bufferFlushing', flushingHandler);
                crawler.removeListener('bufferFlushed', flushedHandler);
                crawler.removeAllListeners();
            }
        });
    });
    describe('Stress Testing', () => {
        it('should handle large number of URLs without memory overflow', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config, {
                ...streamingOptions,
                maxMemoryMB: 50
            });
            const urls = Array.from({ length: 100 }, (_, i) => `https://example.com/page${i + 1}`);
            const prioritized = crawler.prioritizeUrls(urls);
            expect(prioritized).toHaveLength(100);
            expect(Array.isArray(prioritized)).toBe(true);
        });
        it('should maintain consistent performance metrics during stress test', () => {
            crawler = new performance_core_1.HighPerformanceCrawler(config);
            // Simulate processing many pages by manually updating metrics
            for (let i = 1; i <= 50; i++) {
                const isSuccess = Math.random() > 0.1;
                const result = {
                    status: isSuccess ? 'success' : 'error',
                    url: `https://example.com/page${i}`,
                    markdown: isSuccess ? `# Page ${i}` : undefined,
                    processingTime: Math.random() * 1000 + 100,
                    error: isSuccess ? undefined : 'test error'
                };
                const size = result.markdown?.length || 0;
                crawler.updatePageMetrics(result, result.processingTime, size);
                // Manually increment totalPages since we're testing metrics in isolation
                crawler.metrics.totalPages++;
            }
            const metrics = crawler.getMetrics();
            expect(metrics.totalPages).toBe(50);
            expect(metrics.successfulPages + metrics.failedPages).toBe(50);
            expect(metrics.slowestPages.length).toBeLessThanOrEqual(10);
            expect(metrics.largestPages.length).toBeLessThanOrEqual(10);
            expect(typeof metrics.throughputPagesPerSecond).toBe('number');
        });
    });
});
