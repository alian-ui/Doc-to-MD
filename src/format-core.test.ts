import { jest } from '@jest/globals';
import { EnhancedFormatter, FormattingOptions, FormattedResult } from './format-core';
import { DocToMdConfig, DEFAULT_CONFIG } from './config';

// Mock the configurable crawler
jest.mock('./configurable-core', () => ({
  ConfigurableCrawler: jest.fn().mockImplementation(() => ({
    fetchAndConvertPage: jest.fn(),
    getNavigationLinks: jest.fn(),
  }))
}));

describe('Enhanced Formatter Test Suite', () => {
  let config: DocToMdConfig;
  let formattingOptions: FormattingOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      ...DEFAULT_CONFIG,
      selectors: {
        navigation: '.nav',
        content: '.content',
        excludeSelectors: [],
        includeSelectors: []
      }
    };

    formattingOptions = {
      enablePrettier: false,
      enableTableFormatting: true,
      enableCodeBlockEnhancement: true,
      enableLinkFormatting: true,
      enableImageOptimization: true,
      generateTableOfContents: true,
      includeBreadcrumbs: true,
      addPageBreaks: false,
      customStyles: {
        headingPrefix: '',
        codeBlockTheme: 'github',
        tableStyle: 'github',
        linkStyle: 'auto',
        listStyle: 'dash'
      }
    };
  });

  describe('Formatter Initialization', () => {
    it('should initialize with default formatting options', () => {
      const formatter = new EnhancedFormatter(config);
      
      expect(formatter).toBeInstanceOf(EnhancedFormatter);
    });

    it('should initialize with custom formatting options', () => {
      const customOptions: Partial<FormattingOptions> = {
        enableTableFormatting: false,
        customStyles: {
          headingPrefix: '📖',
          codeBlockTheme: 'monokai',
          tableStyle: 'grid',
          linkStyle: 'reference',
          listStyle: 'asterisk'
        }
      };

      const formatter = new EnhancedFormatter(config, customOptions);
      
      expect(formatter).toBeInstanceOf(EnhancedFormatter);
    });
  });

  describe('Markdown Enhancement', () => {
    it('should enhance basic markdown formatting', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const basicMarkdown = `# Test Document

This is a test paragraph.

## Section 1

- Item 1
- Item 2
  - Nested item

### Subsection

Some content here.`;

      const result = (formatter as any).enhanceMarkdown(basicMarkdown);
      
      expect(result).toContain('# Test Document');
      expect(result).toContain('## Section 1');
      expect(result).toContain('### Subsection');
      expect(result).not.toContain('\n\n\n\n'); // Should not have excessive blank lines
    });

    it('should clean up excessive whitespace', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const messyMarkdown = `# Title



## Section




Content here.




Another paragraph.`;

      const result = (formatter as any).cleanUpWhitespace(messyMarkdown);
      
      // Should reduce excessive line breaks
      expect(result.match(/\n{4,}/g)).toBeNull();
    });

    it('should improve list formatting', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const listMarkdown = `Some text
- Item 1
- Item 2
  - Nested item
- Item 3
More text`;

      const result = (formatter as any).improveListFormatting(listMarkdown);
      
      expect(result).toContain('- Item 1');
      expect(result).toContain('  - Nested item');
    });
  });

  describe('Table Formatting', () => {
    it('should format tables correctly', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      // Create a mock table element without using DOMParser
      const mockTable = {
        querySelectorAll: jest.fn((selector: string) => {
          if (selector === 'tr') {
            return [
              {
                querySelectorAll: jest.fn(() => [
                  { textContent: 'Name' },
                  { textContent: 'Value' }
                ])
              },
              {
                querySelectorAll: jest.fn(() => [
                  { textContent: 'Test' },
                  { textContent: '123' }
                ])
              },
              {
                querySelectorAll: jest.fn(() => [
                  { textContent: 'Example' },
                  { textContent: '456' }
                ])
              }
            ];
          }
          return [];
        })
      } as unknown as HTMLTableElement;
      
      const result = (formatter as any).formatTable(mockTable);
      
      expect(result).toContain('| Name');
      expect(result).toContain('| Value');
      expect(result).toContain('| ---');
      expect(result).toContain('| Test');
      expect(result).toContain('| 123');
    });

    it('should handle empty tables', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const mockEmptyTable = {
        querySelectorAll: jest.fn(() => [])
      } as unknown as HTMLTableElement;
      
      const result = (formatter as any).formatTable(mockEmptyTable);
      
      expect(result).toBe('');
    });
  });

  describe('Code Block Enhancement', () => {
    it('should detect programming languages correctly', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const testCases = [
        { className: 'language-javascript', expected: 'javascript' },
        { className: 'lang-python', expected: 'python' },
        { className: 'highlight-sql', expected: 'sql' },
        { className: 'java-code', expected: 'java' },
        { className: 'no-language', expected: '' }
      ];

      testCases.forEach(({ className, expected }) => {
        const mockElement = { className } as HTMLElement;
        const result = (formatter as any).detectLanguage(mockElement);
        expect(result).toBe(expected);
      });
    });

    it('should detect language from content patterns', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const testCases = [
        { content: 'function test() { return true; }', expected: 'javascript' },
        { content: 'def hello():\n    print("world")', expected: 'python' },
        { content: 'SELECT * FROM users WHERE id = 1', expected: 'sql' },
        { content: '<html><body>Hello</body></html>', expected: 'html' },
        { content: 'body { color: red; }', expected: 'css' },
        { content: '$ npm install package', expected: 'bash' },
        { content: 'Random text content', expected: '' }
      ];

      testCases.forEach(({ content, expected }) => {
        const mockElement = { className: '', textContent: content } as HTMLElement;
        const result = (formatter as any).detectLanguage(mockElement);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Word Count and Reading Time', () => {
    it('should count words correctly', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const testMarkdown = `# Title

This is a test document with **bold** and *italic* text.

\`\`\`javascript
function test() {
  return "code";
}
\`\`\`

Regular paragraph with [link](http://example.com) text.`;

      const wordCount = (formatter as any).countWords(testMarkdown);
      
      // Should count words excluding code blocks and markdown syntax
      expect(wordCount).toBeGreaterThan(0);
      expect(wordCount).toBeLessThan(50); // Reasonable range
    });

    it('should estimate reading time correctly', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const longText = 'word '.repeat(400); // 400 words
      const readingTime = (formatter as any).estimateReadingTime(longText);
      
      // Should be approximately 2 minutes (400 words / 200 words per minute)
      expect(readingTime).toBe(2);
    });

    it('should handle empty text', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      expect((formatter as any).countWords('')).toBe(0);
      expect((formatter as any).estimateReadingTime('')).toBe(0);
    });
  });

  describe('Table of Contents Generation', () => {
    it('should generate table of contents from markdown', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const markdownWithHeadings = `# Main Title

## Section 1

### Subsection A

## Section 2

### Subsection B

#### Sub-subsection`;

      const toc = (formatter as any).generateTocEntries(markdownWithHeadings, 'http://example.com');
      
      // The TOC is nested, so we should have 1 top-level item with nested children
      expect(toc).toHaveLength(1); // One top-level heading
      expect(toc[0].title).toBe('Main Title');
      expect(toc[0].level).toBe(1);
      expect(toc[0].children).toHaveLength(2); // Two second-level sections
      expect(toc[0].children[0].title).toBe('Section 1');
      expect(toc[0].children[0].children).toHaveLength(1); // One subsection
      expect(toc[0].children[0].children[0].title).toBe('Subsection A');
    });

    it('should create proper anchors from titles', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const testCases = [
        { title: 'Simple Title', expected: 'simple-title' },
        { title: 'Title with Special Characters!@#', expected: 'title-with-special-characters' },
        { title: 'Multiple   Spaces', expected: 'multiple-spaces' },
        { title: 'Title-with-dashes', expected: 'title-with-dashes' }
      ];

      testCases.forEach(({ title, expected }) => {
        const result = (formatter as any).createAnchor(title);
        expect(result).toBe(expected);
      });
    });

    it('should nest table of contents correctly', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const flatToc = [
        { title: 'Title', level: 1, anchor: 'title', url: '#title' },
        { title: 'Section', level: 2, anchor: 'section', url: '#section' },
        { title: 'Subsection', level: 3, anchor: 'subsection', url: '#subsection' },
        { title: 'Another Section', level: 2, anchor: 'another', url: '#another' }
      ];

      const nested = (formatter as any).nestTableOfContents(flatToc);
      
      expect(nested).toHaveLength(1); // One top-level item
      expect(nested[0].children).toHaveLength(2); // Two second-level items
      expect(nested[0].children[0].children).toHaveLength(1); // One third-level item
    });
  });

  describe('Image and Link Formatting', () => {
    it('should format images with attributes', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const mockImg = {
        getAttribute: jest.fn((attr: string) => {
          const attrs: Record<string, string> = {
            src: 'image.jpg',
            alt: 'Test Image',
            title: 'Image Title',
            width: '300',
            height: '200'
          };
          return attrs[attr] || null;
        })
      } as unknown as HTMLImageElement;

      const result = (formatter as any).formatImage(mockImg);
      
      expect(result).toContain('![Test Image](image.jpg "Image Title")');
      expect(result).toContain('width="300"');
      expect(result).toContain('height="200"');
    });

    it('should format links correctly', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const testCases = [
        {
          content: 'Example',
          href: 'https://example.com',
          title: 'Example Site',
          expected: '[Example](https://example.com "Example Site")'
        },
        {
          content: 'Internal Link',
          href: '#section',
          title: '',
          expected: '[Internal Link](#section)'
        },
        {
          content: 'Relative Link',
          href: './page.html',
          title: '',
          expected: '[Relative Link](./page.html)'
        }
      ];

      testCases.forEach(({ content, href, title, expected }) => {
        const mockLink = {
          getAttribute: jest.fn((attr: string) => {
            const attrs: Record<string, string> = { href, title };
            return attrs[attr] || null;
          })
        } as unknown as HTMLAnchorElement;

        const result = (formatter as any).formatLink(content, mockLink);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Metadata Generation', () => {
    it('should generate metadata header', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const mockResults: FormattedResult[] = [
        {
          status: 'success',
          url: 'http://example.com/page1',
          markdown: 'Content 1',
          wordCount: 100,
          readingTime: 1
        },
        {
          status: 'success',
          url: 'http://example.com/page2',
          markdown: 'Content 2',
          wordCount: 200,
          readingTime: 2
        }
      ];

      const header = (formatter as any).generateMetadataHeader(mockResults);
      
      expect(header).toContain('title: "Documentation Collection"');
      expect(header).toContain('pages: 2');
      expect(header).toContain('total_words: 300');
      expect(header).toContain('reading_time: "3 minutes"');
    });

    it('should generate statistics section', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const mockResults: FormattedResult[] = [
        {
          status: 'success',
          url: 'http://example.com/page1',
          markdown: 'Content 1',
          wordCount: 150,
          readingTime: 1
        },
        {
          status: 'error',
          url: 'http://example.com/page2',
          error: 'Failed to fetch'
        }
      ];

      const stats = (formatter as any).generateStatsSection(mockResults);
      
      expect(stats).toContain('**Total Pages**: 2');
      expect(stats).toContain('**Successful**: 1');
      expect(stats).toContain('**Failed**: 1');
      expect(stats).toContain('**Total Words**: 150');
      expect(stats).toContain('**Average Words per Page**: 150');
    });
  });

  describe('Integration Tests', () => {
    it('should process a complete markdown document', () => {
      const formatter = new EnhancedFormatter(config, formattingOptions);
      
      const inputMarkdown = `# Documentation

## Getting Started

This is the introduction.

### Installation

\`\`\`bash
npm install package
\`\`\`

## API Reference

| Method | Description |
|--------|-------------|
| get()  | Retrieves data |
| set()  | Sets data |

### Examples

Here are some examples.`;

      const enhanced = (formatter as any).enhanceMarkdown(inputMarkdown);
      const wordCount = (formatter as any).countWords(inputMarkdown);
      const readingTime = (formatter as any).estimateReadingTime(inputMarkdown);
      const toc = (formatter as any).generateTocEntries(inputMarkdown, 'http://example.com');
      
      expect(enhanced).toBeTruthy();
      expect(wordCount).toBeGreaterThan(0);
      expect(readingTime).toBeGreaterThan(0);
      expect(toc.length).toBeGreaterThan(0);
    });
  });
});
