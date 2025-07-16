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
exports.turndownService = void 0;
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
// --- Link Extraction ---
async function getNavigationLinks(startUrl, navSelector) {
    try {
        console.log(`Fetching navigation links from: ${startUrl}`);
        const { data } = await axios_1.default.get(startUrl, { timeout: 10000 });
        const $ = cheerio.load(data);
        const baseUrl = new url_1.URL(startUrl);
        const links = [];
        // First try with the provided navigation selector
        $(navSelector).find('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                try {
                    const absoluteUrl = new url_1.URL(href, baseUrl.href).href;
                    if (!links.includes(absoluteUrl) && absoluteUrl.startsWith(baseUrl.origin)) {
                        links.push(absoluteUrl);
                    }
                }
                catch (e) {
                    console.warn(`Skipping invalid link: ${href}`);
                }
            }
        });
        // If no links found with navigation selector, try a broader approach
        if (links.length === 0) {
            console.log(`No links found with navigation selector, trying broader search...`);
            // Try common navigation patterns
            const fallbackSelectors = [
                'nav a',
                '.menu a',
                '.sidebar a',
                '.navigation a',
                '.nav-list a',
                '.docs-nav a',
                'ul.nav a',
                '.site-nav a'
            ];
            for (const selector of fallbackSelectors) {
                $(selector).each((i, el) => {
                    const href = $(el).attr('href');
                    if (href) {
                        try {
                            const absoluteUrl = new url_1.URL(href, baseUrl.href).href;
                            if (!links.includes(absoluteUrl) && absoluteUrl.startsWith(baseUrl.origin)) {
                                links.push(absoluteUrl);
                            }
                        }
                        catch (e) {
                            // Skip invalid links
                        }
                    }
                });
                if (links.length > 0) {
                    console.log(`Found ${links.length} links using fallback selector: ${selector}`);
                    break;
                }
            }
        }
        // If still no links, try to find any same-domain links
        if (links.length === 0) {
            console.log(`No navigation links found, searching for any same-domain links...`);
            $('a[href]').each((i, el) => {
                const href = $(el).attr('href');
                if (href) {
                    try {
                        const absoluteUrl = new url_1.URL(href, baseUrl.href).href;
                        if (!links.includes(absoluteUrl) &&
                            absoluteUrl.startsWith(baseUrl.origin) &&
                            absoluteUrl !== startUrl) {
                            links.push(absoluteUrl);
                        }
                    }
                    catch (e) {
                        // Skip invalid links
                    }
                }
            });
            // Limit to reasonable number for safety
            if (links.length > 50) {
                links.splice(50);
                console.log(`Limited to first 50 links for safety`);
            }
        }
        console.log(`Found ${links.length} unique links.`);
        return links;
    }
    catch (error) {
        console.error(`Error fetching navigation links: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return [];
    }
}
// --- Image Handling ---
async function downloadImage(imgUrl, imagesDir) {
    try {
        const url = new url_1.URL(imgUrl);
        const imageName = path.basename(url.pathname);
        const localPath = path.join(imagesDir, imageName);
        const response = await axios_1.default.get(imgUrl, { responseType: 'arraybuffer' });
        await fs.writeFile(localPath, response.data);
        // Return relative path for markdown
        return path.join('images', imageName);
    }
    catch (error) {
        console.warn(`Failed to download image: ${imgUrl} - ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}
// --- Content Fetching and Conversion ---
async function fetchAndConvertPage(url, contentSelector, downloadImages, imagesDir) {
    try {
        console.log(`Processing page: ${url}`);
        const { data } = await axios_1.default.get(url, { timeout: 15000 });
        const $ = cheerio.load(data);
        let contentElement = $(contentSelector);
        // If no content found with primary selector, try fallback selectors
        if (contentElement.length === 0 || !contentElement.html()?.trim()) {
            console.log(`No content found with primary selector, trying fallbacks...`);
            const fallbackSelectors = [
                'main',
                'article',
                '.content',
                '.main-content',
                '.post',
                '.entry-content',
                '.article-content',
                '[role="main"]',
                'body' // Last resort
            ];
            for (const selector of fallbackSelectors) {
                contentElement = $(selector);
                if (contentElement.length > 0 && contentElement.html()?.trim()) {
                    console.log(`Found content using fallback selector: ${selector}`);
                    break;
                }
            }
        }
        if (downloadImages && imagesDir) {
            // Ensure images directory exists
            try {
                await fs.mkdir(imagesDir, { recursive: true });
            }
            catch (error) {
                // Directory might already exist
            }
            const imagePromises = [];
            contentElement.find('img').each((i, el) => {
                const img = $(el);
                const src = img.attr('src');
                if (src) {
                    const absoluteSrc = new url_1.URL(src, url).href;
                    const promise = downloadImage(absoluteSrc, imagesDir).then(localPath => {
                        if (localPath) {
                            img.attr('src', localPath);
                        }
                    });
                    imagePromises.push(promise);
                }
            });
            await Promise.all(imagePromises);
        }
        const contentHtml = contentElement.html();
        if (contentHtml?.trim()) {
            const markdown = exports.turndownService.turndown(contentHtml);
            return { url, markdown, status: 'success' };
        }
        return { url, status: 'error', error: `No content found using selector "${contentSelector}" or fallback selectors` };
    }
    catch (error) {
        return { url, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
