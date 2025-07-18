"use strict";
/**
 * Site-specific optimizations for popular documentation platforms
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SITE_OPTIMIZATIONS = void 0;
exports.detectSiteOptimization = detectSiteOptimization;
exports.getOptimizedSelectors = getOptimizedSelectors;
exports.SITE_OPTIMIZATIONS = [
    {
        name: 'Vue.js Documentation',
        patterns: [/vuejs\.org/, /vue\.js\.org/],
        optimizations: {
            navigationSelectors: ['.sidebar-links', '.sidebar', 'nav.nav-links', '.nav-dropdown'],
            contentSelectors: ['.page', '.content', 'main', '.theme-default-content'],
            excludeSelectors: ['.nav-links', '.page-nav', '.sidebar', '.edit-link'],
            specialHandling: ['spa-navigation']
        },
        recommendedCrawler: 'configurable',
        notes: 'VuePress-based documentation with dynamic navigation'
    },
    {
        name: 'React Documentation',
        patterns: [/react\.dev/, /reactjs\.org/],
        optimizations: {
            navigationSelectors: ['.nav', 'nav[role="navigation"]', '.sidebar', '.toc'],
            contentSelectors: ['main', '.content', 'article', '.markdown'],
            excludeSelectors: ['.nav', '.sidebar-nav', '.footer'],
            specialHandling: ['modern-spa']
        },
        recommendedCrawler: 'format',
        notes: 'Modern React-based documentation site'
    },
    {
        name: 'MDN Web Docs',
        patterns: [/developer\.mozilla\.org/],
        optimizations: {
            navigationSelectors: ['.sidebar', '.document-toc', 'nav.crumbs', '.main-page-content nav'],
            contentSelectors: ['#content', '.main-page-content', 'article', '.section-content'],
            excludeSelectors: ['.sidebar', '.document-toc', '.page-footer', '.newsletter-container'],
            specialHandling: ['large-site', 'api-reference']
        },
        recommendedCrawler: 'performance',
        notes: 'Extensive documentation requiring performance optimization'
    },
    {
        name: 'Docker Documentation',
        patterns: [/docs\.docker\.com/],
        optimizations: {
            navigationSelectors: ['.sidebar', '.toc', 'nav.docs-nav', '.navigation'],
            contentSelectors: ['main', '.content', '.docs-content', 'article'],
            excludeSelectors: ['.sidebar', '.toc', '.header', '.footer', '.nav']
        },
        recommendedCrawler: 'configurable',
        notes: 'Standard documentation structure with clear navigation'
    },
    {
        name: 'Node.js Documentation',
        patterns: [/nodejs\.org\/docs/, /nodejs\.org\/api/],
        optimizations: {
            navigationSelectors: ['#toc', '.toc', 'nav', '#column1'],
            contentSelectors: ['#content', '#apicontent', 'main', '.api'],
            excludeSelectors: ['#toc', '.toc', '#header', '#footer'],
            specialHandling: ['api-reference', 'version-specific']
        },
        recommendedCrawler: 'performance',
        notes: 'API reference documentation with extensive content'
    },
    {
        name: 'GitHub Documentation',
        patterns: [/docs\.github\.com/],
        optimizations: {
            navigationSelectors: ['.sidebar', '.TableOfContents', 'nav[aria-label="Docs"]'],
            contentSelectors: ['main', '.content', 'article', '.markdown-body'],
            excludeSelectors: ['.sidebar', '.TableOfContents', '.footer']
        },
        recommendedCrawler: 'configurable',
        notes: 'GitHub-flavored markdown with consistent structure'
    },
    {
        name: 'Express.js Documentation',
        patterns: [/expressjs\.com/],
        optimizations: {
            navigationSelectors: ['#nav', '.navigation', '.sidebar', '#menu'],
            contentSelectors: ['#content', '.content', 'main', '.page-content'],
            excludeSelectors: ['#nav', '.navigation', '.footer', '.header']
        },
        recommendedCrawler: 'basic',
        notes: 'Simple traditional documentation structure'
    },
    {
        name: 'Tailwind CSS Documentation',
        patterns: [/tailwindcss\.com\/docs/],
        optimizations: {
            navigationSelectors: ['.navigation', '.sidebar', 'nav.fixed'],
            contentSelectors: ['main', '.content', '.prose', '.markdown'],
            excludeSelectors: ['.navigation', '.sidebar', '.header', '.footer']
        },
        recommendedCrawler: 'format',
        notes: 'Design-focused documentation with rich formatting'
    },
    {
        name: 'Docsify Documentation',
        patterns: [/marpit\.marp\.app/, /docsify\.js\.org/],
        optimizations: {
            navigationSelectors: ['#app', '.sidebar', '.sidebar-nav'],
            contentSelectors: ['#app', '.content', '.markdown-section'],
            excludeSelectors: ['.sidebar', '.sidebar-nav', '.app-nav'],
            specialHandling: ['docsify-spa', 'markdown-direct']
        },
        recommendedCrawler: 'configurable',
        notes: 'Docsify SPA framework - requires direct markdown file access'
    }
];
/**
 * Detect if a URL matches any known site patterns
 */
function detectSiteOptimization(url) {
    for (const pattern of exports.SITE_OPTIMIZATIONS) {
        if (pattern.patterns.some(regex => regex.test(url))) {
            return pattern;
        }
    }
    return null;
}
/**
 * Get optimized selectors for a detected site
 */
function getOptimizedSelectors(url) {
    const sitePattern = detectSiteOptimization(url);
    if (sitePattern) {
        return {
            navigation: sitePattern.optimizations.navigationSelectors.join(', '),
            content: sitePattern.optimizations.contentSelectors.join(', '),
            exclude: sitePattern.optimizations.excludeSelectors,
            recommendedCrawler: sitePattern.recommendedCrawler,
            siteName: sitePattern.name,
            specialHandling: sitePattern.optimizations.specialHandling || [],
            notes: sitePattern.notes
        };
    }
    return null;
}
