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
exports.EnhancedFormatter = void 0;
const fs = __importStar(require("fs/promises"));
const turndown_1 = __importDefault(require("turndown"));
const configurable_core_1 = require("./configurable-core");
class EnhancedFormatter {
    formattingOptions;
    enhancedTurndownService;
    configurable;
    constructor(config, formattingOptions = {}) {
        this.configurable = new configurable_core_1.ConfigurableCrawler(config);
        this.formattingOptions = {
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
            },
            ...formattingOptions
        };
        this.enhancedTurndownService = this.createEnhancedTurndownService();
    }
    createEnhancedTurndownService() {
        const turndown = new turndown_1.default({
            headingStyle: 'atx',
            hr: '---',
            bulletListMarker: this.formattingOptions.customStyles.listStyle === 'dash' ? '-' :
                this.formattingOptions.customStyles.listStyle === 'asterisk' ? '*' : '+',
            codeBlockStyle: 'fenced',
            fence: '```',
            emDelimiter: '_',
            strongDelimiter: '**',
            linkStyle: this.formattingOptions.customStyles.linkStyle === 'reference' ? 'referenced' : 'inlined'
        });
        // Enhanced table formatting
        if (this.formattingOptions.enableTableFormatting) {
            turndown.addRule('enhancedTable', {
                filter: 'table',
                replacement: (content, node) => this.formatTable(node)
            });
        }
        // Enhanced code block formatting
        if (this.formattingOptions.enableCodeBlockEnhancement) {
            turndown.addRule('enhancedCodeBlock', {
                filter: (node) => {
                    return node.nodeName === 'PRE' && node.firstChild?.nodeName === 'CODE';
                },
                replacement: (content, node) => this.formatCodeBlock(node)
            });
        }
        // Enhanced image formatting
        if (this.formattingOptions.enableImageOptimization) {
            turndown.addRule('enhancedImage', {
                filter: 'img',
                replacement: (content, node) => this.formatImage(node)
            });
        }
        // Enhanced link formatting
        if (this.formattingOptions.enableLinkFormatting) {
            turndown.addRule('enhancedLink', {
                filter: 'a',
                replacement: (content, node) => this.formatLink(content, node)
            });
        }
        return turndown;
    }
    formatTable(table) {
        const rows = [];
        const tableRows = table.querySelectorAll('tr');
        tableRows.forEach((row, index) => {
            const cells = [];
            const cellElements = row.querySelectorAll('td, th');
            cellElements.forEach(cell => {
                const cellContent = cell.textContent?.trim() || '';
                cells.push(cellContent.replace(/\|/g, '\\|')); // Escape pipes
            });
            if (cells.length > 0) {
                rows.push(cells);
            }
        });
        if (rows.length === 0)
            return '';
        let result = '';
        const maxCols = Math.max(...rows.map(row => row.length));
        // Header row
        if (rows.length > 0) {
            const headerRow = rows[0].map(cell => cell.padEnd(15)).slice(0, maxCols);
            result += '| ' + headerRow.join(' | ') + ' |\n';
            // Separator row
            const separator = Array(maxCols).fill('---').map(sep => sep.padEnd(15));
            result += '| ' + separator.join(' | ') + ' |\n';
            // Data rows
            for (let i = 1; i < rows.length; i++) {
                const dataRow = rows[i].map(cell => cell.padEnd(15)).slice(0, maxCols);
                // Pad with empty cells if needed
                while (dataRow.length < maxCols) {
                    dataRow.push(''.padEnd(15));
                }
                result += '| ' + dataRow.join(' | ') + ' |\n';
            }
        }
        return '\n' + result + '\n';
    }
    formatCodeBlock(pre) {
        const code = pre.querySelector('code');
        if (!code)
            return pre.textContent || '';
        const content = code.textContent || '';
        const language = this.detectLanguage(code);
        return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
    }
    detectLanguage(codeElement) {
        // Try to detect language from class names
        const className = codeElement.className;
        const languagePatterns = [
            /language-(\w+)/,
            /lang-(\w+)/,
            /highlight-(\w+)/,
            /(\w+)-code/
        ];
        for (const pattern of languagePatterns) {
            const match = className.match(pattern);
            if (match) {
                return match[1];
            }
        }
        // Detect by content patterns
        const content = codeElement.textContent || '';
        if (content.includes('function') && content.includes('{'))
            return 'javascript';
        if (content.includes('def ') && content.includes(':'))
            return 'python';
        if (content.includes('class ') && content.includes('public'))
            return 'java';
        if (content.includes('#include') || content.includes('int main'))
            return 'cpp';
        if (content.includes('SELECT') || content.includes('FROM'))
            return 'sql';
        if (content.includes('<html>') || content.includes('<div>'))
            return 'html';
        if (content.includes('body {') || content.includes('.class'))
            return 'css';
        if (content.includes('$ ') || content.includes('npm '))
            return 'bash';
        return '';
    }
    formatImage(img) {
        const src = img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || '';
        const title = img.getAttribute('title') || '';
        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        let result = `![${alt}](${src}`;
        if (title) {
            result += ` "${title}"`;
        }
        result += ')';
        // Add size information if available
        if (width || height) {
            result += ` <!-- ${width ? `width="${width}"` : ''} ${height ? `height="${height}"` : ''} -->`;
        }
        return result;
    }
    formatLink(content, link) {
        const href = link.getAttribute('href') || '';
        const title = link.getAttribute('title') || '';
        if (!href)
            return content;
        // Handle internal links
        if (href.startsWith('#')) {
            return `[${content}](${href})`;
        }
        // Handle relative links
        if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
            return `[${content}](${href})`;
        }
        // External links with title
        if (title) {
            return `[${content}](${href} "${title}")`;
        }
        return `[${content}](${href})`;
    }
    async fetchAndConvertPageWithFormatting(url) {
        const baseResult = await this.configurable.fetchAndConvertPage(url);
        if (baseResult.status === 'error') {
            return baseResult;
        }
        const markdown = baseResult.markdown || '';
        const formattedResult = {
            ...baseResult,
            formattedMarkdown: this.enhanceMarkdown(markdown),
            wordCount: this.countWords(markdown),
            readingTime: this.estimateReadingTime(markdown)
        };
        if (this.formattingOptions.generateTableOfContents) {
            formattedResult.tableOfContents = this.generateTocEntries(markdown, url);
        }
        return formattedResult;
    }
    enhanceMarkdown(markdown) {
        let enhanced = markdown;
        // Add page breaks if enabled
        if (this.formattingOptions.addPageBreaks) {
            enhanced = enhanced.replace(/^# /gm, '\n---\n\n# ');
        }
        // Enhance headings with custom prefixes
        if (this.formattingOptions.customStyles.headingPrefix) {
            enhanced = enhanced.replace(/^(#+)\s/gm, `$1 ${this.formattingOptions.customStyles.headingPrefix} `);
        }
        // Improve list formatting
        enhanced = this.improveListFormatting(enhanced);
        // Clean up excessive whitespace
        enhanced = this.cleanUpWhitespace(enhanced);
        // Add consistent spacing around code blocks
        enhanced = enhanced.replace(/```\n\n/g, '```\n');
        enhanced = enhanced.replace(/\n\n```/g, '\n```');
        return enhanced.trim();
    }
    improveListFormatting(markdown) {
        const lines = markdown.split('\n');
        let inList = false;
        let listLevel = 0;
        return lines.map((line, index) => {
            const trimmed = line.trim();
            // Detect list items
            const listMatch = trimmed.match(/^(\s*)([-*+]|\d+\.)\s/);
            if (listMatch) {
                const indent = listMatch[1];
                const newLevel = Math.floor(indent.length / 2);
                if (!inList) {
                    inList = true;
                    listLevel = newLevel;
                    return index > 0 ? '\n' + line : line;
                }
                else if (newLevel > listLevel) {
                    listLevel = newLevel;
                    return line;
                }
                else if (newLevel < listLevel) {
                    listLevel = newLevel;
                    return line;
                }
                return line;
            }
            else if (inList && trimmed === '') {
                // Empty line in list - maintain list context
                return line;
            }
            else if (inList && trimmed !== '') {
                // Non-list content - exit list mode
                inList = false;
                return '\n' + line;
            }
            return line;
        }).join('\n');
    }
    cleanUpWhitespace(markdown) {
        return markdown
            // Remove excessive blank lines (more than 2)
            .replace(/\n{4,}/g, '\n\n\n')
            // Ensure single space after headers
            .replace(/^(#+)\s+/gm, '$1 ')
            // Clean up spaces around emphasis
            .replace(/\s\*\s/g, ' * ')
            .replace(/\s_\s/g, ' _ ')
            // Ensure proper spacing around horizontal rules
            .replace(/\n---\n/g, '\n\n---\n\n');
    }
    generateTocEntries(markdown, url) {
        const headings = [];
        const lines = markdown.split('\n');
        let counter = 0;
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                const title = match[2].trim();
                const anchor = this.createAnchor(title);
                headings.push({
                    title,
                    level,
                    anchor,
                    url: `${url}#${anchor}`
                });
                counter++;
            }
        }
        return this.nestTableOfContents(headings);
    }
    createAnchor(title) {
        return title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    nestTableOfContents(flatToc) {
        const nested = [];
        const stack = [];
        for (const entry of flatToc) {
            // Find the appropriate parent level
            while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
                stack.pop();
            }
            if (stack.length === 0) {
                // Top level entry
                nested.push(entry);
            }
            else {
                // Child entry
                const parent = stack[stack.length - 1];
                if (!parent.children) {
                    parent.children = [];
                }
                parent.children.push(entry);
            }
            stack.push(entry);
        }
        return nested;
    }
    countWords(text) {
        const cleanText = text
            .replace(/```[\s\S]*?```/g, '') // Remove code blocks
            .replace(/`[^`]+`/g, '') // Remove inline code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Extract link text
            .replace(/[#*_`-]/g, '') // Remove markdown symbols
            .trim();
        if (!cleanText)
            return 0;
        return cleanText.split(/\s+/).length;
    }
    estimateReadingTime(text) {
        const wordsPerMinute = 200; // Average reading speed
        const wordCount = this.countWords(text);
        return Math.ceil(wordCount / wordsPerMinute);
    }
    async crawlWithEnhancedFormatting(baseUrl) {
        console.log(`🎨 Starting enhanced formatting crawl from: ${baseUrl}`);
        const urls = await this.configurable.getNavigationLinks(baseUrl);
        console.log(`📖 Found ${urls.length} pages to process with enhanced formatting`);
        const results = [];
        const globalToc = [];
        let totalWords = 0;
        let totalReadingTime = 0;
        let successfulPages = 0;
        let failedPages = 0;
        for (const url of urls) {
            try {
                console.log(`🎨 Processing with enhanced formatting: ${url}`);
                const result = await this.fetchAndConvertPageWithFormatting(url);
                if (result.status === 'success') {
                    results.push(result);
                    successfulPages++;
                    if (result.wordCount)
                        totalWords += result.wordCount;
                    if (result.readingTime)
                        totalReadingTime += result.readingTime;
                    if (result.tableOfContents) {
                        globalToc.push(...result.tableOfContents);
                    }
                }
                else {
                    failedPages++;
                    results.push(result);
                }
            }
            catch (error) {
                console.error(`❌ Enhanced formatting failed for ${url}:`, error);
                failedPages++;
                results.push({
                    status: 'error',
                    url,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        const summary = {
            totalPages: urls.length,
            totalWords,
            totalReadingTime,
            successfulPages,
            failedPages
        };
        console.log(`\n📊 Enhanced Formatting Summary:`);
        console.log(`   Total pages: ${summary.totalPages}`);
        console.log(`   Successful: ${summary.successfulPages}`);
        console.log(`   Failed: ${summary.failedPages}`);
        console.log(`   Total words: ${summary.totalWords.toLocaleString()}`);
        console.log(`   Estimated reading time: ${summary.totalReadingTime} minutes`);
        return { results, globalToc, summary };
    }
    async generateCombinedOutput(results, outputPath, options = {}) {
        const { includeGlobalToc = true, includeMetadata = true, includeStats = true, separatePages = true } = options;
        let combinedContent = '';
        // Add metadata header
        if (includeMetadata) {
            combinedContent += this.generateMetadataHeader(results);
        }
        // Add global table of contents
        if (includeGlobalToc) {
            combinedContent += this.generateGlobalTocMarkdown(results);
        }
        // Add statistics
        if (includeStats) {
            combinedContent += this.generateStatsSection(results);
        }
        // Add content from each page
        const successfulResults = results.filter(r => r.status === 'success');
        for (let i = 0; i < successfulResults.length; i++) {
            const result = successfulResults[i];
            if (separatePages && i > 0) {
                combinedContent += '\n\n---\n\n';
            }
            // Add page source URL
            combinedContent += `<!-- Source: ${result.url} -->\n\n`;
            // Add formatted markdown
            combinedContent += result.formattedMarkdown || result.markdown;
            if (i < successfulResults.length - 1) {
                combinedContent += '\n\n';
            }
        }
        await fs.writeFile(outputPath, combinedContent, 'utf-8');
        console.log(`✅ Enhanced formatted output saved to: ${outputPath}`);
    }
    generateMetadataHeader(results) {
        const successful = results.filter(r => r.status === 'success');
        const totalWords = successful.reduce((sum, r) => sum + (r.wordCount || 0), 0);
        const totalReadingTime = successful.reduce((sum, r) => sum + (r.readingTime || 0), 0);
        return `---
title: "Documentation Collection"
generated: "${new Date().toISOString()}"
pages: ${successful.length}
total_words: ${totalWords}
reading_time: "${totalReadingTime} minutes"
generator: "Doc-to-MD Enhanced Formatter"
---

`;
    }
    generateGlobalTocMarkdown(results) {
        let toc = '## Table of Contents\n\n';
        const successfulResults = results.filter(r => r.status === 'success');
        for (const result of successfulResults) {
            if (result.tableOfContents && result.tableOfContents.length > 0) {
                // Extract page title from first heading or URL
                const pageTitle = result.tableOfContents[0]?.title ||
                    result.url.split('/').pop() ||
                    'Untitled Page';
                toc += `### ${pageTitle}\n\n`;
                toc += this.renderTocEntries(result.tableOfContents, 0);
                toc += '\n';
            }
        }
        return toc + '\n';
    }
    renderTocEntries(entries, depth) {
        let result = '';
        const indent = '  '.repeat(depth);
        for (const entry of entries) {
            result += `${indent}- [${entry.title}](${entry.url})\n`;
            if (entry.children && entry.children.length > 0) {
                result += this.renderTocEntries(entry.children, depth + 1);
            }
        }
        return result;
    }
    generateStatsSection(results) {
        const successful = results.filter(r => r.status === 'success');
        const failed = results.filter(r => r.status === 'error');
        const totalWords = successful.reduce((sum, r) => sum + (r.wordCount || 0), 0);
        const totalReadingTime = successful.reduce((sum, r) => sum + (r.readingTime || 0), 0);
        const avgWordsPerPage = successful.length > 0 ? Math.round(totalWords / successful.length) : 0;
        return `## Collection Statistics

- **Total Pages**: ${results.length}
- **Successful**: ${successful.length}
- **Failed**: ${failed.length}
- **Total Words**: ${totalWords.toLocaleString()}
- **Average Words per Page**: ${avgWordsPerPage.toLocaleString()}
- **Estimated Reading Time**: ${totalReadingTime} minutes
- **Generated**: ${new Date().toLocaleString()}

`;
    }
}
exports.EnhancedFormatter = EnhancedFormatter;
exports.default = EnhancedFormatter;
