

import pLimit from 'p-limit';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as fs from 'fs/promises';
import * as path from 'path';

// Import core functionality
import { 
  getNavigationLinks, 
  fetchAndConvertPage, 
  PageResult 
} from './core';

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
