import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as fs from 'fs/promises';
import * as path from 'path';
import pLimit from 'p-limit';
import { CrawlError } from './enhanced-core';
import { 
  DocToMdConfig, 
  ProxyConfig, 
  RateLimitConfig, 
  CustomHeaders,
  OutputConfig,
  SelectorConfig 
} from './config';

// --- Enhanced Core with Configuration Support ---

export interface ConfigurablePageResult {
  status: 'success' | 'error';
  url: string;
  title?: string;
  author?: string;
  date?: string;
  markdown?: string;
  metadata?: { [key: string]: any };
  error?: string;
  imageCount?: number;
  wordCount?: number;
  processingTime?: number;
}

export class ConfigurableCrawler {
  private config: DocToMdConfig;
  private turndownService: TurndownService;
  private rateLimiter?: any;
  private cookieJar: { [domain: string]: string } = {};

  constructor(config: DocToMdConfig) {
    this.config = config;
    this.turndownService = this.initializeTurndownService();
    this.initializeRateLimiter();
    if (this.config.crawl.cookies.enabled && this.config.crawl.cookies.jar) {
      this.cookieJar = { ...this.config.crawl.cookies.jar };
    }
  }

  private initializeTurndownService(): TurndownService {
    const service = new TurndownService({
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

  private initializeRateLimiter(): void {
    if (this.config.crawl.rateLimit.enabled) {
      const limit = pLimit(this.config.crawl.rateLimit.requestsPerSecond);
      this.rateLimiter = limit;
    }
  }

  private async createAxiosConfig(url: string): Promise<AxiosRequestConfig> {
    const config: AxiosRequestConfig = {
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
        host: this.config.crawl.proxy.host!,
        port: this.config.crawl.proxy.port!,
        auth: this.config.crawl.proxy.auth ? {
          username: this.config.crawl.proxy.auth.username,
          password: this.config.crawl.proxy.auth.password
        } : undefined
      };
    }

    // Add SSL configuration
    if (url.startsWith('https://')) {
      const https = await import('https');
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
        config.headers!['Cookie'] = cookies;
      }
    }

    return config;
  }

  private async makeRequest<T = any>(url: string, responseType: 'json' | 'text' | 'arraybuffer' = 'text'): Promise<T> {
    const axiosConfig = await this.createAxiosConfig(url);
    axiosConfig.responseType = responseType;

    const executeRequest = async () => {
      try {
        const response = await axios.get<T>(url, axiosConfig);
        
        // Store cookies if enabled
        if (this.config.crawl.cookies.enabled && response.headers['set-cookie']) {
          const domain = new URL(url).hostname;
          this.cookieJar[domain] = response.headers['set-cookie'].join('; ');
        }

        return response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status || 0;
          const errorType: 'network' | 'content' | 'parsing' | 'timeout' | 'http' = 
            status >= 400 && status < 500 ? 'http' : 
            status >= 500 ? 'http' : 
            error.code === 'ECONNREFUSED' ? 'network' :
            error.code === 'ECONNRESET' ? 'network' :
            error.code === 'ETIMEDOUT' ? 'timeout' : 'network';
          throw new CrawlError(
            error.message,
            errorType,
            url,
            status
          );
        }
        throw error;
      }
    };

    // Apply rate limiting if enabled
    if (this.rateLimiter) {
      return this.rateLimiter(executeRequest);
    } else {
      return executeRequest();
    }
  }

  public async getNavigationLinks(baseUrl: string): Promise<string[]> {
    try {
      if (this.config.verbose) {
        console.log(`🔍 Extracting navigation links from: ${baseUrl}`);
      }

      const html = await this.makeRequest<string>(baseUrl);
      const $ = cheerio.load(html);
      const links: string[] = [];
      const baseUrlObj = new URL(baseUrl);

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
            } catch (e) {
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
    } catch (error) {
      console.error(`❌ Failed to extract navigation links from ${baseUrl}:`, error);
      return [];
    }
  }

  public async fetchAndConvertPage(url: string): Promise<ConfigurablePageResult> {
    const startTime = Date.now();
    
    try {
      if (this.config.verbose) {
        console.log(`📄 Processing: ${url}`);
      }

      const html = await this.makeRequest<string>(url);
      const $ = cheerio.load(html);

      // Extract metadata
      const metadata = this.extractMetadata($, url);
      
      // Find content using configured selectors
      const contentSelectors = this.config.selectors.content.split(',').map(s => s.trim());
      let contentElement: any = null;

      for (const selector of contentSelectors) {
        contentElement = $(selector).first();
        if (contentElement.length > 0) break;
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

      const result: ConfigurablePageResult = {
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
    } catch (error) {
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

  private extractMetadata($: any, url: string): { [key: string]: any } {
    const metadata: { [key: string]: any } = {
      url,
      extractedAt: new Date().toISOString()
    };

    // Extract title
    if (this.config.selectors.titleSelector) {
      metadata.title = $(this.config.selectors.titleSelector).first().text().trim();
    } else {
      metadata.title = $('title').text() || $('h1').first().text() || '';
    }

    // Extract author
    if (this.config.selectors.authorSelector) {
      metadata.author = $(this.config.selectors.authorSelector).first().text().trim();
    } else {
      metadata.author = $('meta[name="author"]').attr('content') || 
                       $('meta[property="article:author"]').attr('content') || '';
    }

    // Extract date
    if (this.config.selectors.dateSelector) {
      metadata.date = $(this.config.selectors.dateSelector).first().text().trim();
    } else {
      metadata.date = $('meta[name="date"]').attr('content') || 
                     $('meta[property="article:published_time"]').attr('content') ||
                     $('time').first().attr('datetime') || '';
    }

    // Extract additional meta tags
    $('meta').each((_: any, element: any) => {
      const name = $(element).attr('name') || $(element).attr('property');
      const content = $(element).attr('content');
      if (name && content) {
        metadata[name] = content;
      }
    });

    return metadata;
  }

  private enhanceMarkdown(markdown: string, metadata: { [key: string]: any }): string {
    let enhanced = '';

    // Add metadata header if enabled
    if (this.config.output.includeMetadata) {
      enhanced += '---\n';
      enhanced += `title: "${metadata.title || 'Untitled'}"\n`;
      if (metadata.author) enhanced += `author: "${metadata.author}"\n`;
      if (metadata.date) enhanced += `date: "${metadata.date}"\n`;
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

  private generateTableOfContents(markdown: string): string {
    const lines = markdown.split('\n');
    const toc: string[] = [];
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

  private async processImages(contentElement: any, $: any, baseUrl: string): Promise<void> {
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
        } catch (error) {
          if (this.config.verbose) {
            console.warn(`⚠️  Failed to process image ${src}: ${error}`);
          }
        }
      }
    }
  }

  private async downloadImage(imageUrl: string, imageDir: string): Promise<string | null> {
    try {
      const response = await this.makeRequest<Buffer>(imageUrl, 'arraybuffer');
      
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
    } catch (error) {
      if (this.config.verbose) {
        console.warn(`⚠️  Failed to download image ${imageUrl}: ${error}`);
      }
      return null;
    }
  }

  public getConfig(): DocToMdConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<DocToMdConfig>): void {
    this.config = { ...this.config, ...updates };
    if (updates.crawl?.rateLimit) {
      this.initializeRateLimiter();
    }
  }
}
