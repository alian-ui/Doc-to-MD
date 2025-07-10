

import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import * as fs from 'fs/promises';
import * as path from 'path';
import { URL } from 'url';
import pLimit from 'p-limit';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const turndownService = new TurndownService({ headingStyle: 'atx' });

// --- Types ---
type PageResult = {
  url: string;
  markdown: string;
  status: 'success';
} | {
  url: string;
  error: string;
  status: 'error';
};

// --- Argument Parsing ---
async function parseArgs() {
  return yargs(hideBin(process.argv))
    .options({
      url: { type: 'string', demandOption: true, describe: 'Starting URL to crawl' },
      navSelector: { type: 'string', demandOption: true, describe: 'CSS selector for the navigation area' },
      contentSelector: { type: 'string', demandOption: true, describe: 'CSS selector for the main content area' },
      output: { type: 'string', default: 'output.md', alias: 'o', describe: 'Output file name' },
      concurrency: { type: 'number', default: 5, alias: 'c', describe: 'Number of concurrent requests' },
      downloadImages: { type: 'boolean', default: false, describe: 'Download images and point to local files' },
      outputDir: { type: 'string', default: '.', describe: 'Directory to save output file and images' },
    })
    .help()
    .alias('help', 'h')
    .argv;
}

// --- Link Extraction ---
async function getNavigationLinks(startUrl: string, navSelector: string): Promise<string[]> {
  // ... (same as before)
  try {
    console.log(`Fetching navigation links from: ${startUrl}`);
    const { data } = await axios.get(startUrl, { timeout: 10000 });
    const $ = cheerio.load(data);
    const baseUrl = new URL(startUrl);

    const links: string[] = [];
    $(navSelector).find('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl.href).href;
          if (!links.includes(absoluteUrl)) {
            links.push(absoluteUrl);
          }
        } catch (e) {
          console.warn(`Skipping invalid link: ${href}`);
        }
      }
    });
    console.log(`Found ${links.length} unique links.`);
    return links;
  } catch (error) {
    console.error(`Error fetching navigation links: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

// --- Image Handling ---
async function downloadImage(imgUrl: string, imagesDir: string): Promise<string | null> {
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
async function fetchAndConvertPage(url: string, contentSelector: string, downloadImages: boolean, imagesDir: string): Promise<PageResult> {
  try {
    console.log(`Processing page: ${url}`);
    const { data } = await axios.get(url, { timeout: 15000 });
    const $ = cheerio.load(data);

    const contentElement = $(contentSelector);

    if (downloadImages) {
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
    if (contentHtml) {
      const markdown = turndownService.turndown(contentHtml);
      return { url, markdown, status: 'success' };
    }
    return { url, status: 'error', error: `Content not found using selector "${contentSelector}"` };
  } catch (error) {
    return { url, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// --- Main Execution ---
async function main() {
  const argv = await parseArgs();
  const { url, navSelector, contentSelector, output, concurrency, downloadImages, outputDir } = argv;

  const limit = pLimit(concurrency);
  const imagesDir = path.join(outputDir, 'images');

  if (downloadImages) {
    await fs.mkdir(imagesDir, { recursive: true });
    console.log(`Created images directory at: ${imagesDir}`);
  }
  
  const links = await getNavigationLinks(url, navSelector);
  if (links.length === 0) {
    console.error('No navigation links found. Please check your --navSelector.');
    return;
  }

  const promises = links.map(link => limit(() => fetchAndConvertPage(link, contentSelector, downloadImages, imagesDir)));
  const results = await Promise.all(promises);

  const successfulPages = new Map<string, string>();
  const failedPages: { url: string, error: string }[] = [];

  for (const result of results) {
    if (result.status === 'success') {
      successfulPages.set(result.url, result.markdown);
    } else {
      failedPages.push({ url: result.url, error: result.error });
    }
  }

  let fullMarkdown = '';
  for (const link of links) {
    if (successfulPages.has(link)) {
      fullMarkdown += successfulPages.get(link) + '\n\n---\n\n';
    }
  }

  if (fullMarkdown) {
    const outputPath = path.join(outputDir, output);
    await fs.writeFile(outputPath, fullMarkdown);
    console.log(`\n✅ Successfully created markdown file: ${outputPath}`);
    console.log(`Processed ${links.length} pages: ${successfulPages.size} succeeded, ${failedPages.length} failed.`);
  } else {
    console.error('\n❌ Failed to generate any markdown content.');
  }

  if (failedPages.length > 0) {
    console.log('\n--- Failed Pages ---');
    for (const failure of failedPages) {
      console.log(`URL: ${failure.url}\nError: ${failure.error}\n`);
    }
  }
}

main();
