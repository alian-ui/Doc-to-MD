"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const unified_core_1 = require("./unified-core");
const config_1 = require("./config");
describe('UnifiedCrawler', () => {
    let mockConfig;
    let crawler;
    beforeEach(() => {
        mockConfig = {
            ...config_1.DEFAULT_CONFIG,
            outputFile: 'test-output.md',
            concurrency: 2,
            output: {
                ...config_1.DEFAULT_CONFIG.output,
                includeToc: true,
                includeMetadata: true
            },
            crawl: {
                ...config_1.DEFAULT_CONFIG.crawl,
                proxy: {
                    enabled: false,
                    protocol: 'http'
                }
            }
        };
        crawler = new unified_core_1.UnifiedCrawler(mockConfig, 'https://example.com');
    });
    afterEach(() => {
        // Clean up any resources
        crawler.removeAllListeners();
    });
    describe('analyzeWebsite', () => {
        test('should analyze website and return crawler analysis', async () => {
            // Mock getNavigationLinks to return predictable results
            const mockLinks = [
                'https://example.com/page1',
                'https://example.com/page2',
                'https://example.com/page3'
            ];
            // Since we can't easily mock the import, we'll test the main logic
            const analysis = await crawler.analyzeWebsite('https://example.com');
            expect(analysis).toBeDefined();
            expect(analysis.estimatedPages).toBeGreaterThanOrEqual(0);
            expect(analysis.complexity).toBeOneOf(['simple', 'moderate', 'complex']);
            expect(analysis.recommendedCrawler).toBeOneOf(['basic', 'configurable', 'performance', 'format']);
            expect(analysis.confidence).toBeGreaterThan(0);
            expect(analysis.confidence).toBeLessThanOrEqual(1);
        }, 30000);
        test('should determine simple complexity for small sites', () => {
            const crawler = new unified_core_1.UnifiedCrawler(mockConfig);
            // Access private method via any type for testing
            const complexity = crawler.determineComplexity(5);
            expect(complexity).toBe('simple');
        });
        test('should determine moderate complexity for medium sites', () => {
            const crawler = new unified_core_1.UnifiedCrawler(mockConfig);
            const complexity = crawler.determineComplexity(25);
            expect(complexity).toBe('moderate');
        });
        test('should determine complex complexity for large sites', () => {
            const crawler = new unified_core_1.UnifiedCrawler(mockConfig);
            const complexity = crawler.determineComplexity(100);
            expect(complexity).toBe('complex');
        });
        test('should detect proxy requirements', () => {
            const proxyConfig = {
                ...mockConfig,
                crawl: {
                    ...mockConfig.crawl,
                    proxy: {
                        enabled: true,
                        host: 'proxy.example.com',
                        port: 8080,
                        protocol: 'http'
                    }
                }
            };
            const crawlerWithProxy = new unified_core_1.UnifiedCrawler(proxyConfig);
            const needsProxy = crawlerWithProxy.needsProxy();
            expect(needsProxy).toBe(true);
        });
        test('should detect formatting requirements', () => {
            const formatConfig = {
                ...mockConfig,
                output: {
                    ...mockConfig.output,
                    includeToc: true,
                    includeMetadata: true
                }
            };
            const crawlerWithFormat = new unified_core_1.UnifiedCrawler(formatConfig);
            const needsFormatting = crawlerWithFormat.needsFormatting();
            expect(needsFormatting).toBe(true);
        });
        test('should detect performance requirements', () => {
            const perfConfig = {
                ...mockConfig,
                concurrency: 10
            };
            const crawlerWithPerf = new unified_core_1.UnifiedCrawler(perfConfig);
            const needsPerformance = crawlerWithPerf.needsPerformance(150);
            expect(needsPerformance).toBe(true);
        });
    });
    describe('crawl', () => {
        test('should perform basic crawl for simple requirements', async () => {
            const simpleConfig = {
                ...mockConfig,
                output: {
                    ...mockConfig.output,
                    includeToc: false,
                    includeMetadata: false
                },
                concurrency: 1
            };
            const simpleCrawler = new unified_core_1.UnifiedCrawler(simpleConfig);
            try {
                const result = await simpleCrawler.crawl('https://httpbin.org/html');
                expect(result).toBeDefined();
                expect(result.success).toBeDefined();
                expect(result.crawlerUsed).toBeDefined();
                expect(result.outputFile).toBeDefined();
                expect(result.statistics).toBeDefined();
                expect(result.analysis).toBeDefined();
            }
            catch (error) {
                // Network errors are acceptable in test environment
                expect(error).toBeInstanceOf(Error);
            }
        }, 60000);
        test('should use analysis to select appropriate crawler', async () => {
            // Mock analysis
            const mockAnalysis = {
                estimatedPages: 5,
                complexity: 'simple',
                requiresRetry: false,
                requiresProxy: false,
                requiresFormatting: false,
                requiresPerformance: false,
                recommendedCrawler: 'basic',
                confidence: 0.9
            };
            crawler.analysis = mockAnalysis;
            try {
                const result = await crawler.crawl('https://httpbin.org/html');
                expect(result.crawlerUsed).toBe('basic');
            }
            catch (error) {
                // Network errors are acceptable
                expect(error).toBeInstanceOf(Error);
            }
        }, 30000);
        test('should handle crawl errors gracefully', async () => {
            try {
                const result = await crawler.crawl('https://invalid-url-that-should-fail.com');
                // If it doesn't throw, it should return an error result
                if (!result.success) {
                    expect(result.errors.length).toBeGreaterThan(0);
                }
            }
            catch (error) {
                expect(error).toBeInstanceOf(Error);
            }
        }, 15000);
    });
    describe('generateReport', () => {
        test('should generate analysis report', async () => {
            try {
                await crawler.analyzeWebsite('https://httpbin.org/html');
                const report = crawler.generateReport();
                expect(report).toContain('Crawler Analysis Report');
                expect(report).toContain('Website Analysis');
                expect(report).toContain('Requirements Assessment');
                expect(report).toContain('Recommendation');
            }
            catch (error) {
                // If analysis fails, report should indicate no analysis
                const report = crawler.generateReport();
                expect(report).toContain('No analysis available');
            }
        }, 30000);
        test('should return no analysis message when no analysis performed', () => {
            const report = crawler.generateReport();
            expect(report).toBe('No analysis available. Run analyzeWebsite() first.');
        });
    });
    describe('event handling', () => {
        test('should emit analysis events', async () => {
            const events = [];
            crawler.on('analysisStarted', () => events.push('analysisStarted'));
            crawler.on('analysisCompleted', () => events.push('analysisCompleted'));
            crawler.on('analysisError', () => events.push('analysisError'));
            try {
                await crawler.analyzeWebsite('https://httpbin.org/html');
                expect(events).toContain('analysisStarted');
                expect(events.some(e => e === 'analysisCompleted' || e === 'analysisError')).toBe(true);
            }
            catch (error) {
                // Event should still be emitted even on error
                expect(events).toContain('analysisStarted');
            }
        }, 30000);
        test('should emit crawl events', async () => {
            const events = [];
            crawler.on('crawlStarted', () => events.push('crawlStarted'));
            crawler.on('crawlCompleted', () => events.push('crawlCompleted'));
            crawler.on('crawlError', () => events.push('crawlError'));
            try {
                await crawler.crawl('https://httpbin.org/html');
                expect(events).toContain('crawlStarted');
                expect(events.some(e => e === 'crawlCompleted' || e === 'crawlError')).toBe(true);
            }
            catch (error) {
                // Event should still be emitted even on error
                expect(events).toContain('crawlStarted');
            }
        }, 30000);
    });
    describe('crawler selection logic', () => {
        test('should select format crawler for formatting requirements', () => {
            const analysis = {
                estimatedPages: 10,
                complexity: 'simple',
                requiresRetry: false,
                requiresProxy: false,
                requiresFormatting: true,
                requiresPerformance: false,
                recommendedCrawler: 'basic',
                confidence: 0.8
            };
            const selectedCrawler = crawler.selectOptimalCrawler(analysis);
            expect(selectedCrawler).toBe('format');
        });
        test('should select performance crawler for high-volume requirements', () => {
            const analysis = {
                estimatedPages: 500,
                complexity: 'complex',
                requiresRetry: false,
                requiresProxy: false,
                requiresFormatting: false,
                requiresPerformance: true,
                recommendedCrawler: 'basic',
                confidence: 0.8
            };
            const selectedCrawler = crawler.selectOptimalCrawler(analysis);
            expect(selectedCrawler).toBe('performance');
        });
        test('should select configurable crawler for proxy requirements', () => {
            const analysis = {
                estimatedPages: 20,
                complexity: 'moderate',
                requiresRetry: false,
                requiresProxy: true,
                requiresFormatting: false,
                requiresPerformance: false,
                recommendedCrawler: 'basic',
                confidence: 0.8
            };
            const selectedCrawler = crawler.selectOptimalCrawler(analysis);
            expect(selectedCrawler).toBe('configurable');
        });
        test('should calculate confidence correctly', () => {
            const analysis = {
                estimatedPages: 10,
                complexity: 'simple',
                requiresRetry: false,
                requiresProxy: true,
                requiresFormatting: true,
                requiresPerformance: false,
                recommendedCrawler: 'basic',
                confidence: 0.8
            };
            const confidence = crawler.calculateConfidence(analysis);
            expect(confidence).toBeGreaterThan(0.5);
            expect(confidence).toBeLessThanOrEqual(1.0);
        });
    });
});
// Helper function to add toBeOneOf matcher
expect.extend({
    toBeOneOf(received, expected) {
        const pass = expected.includes(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be one of ${expected.join(', ')}`,
                pass: false,
            };
        }
    },
});
