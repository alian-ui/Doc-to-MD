import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as fs from 'fs/promises';
import * as path from 'path';
import { URL } from 'url';

export const turndownService = new TurndownService({ headingStyle: 'atx' });

// --- Types ---
export type PageResult = {
  url: string;
  markdown: string;
  status: 'success';
} | {
  url: string;
  error: string;
  status: 'error';
};

// --- Link Extraction ---
export async function getNavigationLinks(startUrl: string, navSelector: string): Promise<string[]> {
  try {
    console.log(`Fetching navigation links from: ${startUrl}`);
    const { data } = await axios.get(startUrl, { timeout: 10000 });
    const $ = cheerio.load(data);
    const baseUrl = new URL(startUrl);

    const links: string[] = [];
    
    // First try with the provided navigation selector
    $(navSelector).find('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl.href).href;
          if (!links.includes(absoluteUrl) && absoluteUrl.startsWith(baseUrl.origin)) {
            links.push(absoluteUrl);
          }
        } catch (e) {
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
              const absoluteUrl = new URL(href, baseUrl.href).href;
              if (!links.includes(absoluteUrl) && absoluteUrl.startsWith(baseUrl.origin)) {
                links.push(absoluteUrl);
              }
            } catch (e) {
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
            const absoluteUrl = new URL(href, baseUrl.href).href;
            if (!links.includes(absoluteUrl) && 
                absoluteUrl.startsWith(baseUrl.origin) && 
                absoluteUrl !== startUrl) {
              links.push(absoluteUrl);
            }
          } catch (e) {
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
  } catch (error) {
    console.error(`Error fetching navigation links: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

// --- Image Handling ---
export async function downloadImage(imgUrl: string, imagesDir: string): Promise<string | null> {
  try {
    const url = new URL(imgUrl);
    const imageName = path.basename(url.pathname);
    const localPath = path.join(imagesDir, imageName);
    
    const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
    await fs.writeFile(localPath, response.data);
    
    // Return relative path for markdown
    return path.join('images', imageName);
  } catch (error) {
    console.warn(`Failed to download image: ${imgUrl} - ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

// --- Content Fetching and Conversion ---
export async function fetchAndConvertPage(url: string, contentSelector: string, downloadImages: boolean, imagesDir: string): Promise<PageResult> {
  try {
    console.log(`Processing page: ${url}`);
    const { data } = await axios.get(url, { timeout: 15000 });
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
        'body'  // Last resort
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
      } catch (error) {
        // Directory might already exist
      }
      
      const imagePromises: Promise<void>[] = [];
      contentElement.find('img').each((i, el) => {
        const img = $(el);
        const src = img.attr('src');
        if (src) {
          const absoluteSrc = new URL(src, url).href;
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
      const markdown = turndownService.turndown(contentHtml);
      return { url, markdown, status: 'success' };
    }
    return { url, status: 'error', error: `No content found using selector "${contentSelector}" or fallback selectors` };
  } catch (error) {
    return { url, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
