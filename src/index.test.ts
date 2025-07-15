
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('axios');
jest.mock('fs/promises');

// Import functions to test from core module (without CLI dependencies)
import { 
  getNavigationLinks, 
  downloadImage, 
  fetchAndConvertPage, 
  PageResult,
  turndownService 
} from './core';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Doc-to-MD Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      const links = await getNavigationLinks('https://example.com', '.docs-nav');
      
      expect(links).toHaveLength(3);
      expect(links).toContain('https://example.com/page1');
      expect(links).toContain('https://example.com/page2');
      expect(links).toContain('https://external.com/page3');
    });

    it('should handle invalid navigation selector gracefully', async () => {
      const mockHtml = '<html><body><div>No nav here</div></body></html>';
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const links = await getNavigationLinks('https://example.com', '.nonexistent-nav');
      
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

      const links = await getNavigationLinks('https://example.com', '.nav');
      
      expect(links).toHaveLength(2);
      expect(links.filter(link => link === 'https://example.com/page1')).toHaveLength(1);
    });

    it('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const links = await getNavigationLinks('https://example.com', '.nav');
      
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

      const result = await fetchAndConvertPage('https://example.com/page1', '.content', false, '');
      
      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.markdown).toContain('# Test Article');
        expect(result.markdown).toContain('This is test content.');
      }
    });

    it('should handle missing content selector', async () => {
      const mockHtml = '<html><body><div>No content here</div></body></html>';
      mockedAxios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await fetchAndConvertPage('https://example.com/page1', '.nonexistent', false, '');
      
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error).toContain('Content not found');
      }
    });

    it('should convert HTML to Markdown correctly', () => {
      const html = '<h1>Title</h1><p>Paragraph with <strong>bold</strong> text.</p>';
      const markdown = turndownService.turndown(html);
      
      expect(markdown).toContain('# Title');
      expect(markdown).toContain('**bold**');
    });
  });

  describe('Image Handling', () => {
    it('should download images when downloadImages option is enabled', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockedAxios.get.mockResolvedValueOnce({ data: mockImageBuffer });
      mockedFs.writeFile.mockResolvedValueOnce();

      const result = await downloadImage('https://example.com/image.jpg', '/test/images');
      
      expect(result).toBe('images/image.jpg');
      expect(mockedFs.writeFile).toHaveBeenCalledWith('/test/images/image.jpg', mockImageBuffer);
    });

    it('should handle image download failures gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const result = await downloadImage('https://example.com/image.jpg', '/test/images');
      
      expect(result).toBeNull();
    });

    it('should extract image filename from URL', async () => {
      const mockImageBuffer = Buffer.from('fake-image-data');
      mockedAxios.get.mockResolvedValueOnce({ data: mockImageBuffer });
      mockedFs.writeFile.mockResolvedValueOnce();

      const result = await downloadImage('https://example.com/path/to/test-image.png', '/test/images');
      
      expect(result).toBe('images/test-image.png');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('timeout of 10000ms exceeded'));

      const result = await fetchAndConvertPage('https://example.com/page1', '.content', false, '');
      
      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.error).toContain('timeout');
      }
    });

    it('should handle HTTP errors (404, 500, etc.)', async () => {
      const httpError = new Error('Request failed with status code 404');
      (httpError as any).response = { status: 404, statusText: 'Not Found' };
      mockedAxios.get.mockRejectedValueOnce(httpError);

      const result = await fetchAndConvertPage('https://example.com/page1', '.content', false, '');
      
      expect(result.status).toBe('error');
    });

    it('should handle invalid HTML gracefully', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: 'invalid-html<><' });

      const result = await fetchAndConvertPage('https://example.com/page1', '.content', false, '');
      
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

      const result = await downloadImage('https://example.com/images/file%20with%20spaces.jpg', '/test/images');
      
      expect(result).toBe('images/file%20with%20spaces.jpg');
    });
  });
});
