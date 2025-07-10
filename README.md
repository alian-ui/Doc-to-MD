# Doc-to-MD: Website Documentation Converter

This is a command-line interface (CLI) tool designed to crawl a website's documentation pages, extract their main content, and compile it into a single, clean Markdown file. It's perfect for creating offline versions of official documentation or for migrating content.

## Features

- **Automated Crawling**: Automatically discovers all documentation pages by following links within a specified navigation element (like a sidebar or table of contents).
- **HTML to Markdown Conversion**: Converts the HTML of each page's main content area into well-formatted Markdown.
- **Preserves Page Order**: Assembles the final Markdown file in the same order as the links appeared in the navigation.
- **Image Downloading**: Optionally downloads all images found in the content and updates their paths to point to local files, creating a self-contained document.
- **Concurrent Processing**: Fetches and processes multiple pages in parallel for significant speed improvements.
- **Configurable & Robust**: Allows customization of concurrency levels and provides detailed reports on successful and failed pages.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18.x or later recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)

## Installation

1.  Clone this repository or download the source code.
2.  Navigate to the project directory in your terminal.
3.  Install the necessary dependencies:
    ```bash
    npm install
    ```

## Usage

### How to Find CSS Selectors

The `--navSelector` and `--contentSelector` options are crucial for this tool to work correctly. You can find the right CSS selectors by using the developer tools in your web browser (like Chrome, Firefox, or Edge).

1.  **Open Developer Tools**: Navigate to the target documentation website. Right-click on the navigation menu (the table of contents or sidebar) and select **"Inspect"** or **"Inspect Element"**. This will open the developer tools, showing you the HTML code of the page.

2.  **Identify the Navigation Container**:
    -   Hover over the HTML elements in the developer tools. The browser will highlight the corresponding parts of the page.
    -   Find the element that contains the *entire* navigation menu. Look for an `id` or `class` attribute that seems descriptive, like `id="toc"`, `class="sidebar"`, or `role="navigation"`.
    -   Right-click on this element in the developer tools, go to **Copy**, and select **Copy > Copy selector**. This copied value is your `--navSelector`.

3.  **Identify the Content Container**:
    -   Similarly, right-click on the main text area of the page (the article content itself) and select **"Inspect"**.
    -   Find the element that wraps all the text, headings, and images you want to capture. It might be an `<article>`, `<main>`, or a `<div>` with an ID like `id="main-content"` or a class like `class="post-body"`.
    -   Copy its selector just as you did for the navigation. This is your `--contentSelector`.

**Tip**: Aim for the simplest, most stable selector. An `id` (e.g., `#main-content`) is usually better than a complex class selector (e.g., `.col-md-9.main-class`).

The tool is run from the command line using `npm start`. You must provide the target URL and CSS selectors for the navigation and content areas.

```bash
npm start -- [options]
```

**Note**: The `--` after `npm start` is important. It separates npm's arguments from your script's arguments.

### Options

| Option              | Alias | Description                                                                                             | Required | Default       |
| ------------------- | ----- | ------------------------------------------------------------------------------------------------------- | -------- | ------------- |
| `--url`             |       | The starting URL of the documentation (e.g., the main page or table of contents).                       | **Yes**  | -             |
| `--navSelector`     |       | The CSS selector for the HTML element containing the navigation links (e.g., `.sidebar`, `#toc`).         | **Yes**  | -             |
| `--contentSelector` |       | The CSS selector for the HTML element containing the main page content (e.g., `.main-content`, `#article`). | **Yes**  | -             |
| `--output`          | `-o`  | The name of the final Markdown output file.                                                             | No       | `output.md`   |
| `--outputDir`       |       | The directory where the output file and downloaded images will be saved.                                | No       | `.` (current) |
| `--concurrency`     | `-c`  | The number of pages to process concurrently.                                                            | No       | `5`           |
| `--downloadImages`  |       | If present, downloads all images to a local `images` folder.                                            | No       | `false`       |

### Examples

#### Basic Usage

Crawl a documentation site and save the content to `output.md`.

```bash
npm start -- --url "https://example.com/docs" --navSelector ".docs-nav" --contentSelector ".docs-content"
```

#### Advanced Usage (with Image Downloading)

Crawl a site, download all images, set a higher concurrency, and save everything to a specific directory.

```bash
npm start -- --url "https://anothersite.com/guides" \
             --navSelector "#navigation-menu" \
             --contentSelector "main.article-body" \
             --outputDir ./my-documentation \
             --output "guides.md" \
             --concurrency 10 \
             --downloadImages
```

This will create a `./my-documentation` directory containing `guides.md` and an `images/` subdirectory with all the downloaded images.

## How It Works

1.  **Link Extraction**: The tool starts at the `--url`, finds the `--navSelector` element, and gathers all unique `<a>` links within it.
2.  **Page Processing Queue**: It creates a queue of pages to process based on the extracted links.
3.  **Concurrent Fetching**: It fetches multiple pages from the queue in parallel, respecting the `--concurrency` limit.
4.  **Content Conversion**: For each page:
    - It extracts the HTML from the `--contentSelector` element.
    - If `--downloadImages` is enabled, it finds all `<img>` tags, downloads the images, and replaces the image `src` with the new local path.
    - It converts the resulting HTML to Markdown.
5.  **File Assembly**: After all pages are processed, it assembles the Markdown content from all successful pages into a single string, preserving the original link order.
6.  **Output**: The final string is written to the specified output file. A summary report of successful and failed pages is printed to the console.

## Development

### Running Tests

This project uses Jest for testing. To run the test suite:

```bash
npm test
```

This will execute all files ending in `.test.ts`.
