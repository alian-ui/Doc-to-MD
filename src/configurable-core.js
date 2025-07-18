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
exports.ConfigurableCrawler = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const turndown_1 = __importDefault(require("turndown"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const p_limit_1 = __importDefault(require("p-limit"));
const enhanced_core_1 = require("./enhanced-core");
class ConfigurableCrawler {
    config;
    turndownService;
    rateLimiter;
    cookieJar = {};
    constructor(config) {
        this.config = config;
        this.turndownService = this.initializeTurndownService();
        this.initializeRateLimiter();
        if (this.config.crawl.cookies.enabled && this.config.crawl.cookies.jar) {
            this.cookieJar = { ...this.config.crawl.cookies.jar };
        }
    }
    initializeTurndownService() {
        const service = new turndown_1.default({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });
        // Add custom rules for better output quality
        service.addRule('preserveCodeBlocks', {
            filter: 'pre',
            replacement: (content, node) => {
                const codeElement = node.querySelector('code');
                const language = codeElement ?
                    (codeElement.className.match(/language-(\w+)/) || [])[1] || '' : '';
                return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
            }
        });
        service.addRule('preserveTables', {
            filter: 'table',
            replacement: (content, node) => {
                // Enhanced table handling
                return content;
            }
        });
        return service;
    }
    initializeRateLimiter() {
        if (this.config.crawl.rateLimit.enabled) {
            const limit = (0, p_limit_1.default)(this.config.crawl.rateLimit.requestsPerSecond);
            this.rateLimiter = limit;
        }
    }
    async createAxiosConfig(url) {
        const config = {
            timeout: this.config.crawl.timeout,
            headers: {
                'User-Agent': this.config.crawl.userAgent,
                ...this.config.crawl.customHeaders
            },
            maxRedirects: this.config.crawl.maxRedirects,
            httpsAgent: undefined
        };
        // Add proxy configuration
        if (this.config.crawl.proxy.enabled) {
            config.proxy = {
                protocol: this.config.crawl.proxy.protocol || 'http',
                host: this.config.crawl.proxy.host,
                port: this.config.crawl.proxy.port,
                auth: this.config.crawl.proxy.auth ? {
                    username: this.config.crawl.proxy.auth.username,
                    password: this.config.crawl.proxy.auth.password
                } : undefined
            };
        }
        // Add SSL configuration
        if (url.startsWith('https://')) {
            const https = await Promise.resolve().then(() => __importStar(require('https')));
            config.httpsAgent = new https.Agent({
                rejectUnauthorized: this.config.crawl.sslConfig.rejectUnauthorized,
                secureOptions: this.config.crawl.sslConfig.allowSelfSigned ? 0 : undefined,
                ciphers: this.config.crawl.sslConfig.ciphers
            });
        }
        // Add cookies
        if (this.config.crawl.cookies.enabled) {
            const domain = new URL(url).hostname;
            const cookies = this.cookieJar[domain];
            if (cookies) {
                config.headers['Cookie'] = cookies;
            }
        }
        return config;
    }
    async makeRequest(url, responseType = 'text') {
        const axiosConfig = await this.createAxiosConfig(url);
        axiosConfig.responseType = responseType;
        const executeRequest = async () => {
            try {
                const response = await axios_1.default.get(url, axiosConfig);
                // Store cookies if enabled
                if (this.config.crawl.cookies.enabled && response.headers['set-cookie']) {
                    const domain = new URL(url).hostname;
                    this.cookieJar[domain] = response.headers['set-cookie'].join('; ');
                }
                return response.data;
            }
            catch (error) {
                if (axios_1.default.isAxiosError(error)) {
                    const status = error.response?.status || 0;
                    const errorType = status >= 400 && status < 500 ? 'http' :
                        status >= 500 ? 'http' :
                            error.code === 'ECONNREFUSED' ? 'network' :
                                error.code === 'ECONNRESET' ? 'network' :
                                    error.code === 'ETIMEDOUT' ? 'timeout' : 'network';
                    throw new enhanced_core_1.CrawlError(error.message, errorType, url, status);
                }
                throw error;
            }
        };
        // Apply rate limiting if enabled
        if (this.rateLimiter) {
            return this.rateLimiter(executeRequest);
        }
        else {
            return executeRequest();
        }
    }
    async getNavigationLinks(baseUrl) {
        try {
            if (this.config.verbose) {
                console.log(`🔍 Extracting navigation links from: ${baseUrl}`);
            }
            const html = await this.makeRequest(baseUrl);
            const $ = cheerio.load(html);
            const links = [];
            const baseUrlObj = new URL(baseUrl);
            // Check if this is a Docsify site
            const isDocsify = html.includes('window.$docsify') || html.includes('docsify.js');
            if (isDocsify) {
                if (this.config.verbose) {
                    console.log(`🔍 Detected Docsify site, attempting to parse _sidebar.md`);
                }
                // Try to fetch _sidebar.md for Docsify sites
                try {
                    const sidebarUrl = new URL('_sidebar.md', baseUrl).toString();
                    const sidebarContent = await this.makeRequest(sidebarUrl);
                    // Parse markdown links from sidebar
                    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
                    let match;
                    while ((match = linkRegex.exec(sidebarContent)) !== null) {
                        const [, title, href] = match;
                        if (href && !href.startsWith('http') && !href.startsWith('mailto:')) {
                            try {
                                // Convert relative links to full URLs
                                let fullUrl;
                                if (href === '/') {
                                    fullUrl = baseUrl;
                                }
                                else if (href.startsWith('/')) {
                                    fullUrl = new URL(href.substring(1), baseUrl).toString();
                                }
                                else {
                                    fullUrl = new URL(href, baseUrl).toString();
                                }
                                links.push(fullUrl);
                                if (this.config.verbose) {
                                    console.log(`   Found: ${title} -> ${fullUrl}`);
                                }
                            }
                            catch (e) {
                                // Invalid URL, skip
                            }
                        }
                    }
                    if (links.length > 0) {
                        if (this.config.verbose) {
                            console.log(`✅ Found ${links.length} links from Docsify _sidebar.md`);
                        }
                        return [...new Set(links)];
                    }
                }
                catch (error) {
                    if (this.config.verbose) {
                        console.log(`⚠️  Could not fetch _sidebar.md, falling back to HTML parsing`);
                    }
                }
            }
            // Support multiple navigation selectors
            const navSelectors = this.config.selectors.navigation.split(',').map(s => s.trim());
            for (const selector of navSelectors) {
                $(selector).find('a[href]').each((_, element) => {
                    const href = $(element).attr('href');
                    if (href) {
                        try {
                            const fullUrl = new URL(href, baseUrl).toString();
                            if (fullUrl.startsWith(baseUrlObj.origin) || href.startsWith('http')) {
                                links.push(fullUrl);
                            }
                        }
                        catch (e) {
                            // Invalid URL, skip
                        }
                    }
                });
            }
            const uniqueLinks = [...new Set(links)];
            if (this.config.verbose) {
                console.log(`✅ Found ${uniqueLinks.length} unique navigation links`);
            }
            return uniqueLinks;
        }
        catch (error) {
            console.error(`❌ Failed to extract navigation links from ${baseUrl}:`, error);
            return [];
        }
    }
    async fetchAndConvertPage(url) {
        const startTime = Date.now();
        try {
            if (this.config.verbose) {
                console.log(`📄 Processing: ${url}`);
            }
            // Check if this is a Docsify site and if URL ends with .md
            const baseUrl = new URL(url).origin;
            const isDocsifyMarkdown = url.includes('marpit.marp.app') && !url.endsWith('.md');
            if (isDocsifyMarkdown) {
                // For Docsify sites, try to fetch the corresponding markdown file
                try {
                    let markdownUrl = url;
                    // Convert Docsify routes to markdown file paths
                    if (url === baseUrl || url.endsWith('/')) {
                        markdownUrl = new URL('introduction.md', baseUrl).toString();
                    }
                    else {
                        // Extract path and append .md
                        const pathPart = url.replace(baseUrl, '').replace(/^\//, '').replace(/\/$/, '');
                        if (pathPart && !pathPart.endsWith('.md')) {
                            markdownUrl = new URL(`${pathPart}.md`, baseUrl).toString();
                        }
                    }
                    if (this.config.verbose) {
                        console.log(`🔍 Trying to fetch Docsify markdown: ${markdownUrl}`);
                    }
                    const markdownContent = await this.makeRequest(markdownUrl);
                    // Process markdown content
                    const metadata = {
                        title: this.extractTitleFromMarkdown(markdownContent) || 'Untitled',
                        description: this.extractDescriptionFromMarkdown(markdownContent) || '',
                        url: url,
                        lastModified: new Date().toISOString(),
                        wordCount: markdownContent.split(/\s+/).length
                    };
                    const result = {
                        status: 'success',
                        url,
                        title: metadata.title,
                        markdown: markdownContent,
                        metadata,
                        processingTime: Date.now() - startTime,
                        wordCount: metadata.wordCount
                    };
                    if (this.config.verbose) {
                        console.log(`✅ Successfully processed Docsify markdown: ${markdownUrl}`);
                    }
                    return result;
                }
                catch (error) {
                    if (this.config.verbose) {
                        console.log(`⚠️  Failed to fetch Docsify markdown, falling back to HTML processing`);
                    }
                    // Fall through to regular HTML processing
                }
            }
            const html = await this.makeRequest(url);
            const $ = cheerio.load(html);
            // Extract metadata
            const metadata = this.extractMetadata($, url);
            // Find content using configured selectors
            const contentSelectors = this.config.selectors.content.split(',').map(s => s.trim());
            let contentElement = null;
            for (const selector of contentSelectors) {
                contentElement = $(selector).first();
                if (contentElement.length > 0)
                    break;
            }
            if (!contentElement || contentElement.length === 0) {
                return {
                    status: 'error',
                    url,
                    error: `Content not found using selectors: ${this.config.selectors.content}`,
                    processingTime: Date.now() - startTime
                };
            }
            // Remove excluded elements
            for (const excludeSelector of this.config.selectors.excludeSelectors) {
                contentElement.find(excludeSelector).remove();
            }
            // Process images if downloading is enabled
            if (this.config.downloadImages) {
                await this.processImages(contentElement, $, url);
            }
            // Convert to markdown
            const markdown = this.turndownService.turndown(contentElement.html() || '');
            // Generate enhanced output with metadata
            const enhancedMarkdown = this.enhanceMarkdown(markdown, metadata);
            const result = {
                status: 'success',
                url,
                title: metadata.title,
                author: metadata.author,
                date: metadata.date,
                markdown: enhancedMarkdown,
                metadata,
                imageCount: contentElement.find('img').length,
                wordCount: markdown.split(/\s+/).length,
                processingTime: Date.now() - startTime
            };
            if (this.config.verbose) {
                console.log(`✅ Processed ${url} (${result.wordCount} words, ${result.imageCount} images, ${result.processingTime}ms)`);
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (this.config.verbose) {
                console.error(`❌ Failed to process ${url}: ${errorMessage}`);
            }
            return {
                status: 'error',
                url,
                error: errorMessage,
                processingTime: Date.now() - startTime
            };
        }
    }
    extractMetadata($, url) {
        const metadata = {
            url,
            extractedAt: new Date().toISOString()
        };
        // Extract title
        if (this.config.selectors.titleSelector) {
            metadata.title = $(this.config.selectors.titleSelector).first().text().trim();
        }
        else {
            metadata.title = $('title').text() || $('h1').first().text() || '';
        }
        // Extract author
        if (this.config.selectors.authorSelector) {
            metadata.author = $(this.config.selectors.authorSelector).first().text().trim();
        }
        else {
            metadata.author = $('meta[name="author"]').attr('content') ||
                $('meta[property="article:author"]').attr('content') || '';
        }
        // Extract date
        if (this.config.selectors.dateSelector) {
            metadata.date = $(this.config.selectors.dateSelector).first().text().trim();
        }
        else {
            metadata.date = $('meta[name="date"]').attr('content') ||
                $('meta[property="article:published_time"]').attr('content') ||
                $('time').first().attr('datetime') || '';
        }
        // Extract additional meta tags
        $('meta').each((_, element) => {
            const name = $(element).attr('name') || $(element).attr('property');
            const content = $(element).attr('content');
            if (name && content) {
                metadata[name] = content;
            }
        });
        return metadata;
    }
    enhanceMarkdown(markdown, metadata) {
        let enhanced = '';
        // Add metadata header if enabled
        if (this.config.output.includeMetadata) {
            enhanced += '---\n';
            enhanced += `title: "${metadata.title || 'Untitled'}"\n`;
            if (metadata.author)
                enhanced += `author: "${metadata.author}"\n`;
            if (metadata.date)
                enhanced += `date: "${metadata.date}"\n`;
            enhanced += `url: "${metadata.url}"\n`;
            enhanced += `extracted_at: "${metadata.extractedAt}"\n`;
            enhanced += '---\n\n';
        }
        // Add title if not present in metadata
        if (!this.config.output.includeMetadata && metadata.title) {
            enhanced += `# ${metadata.title}\n\n`;
        }
        // Add table of contents if enabled
        if (this.config.output.includeToc) {
            const toc = this.generateTableOfContents(markdown);
            if (toc) {
                enhanced += '## Table of Contents\n\n';
                enhanced += toc + '\n\n';
            }
        }
        enhanced += markdown;
        return enhanced;
    }
    generateTableOfContents(markdown) {
        const lines = markdown.split('\n');
        const toc = [];
        const maxDepth = this.config.output.tocMaxDepth;
        for (const line of lines) {
            const match = line.match(/^(#{1,6})\s+(.+)$/);
            if (match) {
                const level = match[1].length;
                if (level <= maxDepth) {
                    const title = match[2];
                    const indent = '  '.repeat(level - 1);
                    const slug = title.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, '-');
                    toc.push(`${indent}- [${title}](#${slug})`);
                }
            }
        }
        return toc.join('\n');
    }
    async processImages(contentElement, $, baseUrl) {
        const images = contentElement.find('img');
        const imageDir = path.join(this.config.outputDir, 'images');
        for (let i = 0; i < images.length; i++) {
            const img = $(images[i]);
            const src = img.attr('src');
            if (src) {
                try {
                    const imageUrl = new URL(src, baseUrl).toString();
                    const downloadedPath = await this.downloadImage(imageUrl, imageDir);
                    if (downloadedPath) {
                        img.attr('src', downloadedPath);
                    }
                }
                catch (error) {
                    if (this.config.verbose) {
                        console.warn(`⚠️  Failed to process image ${src}: ${error}`);
                    }
                }
            }
        }
    }
    async downloadImage(imageUrl, imageDir) {
        try {
            const response = await this.makeRequest(imageUrl, 'arraybuffer');
            // Check file size
            const sizeInMB = response.byteLength / (1024 * 1024);
            if (sizeInMB > this.config.output.maxImageSize) {
                if (this.config.verbose) {
                    console.warn(`⚠️  Image too large (${sizeInMB.toFixed(2)}MB): ${imageUrl}`);
                }
                return null;
            }
            const url = new URL(imageUrl);
            const filename = path.basename(url.pathname);
            const extension = path.extname(filename).toLowerCase().slice(1);
            // Check if format is allowed
            if (!this.config.output.imageFormats.includes(extension)) {
                if (this.config.verbose) {
                    console.warn(`⚠️  Image format not allowed (${extension}): ${imageUrl}`);
                }
                return null;
            }
            await fs.mkdir(imageDir, { recursive: true });
            const filePath = path.join(imageDir, filename);
            await fs.writeFile(filePath, response);
            return `images/${filename}`;
        }
        catch (error) {
            if (this.config.verbose) {
                console.warn(`⚠️  Failed to download image ${imageUrl}: ${error}`);
            }
            return null;
        }
    }
    extractTitleFromMarkdown(markdown) {
        // Try to extract title from first H1 heading
        const h1Match = markdown.match(/^#\s+(.+)$/m);
        if (h1Match) {
            return h1Match[1].trim();
        }
        // Try to extract from HTML title tag if present
        const titleMatch = markdown.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            return titleMatch[1].trim();
        }
        return null;
    }
    extractDescriptionFromMarkdown(markdown) {
        // Try to extract description from first paragraph
        const lines = markdown.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('[') && !trimmed.startsWith('<')) {
                return trimmed.slice(0, 200) + (trimmed.length > 200 ? '...' : '');
            }
        }
        return null;
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        if (updates.crawl?.rateLimit) {
            this.initializeRateLimiter();
        }
    }
}
exports.ConfigurableCrawler = ConfigurableCrawler;
