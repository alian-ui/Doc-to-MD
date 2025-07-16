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
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs/promises"));
const globals_1 = require("@jest/globals");
// Mock external dependencies
globals_1.jest.mock('axios');
globals_1.jest.mock('fs/promises');
// Import enhanced functions to test
const enhanced_core_1 = require("./enhanced-core");
const mockedAxios = axios_1.default;
const mockedFs = fs;
describe('Enhanced Doc-to-MD Error Handling Test Suite', () => {
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
        // Reset console methods to avoid cluttering test output (except in specific test)
        globals_1.jest.spyOn(console, 'warn').mockImplementation(() => { });
        globals_1.jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        globals_1.jest.restoreAllMocks();
    });
    describe('Enhanced Navigation Link Extraction', () => {
        it('should return detailed error information', async () => {
            const mockHtml = `
        <html>
          <body>
            <nav class="docs-nav">
              <a href="/page1">Page 1</a>
              <a href="/invalid-url">Invalid</a>
              <a href="https://external.com/page3">Page 3</a>
            </nav>
          </body>
        </html>
      `;
            mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
            const result = await (0, enhanced_core_1.getNavigationLinks)('https://example.com', '.docs-nav');
            expect(result.links).toHaveLength(3); // All URLs are processed
            expect(result.errors).toHaveLength(0); // No critical errors
            expect(result.links).toContain('https://example.com/page1');
            expect(result.links).toContain('https://example.com/invalid-url'); // Relative URL resolved
            expect(result.links).toContain('https://external.com/page3');
        });
        it('should handle missing navigation selector', async () => {
            const mockHtml = '<html><body><div>No nav here</div></body></html>';
            mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
            const result = await (0, enhanced_core_1.getNavigationLinks)('https://example.com', '.nonexistent-nav');
            expect(result.links).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Navigation selector');
        });
        it('should handle invalid start URL', async () => {
            const result = await (0, enhanced_core_1.getNavigationLinks)('not-a-url', '.docs-nav');
            expect(result.links).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Invalid start URL');
        });
        it('should handle network errors gracefully', async () => {
            const networkError = new Error('Network error');
            networkError.code = 'ENOTFOUND';
            mockedAxios.get.mockRejectedValueOnce(networkError);
            const result = await (0, enhanced_core_1.getNavigationLinks)('https://example.com', '.nav');
            expect(result.links).toHaveLength(0);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toContain('Failed to fetch navigation links');
        });
    });
    describe('Enhanced Error Handling with Retries', () => {
        it('should retry on network errors', async () => {
            const networkError = new Error('ECONNREFUSED');
            networkError.code = 'ECONNREFUSED';
            // First two calls fail, third succeeds
            mockedAxios.get
                .mockRejectedValueOnce(networkError)
                .mockRejectedValueOnce(networkError)
                .mockResolvedValueOnce({
                data: '<html><body><article class="content"><h1>Success</h1></article></body></html>'
            });
            const result = await (0, enhanced_core_1.fetchAndConvertPage)('https://example.com/page1', '.content', false, '', { ...enhanced_core_1.DEFAULT_CRAWL_OPTIONS, retry: { maxRetries: 3, baseDelay: 100, maxDelay: 1000, retryOnStatus: [500, 502, 503] } });
            expect(result.status).toBe('success');
            expect(mockedAxios.get).toHaveBeenCalledTimes(3);
        });
        it('should not retry on non-retryable errors', async () => {
            const httpError = new Error('Request failed with status code 404');
            httpError.response = { status: 404, statusText: 'Not Found' };
            mockedAxios.get.mockRejectedValueOnce(httpError);
            const result = await (0, enhanced_core_1.fetchAndConvertPage)('https://example.com/page1', '.content', false, '');
            expect(result.status).toBe('error');
            expect(mockedAxios.get).toHaveBeenCalledTimes(1); // No retry for 404
            if (result.status === 'error') {
                expect(result.errorType).toBe('http');
                expect(result.httpStatus).toBe(404);
            }
        });
        it('should provide detailed error information', async () => {
            const timeoutError = new Error('timeout of 15000ms exceeded');
            // Make all retries fail, but limit retry delays for faster testing
            mockedAxios.get.mockRejectedValue(timeoutError);
            const fastRetryOptions = {
                ...enhanced_core_1.DEFAULT_CRAWL_OPTIONS,
                retry: { maxRetries: 1, baseDelay: 10, maxDelay: 100, retryOnStatus: [500] }
            };
            const result = await (0, enhanced_core_1.fetchAndConvertPage)('https://example.com/page1', '.content', false, '', fastRetryOptions);
            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.errorType).toBe('timeout');
                expect(result.error).toContain('timeout');
                expect(result.url).toBe('https://example.com/page1');
            }
        }, 10000); // Increase timeout for this test
        it('should handle custom CrawlError correctly', async () => {
            mockedAxios.get.mockResolvedValueOnce({
                data: '<html><body><div>No content here</div></body></html>'
            });
            const result = await (0, enhanced_core_1.fetchAndConvertPage)('https://example.com/page1', '.nonexistent', false, '');
            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.errorType).toBe('content');
                expect(result.error).toContain('Content selector');
            }
        });
    });
    describe('Enhanced Image Handling', () => {
        it('should handle image download failures gracefully', async () => {
            const networkError = new Error('Network error');
            mockedAxios.get.mockRejectedValueOnce(networkError);
            const result = await (0, enhanced_core_1.downloadImage)('https://example.com/image.jpg', '/test/images');
            expect(result.path).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Failed to download image');
        });
        it('should handle invalid image URLs', async () => {
            const result = await (0, enhanced_core_1.downloadImage)('not-a-url', '/test/images');
            expect(result.path).toBeNull();
            expect(result.error).toBeDefined();
            expect(result.error).toContain('Invalid image URL');
        });
        it('should add default extension to images without extension', async () => {
            const mockImageBuffer = Buffer.from('fake-image-data');
            mockedAxios.get.mockResolvedValueOnce({ data: mockImageBuffer });
            mockedFs.writeFile.mockResolvedValueOnce();
            const result = await (0, enhanced_core_1.downloadImage)('https://example.com/image', '/test/images');
            expect(result.path).toBe('images/image.jpg');
            expect(mockedFs.writeFile).toHaveBeenCalledWith('/test/images/image.jpg', mockImageBuffer);
        });
        it('should preserve original extension when present', async () => {
            const mockImageBuffer = Buffer.from('fake-image-data');
            mockedAxios.get.mockResolvedValueOnce({ data: mockImageBuffer });
            mockedFs.writeFile.mockResolvedValueOnce();
            const result = await (0, enhanced_core_1.downloadImage)('https://example.com/image.png', '/test/images');
            expect(result.path).toBe('images/image.png');
        });
    });
    describe('CrawlError Class', () => {
        it('should create error with correct properties', () => {
            const error = new enhanced_core_1.CrawlError('Test error', 'network', 'https://example.com', 500, 2);
            expect(error.message).toBe('Test error');
            expect(error.errorType).toBe('network');
            expect(error.url).toBe('https://example.com');
            expect(error.httpStatus).toBe(500);
            expect(error.retryCount).toBe(2);
            expect(error.name).toBe('CrawlError');
        });
    });
    describe('Content Processing with Image Error Handling', () => {
        it('should continue processing when some images fail to download', async () => {
            const mockHtml = `
        <html>
          <body>
            <article class="content">
              <h1>Test Article</h1>
              <img src="/good-image.jpg" alt="Good">
              <img src="invalid-url" alt="Bad">
              <p>Content continues...</p>
            </article>
          </body>
        </html>
      `;
            mockedAxios.get
                .mockResolvedValueOnce({ data: mockHtml }) // Main page
                .mockResolvedValueOnce({ data: Buffer.from('image-data') }) // First image succeeds
                .mockRejectedValueOnce(new Error('Image not found')); // Second image fails
            mockedFs.writeFile.mockResolvedValueOnce();
            const result = await (0, enhanced_core_1.fetchAndConvertPage)('https://example.com/page1', '.content', true, '/test/images');
            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.markdown).toContain('Test Article');
                expect(result.markdown).toContain('Content continues');
            }
        });
    });
});
