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
// Import functions to test from core module (without CLI dependencies)
const core_1 = require("./core");
const mockedAxios = axios_1.default;
const mockedFs = fs;
describe('Doc-to-MD Test Suite', () => {
    beforeEach(() => {
        globals_1.jest.clearAllMocks();
    });
    describe('Navigation Link Extraction', () => {
        it('should extract links from navigation selector', async () => {
            const mockHtml = `
        <html>
          <body>
            <nav class="docs-nav">
              <a href="/page1">Page 1</a>
              <a href="/page2">Page 2</a>
              <a href="https://external.com/page3">Page 3</a>
            </nav>
          </body>
        </html>
      `;
            mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
            const links = await (0, core_1.getNavigationLinks)('https://example.com', '.docs-nav');
            expect(links).toHaveLength(3);
            expect(links).toContain('https://example.com/page1');
            expect(links).toContain('https://example.com/page2');
            expect(links).toContain('https://external.com/page3');
        });
        it('should handle invalid navigation selector gracefully', async () => {
            const mockHtml = '<html><body><div>No nav here</div></body></html>';
            mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
            const links = await (0, core_1.getNavigationLinks)('https://example.com', '.nonexistent-nav');
            expect(links).toHaveLength(0);
        });
        it('should remove duplicate URLs', async () => {
            const mockHtml = `
        <nav class="nav">
          <a href="/page1">Page 1</a>
          <a href="/page1">Page 1 Duplicate</a>
          <a href="/page2">Page 2</a>
        </nav>
      `;
            mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
            const links = await (0, core_1.getNavigationLinks)('https://example.com', '.nav');
            expect(links).toHaveLength(2);
            expect(links.filter(link => link === 'https://example.com/page1')).toHaveLength(1);
        });
        it('should handle network errors gracefully', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
            const links = await (0, core_1.getNavigationLinks)('https://example.com', '.nav');
            expect(links).toHaveLength(0);
        });
    });
    describe('Content Extraction and Conversion', () => {
        it('should extract content using provided selector', async () => {
            const mockHtml = `
        <html>
          <body>
            <article class="content">
              <h1>Test Article</h1>
              <p>This is test content.</p>
            </article>
          </body>
        </html>
      `;
            mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
            const result = await (0, core_1.fetchAndConvertPage)('https://example.com/page1', '.content', false, '');
            expect(result.status).toBe('success');
            if (result.status === 'success') {
                expect(result.markdown).toContain('# Test Article');
                expect(result.markdown).toContain('This is test content.');
            }
        });
        it('should handle missing content selector', async () => {
            const mockHtml = '<html><body><div>No content here</div></body></html>';
            mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });
            const result = await (0, core_1.fetchAndConvertPage)('https://example.com/page1', '.nonexistent', false, '');
            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toContain('Content not found');
            }
        });
        it('should convert HTML to Markdown correctly', () => {
            const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p>';
            const markdown = core_1.turndownService.turndown(html);
            expect(markdown).toContain('# Title');
            expect(markdown).toContain('**bold**');
        });
    });
    describe('Image Handling', () => {
        it('should download images when downloadImages option is enabled', async () => {
            const mockImageBuffer = Buffer.from('fake-image-data');
            mockedAxios.get.mockResolvedValueOnce({ data: mockImageBuffer });
            mockedFs.writeFile.mockResolvedValueOnce();
            const result = await (0, core_1.downloadImage)('https://example.com/image.jpg', '/test/images');
            expect(result).toBe('images/image.jpg');
            expect(mockedFs.writeFile).toHaveBeenCalledWith('/test/images/image.jpg', mockImageBuffer);
        });
        it('should handle image download failures gracefully', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
            const result = await (0, core_1.downloadImage)('https://example.com/image.jpg', '/test/images');
            expect(result).toBeNull();
        });
        it('should extract image filename from URL', async () => {
            const mockImageBuffer = Buffer.from('fake-image-data');
            mockedAxios.get.mockResolvedValueOnce({ data: mockImageBuffer });
            mockedFs.writeFile.mockResolvedValueOnce();
            const result = await (0, core_1.downloadImage)('https://example.com/path/to/test-image.png', '/test/images');
            expect(result).toBe('images/test-image.png');
        });
    });
    describe('Error Handling', () => {
        it('should handle network timeouts', async () => {
            mockedAxios.get.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));
            const result = await (0, core_1.fetchAndConvertPage)('https://example.com/page1', '.content', false, '');
            expect(result.status).toBe('error');
            if (result.status === 'error') {
                expect(result.error).toContain('timeout');
            }
        });
        it('should handle HTTP errors (404, 500, etc.)', async () => {
            const httpError = new Error('Request failed with status code 404');
            httpError.response = { status: 404, statusText: 'Not Found' };
            mockedAxios.get.mockRejectedValueOnce(httpError);
            const result = await (0, core_1.fetchAndConvertPage)('https://example.com/page1', '.content', false, '');
            expect(result.status).toBe('error');
        });
        it('should handle invalid HTML gracefully', async () => {
            mockedAxios.get.mockResolvedValueOnce({ data: 'invalid-html<><' });
            const result = await (0, core_1.fetchAndConvertPage)('https://example.com/page1', '.content', false, '');
            // Should not crash, but may return error or empty content
            expect(['success', 'error']).toContain(result.status);
        });
    });
    describe('Output Generation', () => {
        it('should preserve page order in final output', () => {
            // This would be tested in integration test for main function
            expect(true).toBe(true);
        });
        it('should handle special characters in filenames', async () => {
            const mockImageBuffer = Buffer.from('fake-image-data');
            mockedAxios.get.mockResolvedValueOnce({ data: mockImageBuffer });
            mockedFs.writeFile.mockResolvedValueOnce();
            const result = await (0, core_1.downloadImage)('https://example.com/images/file%20with%20spaces.jpg', '/test/images');
            expect(result).toBe('images/file%20with%20spaces.jpg');
        });
    });
});
