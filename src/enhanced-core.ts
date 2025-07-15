import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as fs from 'fs/promises';
import * as path from 'path';
import { URL } from 'url';

export const turndownService = new TurndownService({ headingStyle: 'atx' });

// --- Enhanced Types ---
export type ErrorType = 'network' | 'content' | 'parsing' | 'timeout' | 'http';

export type PageResult = {
  url: string;
  markdown: string;
  status: 'success';
} | {
  url: string;
  error: string;
  status: 'error';
  errorType: ErrorType;
  httpStatus?: number;
  retryCount?: number;
};

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryOnStatus: number[];
}

export interface CrawlOptions {
  timeout: number;
  userAgent: string;
  retry: RetryOptions;
  validateUrls: boolean;
}

// --- Default configurations ---
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryOnStatus: [408, 429, 500, 502, 503, 504]
};

export const DEFAULT_CRAWL_OPTIONS: CrawlOptions = {
  timeout: 15000,
  userAgent: 'Doc-to-MD/1.0.0 (Web Documentation Crawler)',
  retry: DEFAULT_RETRY_OPTIONS,
  validateUrls: true
};

// --- Enhanced Error Types ---
export class CrawlError extends Error {
  constructor(
    message: string,
    public readonly errorType: ErrorType,
    public readonly url?: string,
    public readonly httpStatus?: number,
    public readonly retryCount?: number
  ) {
    super(message);
    this.name = 'CrawlError';
  }
}

// --- Utility Functions ---
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getErrorType(error: any): ErrorType {
  const message = getErrorMessage(error);
  
  if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
    return 'network';
  }
  if (message.toLowerCase().includes('timeout')) {
    return 'timeout';
  }
  if (error?.response?.status) {
    return 'http';
  }
  return 'parsing';
}

function getHttpStatus(error: any): number | undefined {
  return error.response?.status;
}

function shouldRetry(error: any, options: RetryOptions): boolean {
  const httpStatus = getHttpStatus(error);
  if (httpStatus) {
    return options.retryOnStatus.includes(httpStatus);
  }
  
  const message = getErrorMessage(error);
  // Retry on network errors and timeouts
  return error?.code === 'ENOTFOUND' || 
         error?.code === 'ECONNREFUSED' || 
         message.toLowerCase().includes('timeout');
}

function calculateDelay(attempt: number, options: RetryOptions): number {
  const delay = Math.min(options.baseDelay * Math.pow(2, attempt), options.maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Enhanced HTTP Request with Retry ---
async function makeHttpRequest(
  url: string, 
  config: any = {}, 
  options: CrawlOptions = DEFAULT_CRAWL_OPTIONS
): Promise<any> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= options.retry.maxRetries; attempt++) {
    try {
      const requestConfig = {
        timeout: options.timeout,
        headers: {
          'User-Agent': options.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          ...config.headers
        },
        ...config
      };

      const response = await axios.get(url, requestConfig);
      
      if (attempt > 0) {
        console.log(`✅ Request succeeded after ${attempt} retries: ${url}`);
      }
      
      return response;
    } catch (error) {
      lastError = error;
      
      if (attempt === options.retry.maxRetries) {
        console.error(`❌ Final attempt failed for ${url}: ${getErrorMessage(error)}`);
        break;
      }
      
      if (!shouldRetry(error, options.retry)) {
        console.error(`❌ Non-retryable error for ${url}: ${getErrorMessage(error)}`);
        break;
      }
      
      const delay = calculateDelay(attempt, options.retry);
      console.warn(`⚠️  Attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms: ${getErrorMessage(error)}`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// --- Enhanced Link Extraction ---
export async function getNavigationLinks(
  startUrl: string, 
  navSelector: string,
  options: CrawlOptions = DEFAULT_CRAWL_OPTIONS
): Promise<{ links: string[], errors: string[] }> {
  const errors: string[] = [];
  
  try {
    if (options.validateUrls && !isValidUrl(startUrl)) {
      errors.push(`Invalid start URL: ${startUrl}`);
      return { links: [], errors };
    }

    console.log(`🔍 Fetching navigation links from: ${startUrl}`);
    const response = await makeHttpRequest(startUrl, {}, options);
    const $ = cheerio.load(response.data);
    const baseUrl = new URL(startUrl);

    const links: string[] = [];
    const navigationElement = $(navSelector);
    
    if (navigationElement.length === 0) {
      errors.push(`Navigation selector "${navSelector}" not found on page`);
      return { links: [], errors };
    }

    navigationElement.find('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl.href).href;
          
          if (options.validateUrls && !isValidUrl(absoluteUrl)) {
            console.warn(`⚠️  Skipping invalid URL: ${href}`);
            return;
          }
          
          if (!links.includes(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch (e) {
          console.warn(`⚠️  Skipping malformed URL: ${href} - ${getErrorMessage(e)}`);
          errors.push(`Malformed URL: ${href} - ${getErrorMessage(e)}`);
        }
      }
    });
    
    console.log(`✅ Found ${links.length} unique links (${errors.length} errors)`);
    return { links, errors };
  } catch (error) {
    const errorMessage = `Failed to fetch navigation links: ${getErrorMessage(error)}`;
    console.error(`❌ ${errorMessage}`);
    errors.push(errorMessage);
    return { links: [], errors };
  }
}

// --- Enhanced Image Handling ---
export async function downloadImage(
  imgUrl: string, 
  imagesDir: string,
  options: CrawlOptions = DEFAULT_CRAWL_OPTIONS
): Promise<{ path: string | null, error?: string }> {
  try {
    if (options.validateUrls && !isValidUrl(imgUrl)) {
      const error = `Invalid image URL: ${imgUrl}`;
      console.warn(`⚠️  ${error}`);
      return { path: null, error };
    }

    const url = new URL(imgUrl);
    let imageName = path.basename(url.pathname);
    
    // Handle URLs without file extensions
    if (!path.extname(imageName)) {
      imageName += '.jpg'; // Default extension
    }
    
    const localPath = path.join(imagesDir, imageName);
    
    console.log(`📥 Downloading image: ${imgUrl}`);
    const response = await makeHttpRequest(imgUrl, { responseType: 'arraybuffer' }, options);
    
    await fs.writeFile(localPath, response.data);
    
    // Return relative path for markdown
    const relativePath = path.join('images', imageName);
    console.log(`✅ Image downloaded: ${relativePath}`);
    return { path: relativePath };
  } catch (error) {
    const errorMessage = `Failed to download image ${imgUrl}: ${getErrorMessage(error)}`;
    console.warn(`⚠️  ${errorMessage}`);
    return { path: null, error: errorMessage };
  }
}

// --- Enhanced Content Fetching and Conversion ---
export async function fetchAndConvertPage(
  url: string, 
  contentSelector: string, 
  downloadImages: boolean, 
  imagesDir: string,
  options: CrawlOptions = DEFAULT_CRAWL_OPTIONS
): Promise<PageResult> {
  let retryCount = 0;
  
  try {
    if (options.validateUrls && !isValidUrl(url)) {
      throw new CrawlError(`Invalid URL: ${url}`, 'parsing', url);
    }

    console.log(`🔄 Processing page: ${url}`);
    const response = await makeHttpRequest(url, {}, options);
    const $ = cheerio.load(response.data);

    const contentElement = $(contentSelector);
    
    if (contentElement.length === 0) {
      throw new CrawlError(
        `Content selector "${contentSelector}" not found on page`, 
        'content', 
        url
      );
    }

    // Handle image processing with error tracking
    if (downloadImages) {
      const imagePromises: Promise<void>[] = [];
      const imageErrors: string[] = [];
      
      contentElement.find('img').each((i, el) => {
        const img = $(el);
        const src = img.attr('src');
        if (src) {
          try {
            const absoluteSrc = new URL(src, url).href;
            const promise = downloadImage(absoluteSrc, imagesDir, options).then(result => {
              if (result.path) {
                img.attr('src', result.path);
              } else if (result.error) {
                imageErrors.push(result.error);
                // Keep original src if download fails
                console.warn(`⚠️  Keeping original image src: ${src}`);
              }
            });
            imagePromises.push(promise);
          } catch (e) {
            const error = `Invalid image URL ${src}: ${getErrorMessage(e)}`;
            imageErrors.push(error);
            console.warn(`⚠️  ${error}`);
          }
        }
      });
      
      await Promise.all(imagePromises);
      
      if (imageErrors.length > 0) {
        console.warn(`⚠️  ${imageErrors.length} image download errors for ${url}`);
      }
    }

    const contentHtml = contentElement.html();
    if (!contentHtml) {
      throw new CrawlError(
        `No content found in selector "${contentSelector}"`, 
        'content', 
        url
      );
    }

    const markdown = turndownService.turndown(contentHtml);
    console.log(`✅ Successfully processed: ${url}`);
    return { url, markdown, status: 'success' };
    
  } catch (error) {
    const errorType = getErrorType(error);
    const httpStatus = getHttpStatus(error);
    
    if (error instanceof CrawlError) {
      console.error(`❌ ${error.message}`);
      return { 
        url, 
        status: 'error', 
        error: error.message,
        errorType: error.errorType,
        httpStatus: error.httpStatus,
        retryCount
      };
    }
    
    console.error(`❌ Failed to process ${url}: ${getErrorMessage(error)}`);
    return { 
      url, 
      status: 'error', 
      error: getErrorMessage(error),
      errorType,
      httpStatus,
      retryCount
    };
  }
}
