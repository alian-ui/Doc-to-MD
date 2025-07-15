import * as fs from 'fs/promises';
import * as path from 'path';
import { CrawlOptions, DEFAULT_CRAWL_OPTIONS, RetryOptions } from './enhanced-core';

// --- Configuration Types ---
export interface ProxyConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  auth?: {
    username: string;
    password: string;
  };
  protocol?: 'http' | 'https' | 'socks4' | 'socks5';
}

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerSecond: number;
  burstSize: number;
  respectRobotsTxt: boolean;
}

export interface CustomHeaders {
  [key: string]: string;
}

export interface OutputConfig {
  format: 'markdown' | 'html' | 'json';
  includeMetadata: boolean;
  includeToc: boolean;
  tocMaxDepth: number;
  dateFormat: string;
  preserveOriginalImages: boolean;
  imageFormats: string[];
  maxImageSize: number; // in MB
}

export interface SelectorConfig {
  navigation: string;
  content: string;
  excludeSelectors: string[];
  includeSelectors: string[];
  titleSelector?: string;
  authorSelector?: string;
  dateSelector?: string;
}

export interface AdvancedCrawlConfig extends CrawlOptions {
  proxy: ProxyConfig;
  rateLimit: RateLimitConfig;
  customHeaders: CustomHeaders;
  followRedirects: boolean;
  maxRedirects: number;
  sslConfig: {
    rejectUnauthorized: boolean;
    allowSelfSigned: boolean;
    ciphers?: string;
  };
  cookies: {
    enabled: boolean;
    jar?: { [domain: string]: string };
  };
}

export interface DocToMdConfig {
  crawl: AdvancedCrawlConfig;
  output: OutputConfig;
  selectors: SelectorConfig;
  concurrency: number;
  downloadImages: boolean;
  outputDir: string;
  outputFile: string;
  continueOnError: boolean;
  verbose: boolean;
  dryRun: boolean;
}

// --- Default Configurations ---
export const DEFAULT_PROXY_CONFIG: ProxyConfig = {
  enabled: false,
  protocol: 'http'
};

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  enabled: false,
  requestsPerSecond: 2,
  burstSize: 5,
  respectRobotsTxt: true
};

export const DEFAULT_OUTPUT_CONFIG: OutputConfig = {
  format: 'markdown',
  includeMetadata: true,
  includeToc: false,
  tocMaxDepth: 3,
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  preserveOriginalImages: false,
  imageFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  maxImageSize: 10 // 10MB
};

export const DEFAULT_ADVANCED_CRAWL_CONFIG: AdvancedCrawlConfig = {
  ...DEFAULT_CRAWL_OPTIONS,
  proxy: DEFAULT_PROXY_CONFIG,
  rateLimit: DEFAULT_RATE_LIMIT_CONFIG,
  customHeaders: {},
  followRedirects: true,
  maxRedirects: 5,
  sslConfig: {
    rejectUnauthorized: true,
    allowSelfSigned: false
  },
  cookies: {
    enabled: false
  }
};

export const DEFAULT_CONFIG: DocToMdConfig = {
  crawl: DEFAULT_ADVANCED_CRAWL_CONFIG,
  output: DEFAULT_OUTPUT_CONFIG,
  selectors: {
    navigation: '.nav, .navigation, .sidebar, .toc, [role="navigation"], nav, .menu, .nav-list, .site-nav, .docs-nav, .documentation-nav, .doc-nav, .guide-nav, .api-nav, .reference-nav, aside nav, .left-sidebar, .right-sidebar',
    content: 'main, .content, .main-content, article, .article, .post, .post-content, .entry-content, [role="main"], .documentation-content, .doc-content, .guide-content, .api-content, .tutorial-content, section.content, .page-content, .article-body',
    excludeSelectors: ['.advertisement', '.sidebar-ads', '.footer', '.header', '.nav', '.navigation', '.breadcrumb', '.pagination', '.social-sharing', '.comments', '.related-posts', '.author-bio', '.newsletter-signup'],
    includeSelectors: []
  },
  concurrency: 5,
  downloadImages: false,
  outputDir: '.',
  outputFile: 'output.md',
  continueOnError: true,
  verbose: false,
  dryRun: false
};

// --- Configuration Management Functions ---
export async function loadConfigFromFile(configPath: string): Promise<Partial<DocToMdConfig>> {
  try {
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    if (!configExists) {
      console.warn(`⚠️  Config file not found: ${configPath}`);
      return {};
    }

    const configContent = await fs.readFile(configPath, 'utf-8');
    const ext = path.extname(configPath).toLowerCase();
    
    let config: Partial<DocToMdConfig>;
    
    switch (ext) {
      case '.json':
        config = JSON.parse(configContent);
        break;
      case '.yaml':
      case '.yml':
        // Note: Would need yaml parser dependency
        throw new Error('YAML config files require yaml parser dependency');
      default:
        throw new Error(`Unsupported config file format: ${ext}`);
    }
    
    console.log(`✅ Loaded configuration from: ${configPath}`);
    return config;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to load config file ${configPath}: ${message}`);
    throw error;
  }
}

export async function saveConfigToFile(config: DocToMdConfig, configPath: string): Promise<void> {
  try {
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    const ext = path.extname(configPath).toLowerCase();
    let content: string;
    
    switch (ext) {
      case '.json':
        content = JSON.stringify(config, null, 2);
        break;
      default:
        throw new Error(`Unsupported config file format: ${ext}`);
    }
    
    await fs.writeFile(configPath, content, 'utf-8');
    console.log(`✅ Configuration saved to: ${configPath}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Failed to save config file ${configPath}: ${message}`);
    throw error;
  }
}

export function mergeConfigs(...configs: Partial<DocToMdConfig>[]): DocToMdConfig {
  const merged = { ...DEFAULT_CONFIG };
  
  for (const config of configs) {
    if (config.crawl) {
      // Deep merge crawl configuration
      merged.crawl = {
        ...merged.crawl,
        ...config.crawl,
        retry: config.crawl.retry ? { ...merged.crawl.retry, ...config.crawl.retry } : merged.crawl.retry,
        proxy: config.crawl.proxy ? { ...merged.crawl.proxy, ...config.crawl.proxy } : merged.crawl.proxy,
        rateLimit: config.crawl.rateLimit ? { ...merged.crawl.rateLimit, ...config.crawl.rateLimit } : merged.crawl.rateLimit,
        customHeaders: config.crawl.customHeaders ? { ...merged.crawl.customHeaders, ...config.crawl.customHeaders } : merged.crawl.customHeaders,
        sslConfig: config.crawl.sslConfig ? { ...merged.crawl.sslConfig, ...config.crawl.sslConfig } : merged.crawl.sslConfig,
        cookies: config.crawl.cookies ? { ...merged.crawl.cookies, ...config.crawl.cookies } : merged.crawl.cookies
      };
    }
    
    if (config.output) {
      merged.output = { ...merged.output, ...config.output };
    }
    
    if (config.selectors) {
      merged.selectors = { ...merged.selectors, ...config.selectors };
    }
    
    // Merge other top-level properties
    Object.assign(merged, {
      concurrency: config.concurrency ?? merged.concurrency,
      downloadImages: config.downloadImages ?? merged.downloadImages,
      outputDir: config.outputDir ?? merged.outputDir,
      outputFile: config.outputFile ?? merged.outputFile,
      continueOnError: config.continueOnError ?? merged.continueOnError,
      verbose: config.verbose ?? merged.verbose,
      dryRun: config.dryRun ?? merged.dryRun
    });
  }
  
  return merged;
}

export function validateConfig(config: DocToMdConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate selectors
  if (!config.selectors.navigation) {
    errors.push('Navigation selector is required');
  }
  if (!config.selectors.content) {
    errors.push('Content selector is required');
  }
  
  // Validate crawl options
  if (config.crawl.timeout <= 0) {
    errors.push('Timeout must be positive');
  }
  if (config.crawl.retry.maxRetries < 0) {
    errors.push('Max retries cannot be negative');
  }
  if (config.crawl.retry.baseDelay <= 0) {
    errors.push('Base delay must be positive');
  }
  
  // Validate proxy config
  if (config.crawl.proxy.enabled) {
    if (!config.crawl.proxy.host) {
      errors.push('Proxy host is required when proxy is enabled');
    }
    if (!config.crawl.proxy.port || config.crawl.proxy.port <= 0) {
      errors.push('Valid proxy port is required when proxy is enabled');
    }
  }
  
  // Validate rate limiting
  if (config.crawl.rateLimit.enabled) {
    if (config.crawl.rateLimit.requestsPerSecond <= 0) {
      errors.push('Requests per second must be positive');
    }
    if (config.crawl.rateLimit.burstSize <= 0) {
      errors.push('Burst size must be positive');
    }
  }
  
  // Validate output config
  if (!['markdown', 'html', 'json'].includes(config.output.format)) {
    errors.push('Output format must be markdown, html, or json');
  }
  if (config.output.tocMaxDepth <= 0) {
    errors.push('TOC max depth must be positive');
  }
  if (config.output.maxImageSize <= 0) {
    errors.push('Max image size must be positive');
  }
  
  // Validate concurrency
  if (config.concurrency <= 0) {
    errors.push('Concurrency must be positive');
  }
  
  return { valid: errors.length === 0, errors };
}

export async function initializeConfigFile(configPath: string, baseUrl?: string): Promise<void> {
  const config = { ...DEFAULT_CONFIG };
  
  // Try to detect common selectors based on URL
  if (baseUrl) {
    console.log(`🔍 Analyzing ${baseUrl} for common selectors...`);
    const detectedSelectors = await detectCommonSelectors(baseUrl);
    config.selectors = { ...config.selectors, ...detectedSelectors };
  }
  
  await saveConfigToFile(config, configPath);
  console.log(`📄 Initialized configuration file: ${configPath}`);
  console.log(`   Please review and customize the settings before running.`);
}

async function detectCommonSelectors(url: string): Promise<Partial<SelectorConfig>> {
  // This would analyze the page and suggest selectors
  // For now, return common patterns
  return {
    navigation: 'nav, .nav, .navigation, .sidebar, .toc, [role="navigation"]',
    content: 'main, .main, .content, .main-content, article, [role="main"]',
    excludeSelectors: [
      '.advertisement', '.ads', '.sidebar-ads', 
      '.footer', '.header', '.nav', '.navigation',
      '.breadcrumbs', '.pagination', '.comments',
      '.related-posts', '.social-sharing'
    ]
  };
}

export function getConfigSummary(config: DocToMdConfig): string {
  const summary = [];
  summary.push(`📋 Configuration Summary:`);
  summary.push(`   Navigation Selector: ${config.selectors.navigation}`);
  summary.push(`   Content Selector: ${config.selectors.content}`);
  summary.push(`   Output Format: ${config.output.format}`);
  summary.push(`   Concurrency: ${config.concurrency}`);
  summary.push(`   Download Images: ${config.downloadImages}`);
  summary.push(`   Timeout: ${config.crawl.timeout}ms`);
  summary.push(`   Max Retries: ${config.crawl.retry.maxRetries}`);
  
  if (config.crawl.proxy.enabled) {
    summary.push(`   Proxy: ${config.crawl.proxy.protocol}://${config.crawl.proxy.host}:${config.crawl.proxy.port}`);
  }
  
  if (config.crawl.rateLimit.enabled) {
    summary.push(`   Rate Limit: ${config.crawl.rateLimit.requestsPerSecond} req/s`);
  }
  
  if (Object.keys(config.crawl.customHeaders).length > 0) {
    summary.push(`   Custom Headers: ${Object.keys(config.crawl.customHeaders).length} defined`);
  }
  
  if (config.selectors.excludeSelectors.length > 0) {
    summary.push(`   Exclude Selectors: ${config.selectors.excludeSelectors.length} defined`);
  }
  
  return summary.join('\n');
}
