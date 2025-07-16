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
exports.CrawlError = exports.DEFAULT_CRAWL_OPTIONS = exports.DEFAULT_RETRY_OPTIONS = exports.turndownService = void 0;
exports.getNavigationLinks = getNavigationLinks;
exports.downloadImage = downloadImage;
exports.fetchAndConvertPage = fetchAndConvertPage;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const turndown_1 = __importDefault(require("turndown"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const url_1 = require("url");
exports.turndownService = new turndown_1.default({ headingStyle: 'atx' });
// --- Default configurations ---
exports.DEFAULT_RETRY_OPTIONS = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryOnStatus: [408, 429, 500, 502, 503, 504]
};
exports.DEFAULT_CRAWL_OPTIONS = {
    timeout: 15000,
    userAgent: 'Doc-to-MD/1.0.0 (Web Documentation Crawler)',
    retry: exports.DEFAULT_RETRY_OPTIONS,
    validateUrls: true
};
// --- Enhanced Error Types ---
class CrawlError extends Error {
    errorType;
    url;
    httpStatus;
    retryCount;
    constructor(message, errorType, url, httpStatus, retryCount) {
        super(message);
        this.errorType = errorType;
        this.url = url;
        this.httpStatus = httpStatus;
        this.retryCount = retryCount;
        this.name = 'CrawlError';
    }
}
exports.CrawlError = CrawlError;
// --- Utility Functions ---
function isValidUrl(urlString) {
    try {
        new url_1.URL(urlString);
        return true;
    }
    catch {
        return false;
    }
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}
function getErrorType(error) {
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
function getHttpStatus(error) {
    return error.response?.status;
}
function shouldRetry(error, options) {
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
function calculateDelay(attempt, options) {
    const delay = Math.min(options.baseDelay * Math.pow(2, attempt), options.maxDelay);
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
}
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// --- Enhanced HTTP Request with Retry ---
async function makeHttpRequest(url, config = {}, options = exports.DEFAULT_CRAWL_OPTIONS) {
    let lastError;
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
            const response = await axios_1.default.get(url, requestConfig);
            if (attempt > 0) {
                console.log(`✅ Request succeeded after ${attempt} retries: ${url}`);
            }
            return response;
        }
        catch (error) {
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
async function getNavigationLinks(startUrl, navSelector, options = exports.DEFAULT_CRAWL_OPTIONS) {
    const errors = [];
    try {
        if (options.validateUrls && !isValidUrl(startUrl)) {
            errors.push(`Invalid start URL: ${startUrl}`);
            return { links: [], errors };
        }
        console.log(`🔍 Fetching navigation links from: ${startUrl}`);
        const response = await makeHttpRequest(startUrl, {}, options);
        const $ = cheerio.load(response.data);
        const baseUrl = new url_1.URL(startUrl);
        const links = [];
        const navigationElement = $(navSelector);
        if (navigationElement.length === 0) {
            errors.push(`Navigation selector "${navSelector}" not found on page`);
            return { links: [], errors };
        }
        navigationElement.find('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                try {
                    const absoluteUrl = new url_1.URL(href, baseUrl.href).href;
                    if (options.validateUrls && !isValidUrl(absoluteUrl)) {
                        console.warn(`⚠️  Skipping invalid URL: ${href}`);
                        return;
                    }
                    if (!links.includes(absoluteUrl)) {
                        links.push(absoluteUrl);
                    }
                }
                catch (e) {
                    console.warn(`⚠️  Skipping malformed URL: ${href} - ${getErrorMessage(e)}`);
                    errors.push(`Malformed URL: ${href} - ${getErrorMessage(e)}`);
                }
            }
        });
        console.log(`✅ Found ${links.length} unique links (${errors.length} errors)`);
        return { links, errors };
    }
    catch (error) {
        const errorMessage = `Failed to fetch navigation links: ${getErrorMessage(error)}`;
        console.error(`❌ ${errorMessage}`);
        errors.push(errorMessage);
        return { links: [], errors };
    }
}
// --- Enhanced Image Handling ---
async function downloadImage(imgUrl, imagesDir, options = exports.DEFAULT_CRAWL_OPTIONS) {
    try {
        if (options.validateUrls && !isValidUrl(imgUrl)) {
            const error = `Invalid image URL: ${imgUrl}`;
            console.warn(`⚠️  ${error}`);
            return { path: null, error };
        }
        const url = new url_1.URL(imgUrl);
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
    }
    catch (error) {
        const errorMessage = `Failed to download image ${imgUrl}: ${getErrorMessage(error)}`;
        console.warn(`⚠️  ${errorMessage}`);
        return { path: null, error: errorMessage };
    }
}
// --- Enhanced Content Fetching and Conversion ---
async function fetchAndConvertPage(url, contentSelector, downloadImages, imagesDir, options = exports.DEFAULT_CRAWL_OPTIONS) {
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
            throw new CrawlError(`Content selector "${contentSelector}" not found on page`, 'content', url);
        }
        // Handle image processing with error tracking
        if (downloadImages) {
            const imagePromises = [];
            const imageErrors = [];
            contentElement.find('img').each((i, el) => {
                const img = $(el);
                const src = img.attr('src');
                if (src) {
                    try {
                        const absoluteSrc = new url_1.URL(src, url).href;
                        const promise = downloadImage(absoluteSrc, imagesDir, options).then(result => {
                            if (result.path) {
                                img.attr('src', result.path);
                            }
                            else if (result.error) {
                                imageErrors.push(result.error);
                                // Keep original src if download fails
                                console.warn(`⚠️  Keeping original image src: ${src}`);
                            }
                        });
                        imagePromises.push(promise);
                    }
                    catch (e) {
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
            throw new CrawlError(`No content found in selector "${contentSelector}"`, 'content', url);
        }
        const markdown = exports.turndownService.turndown(contentHtml);
        console.log(`✅ Successfully processed: ${url}`);
        return { url, markdown, status: 'success' };
    }
    catch (error) {
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
