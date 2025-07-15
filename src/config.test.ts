import { jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  DocToMdConfig,
  DEFAULT_CONFIG,
  loadConfigFromFile,
  saveConfigToFile,
  mergeConfigs,
  validateConfig,
  initializeConfigFile,
  getConfigSummary
} from './config';

// Mock file system
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Configuration Management Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Loading', () => {
    it('should load valid JSON configuration', async () => {
      const mockConfig = {
        crawl: {
          timeout: 20000,
          customHeaders: {
            'Authorization': 'Bearer token123'
          }
        },
        output: {
          format: 'json',
          includeMetadata: false
        }
      };

      mockedFs.access.mockResolvedValueOnce(undefined);
      mockedFs.readFile.mockResolvedValueOnce(JSON.stringify(mockConfig));

      const result = await loadConfigFromFile('config.json');
      
      expect(result).toEqual(mockConfig);
      expect(mockedFs.readFile).toHaveBeenCalledWith('config.json', 'utf-8');
    });

    it('should handle missing configuration file gracefully', async () => {
      mockedFs.access.mockRejectedValueOnce(new Error('File not found'));

      const result = await loadConfigFromFile('nonexistent.json');
      
      expect(result).toEqual({});
    });

    it('should handle invalid JSON gracefully', async () => {
      mockedFs.access.mockResolvedValueOnce(undefined);
      mockedFs.readFile.mockResolvedValueOnce('invalid json {');

      await expect(loadConfigFromFile('invalid.json')).rejects.toThrow();
    });

    it('should reject unsupported file formats', async () => {
      mockedFs.access.mockResolvedValueOnce(undefined);
      mockedFs.readFile.mockResolvedValueOnce('some yaml content');

      await expect(loadConfigFromFile('config.yaml')).rejects.toThrow('YAML config files require yaml parser dependency');
    });
  });

  describe('Configuration Saving', () => {
    it('should save configuration to JSON file', async () => {
      const config = DEFAULT_CONFIG;
      mockedFs.mkdir.mockResolvedValueOnce(undefined);
      mockedFs.writeFile.mockResolvedValueOnce();

      await saveConfigToFile(config, 'output/config.json');

      expect(mockedFs.mkdir).toHaveBeenCalledWith('output', { recursive: true });
      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        'output/config.json',
        JSON.stringify(config, null, 2),
        'utf-8'
      );
    });

    it('should handle write errors gracefully', async () => {
      mockedFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(saveConfigToFile(DEFAULT_CONFIG, '/readonly/config.json')).rejects.toThrow();
    });
  });

  describe('Configuration Merging', () => {
    it('should merge configurations correctly', () => {
      const baseConfig: Partial<DocToMdConfig> = {
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          timeout: 10000,
          userAgent: 'Base Agent',
          customHeaders: { 'Accept': 'text/html' }
        },
        concurrency: 3
      };

      const overrideConfig: Partial<DocToMdConfig> = {
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          timeout: 20000,
          customHeaders: { 'Authorization': 'Bearer token' }
        },
        downloadImages: true
      };

      const merged = mergeConfigs(baseConfig, overrideConfig);

      expect(merged.crawl.timeout).toBe(20000); // Overridden
      expect(merged.crawl.userAgent).toBe(DEFAULT_CONFIG.crawl.userAgent); // From DEFAULT_CONFIG since override doesn't specify
      expect(merged.crawl.customHeaders).toEqual({
        'Accept': 'text/html',
        'Authorization': 'Bearer token'
      }); // Merged
      expect(merged.concurrency).toBe(3); // From base
      expect(merged.downloadImages).toBe(true); // From override
    });

    it('should handle nested object merging', () => {
      const config1: Partial<DocToMdConfig> = {
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          retry: {
            ...DEFAULT_CONFIG.crawl.retry,
            maxRetries: 5,
            baseDelay: 2000
          }
        }
      };

      const config2: Partial<DocToMdConfig> = {
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          retry: {
            ...DEFAULT_CONFIG.crawl.retry,
            maxRetries: 3
          }
        }
      };

      const merged = mergeConfigs(config1, config2);

      expect(merged.crawl.retry.maxRetries).toBe(3); // Overridden
      expect(merged.crawl.retry.baseDelay).toBe(DEFAULT_CONFIG.crawl.retry.baseDelay); // From DEFAULT_CONFIG, since config2 doesn't override it
    });

    it('should merge multiple configurations in order', () => {
      const config1 = { concurrency: 1 };
      const config2 = { concurrency: 2, downloadImages: true };
      const config3 = { concurrency: 3 };

      const merged = mergeConfigs(config1, config2, config3);

      expect(merged.concurrency).toBe(3); // Last override wins
      expect(merged.downloadImages).toBe(true); // Preserved from config2
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.nav',
          content: '.content',
          excludeSelectors: [],
          includeSelectors: []
        }
      };

      const result = validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required selectors', () => {
      const invalidConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '',
          content: '',
          excludeSelectors: [],
          includeSelectors: []
        }
      };

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Navigation selector is required');
      expect(result.errors).toContain('Content selector is required');
    });

    it('should validate proxy configuration', () => {
      const invalidConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.nav',
          content: '.content',
          excludeSelectors: [],
          includeSelectors: []
        },
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          proxy: {
            enabled: true,
            host: '', // Invalid
            port: 0   // Invalid
          }
        }
      };

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Proxy host is required when proxy is enabled');
      expect(result.errors).toContain('Valid proxy port is required when proxy is enabled');
    });

    it('should validate rate limiting configuration', () => {
      const invalidConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.nav',
          content: '.content',
          excludeSelectors: [],
          includeSelectors: []
        },
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          rateLimit: {
            enabled: true,
            requestsPerSecond: 0,  // Invalid
            burstSize: -1,         // Invalid
            respectRobotsTxt: true
          }
        }
      };

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Requests per second must be positive');
      expect(result.errors).toContain('Burst size must be positive');
    });

    it('should validate output configuration', () => {
      const invalidConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.nav',
          content: '.content',
          excludeSelectors: [],
          includeSelectors: []
        },
        output: {
          ...DEFAULT_CONFIG.output,
          format: 'invalid' as any,  // Invalid format
          tocMaxDepth: 0,            // Invalid
          maxImageSize: -1           // Invalid
        }
      };

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Output format must be markdown, html, or json');
      expect(result.errors).toContain('TOC max depth must be positive');
      expect(result.errors).toContain('Max image size must be positive');
    });

    it('should validate crawl timeout and retry settings', () => {
      const invalidConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.nav',
          content: '.content',
          excludeSelectors: [],
          includeSelectors: []
        },
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          timeout: -1,  // Invalid
          retry: {
            ...DEFAULT_CONFIG.crawl.retry,
            maxRetries: -1,  // Invalid
            baseDelay: 0     // Invalid
          }
        }
      };

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Timeout must be positive');
      expect(result.errors).toContain('Max retries cannot be negative');
      expect(result.errors).toContain('Base delay must be positive');
    });

    it('should validate concurrency setting', () => {
      const invalidConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.nav',
          content: '.content',
          excludeSelectors: [],
          includeSelectors: []
        },
        concurrency: 0  // Invalid
      };

      const result = validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Concurrency must be positive');
    });
  });

  describe('Configuration Summary', () => {
    it('should generate comprehensive configuration summary', () => {
      const config: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.main-nav',
          content: '.article-content',
          excludeSelectors: ['.ads', '.footer'],
          includeSelectors: []
        },
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          proxy: {
            enabled: true,
            host: 'proxy.example.com',
            port: 8080,
            protocol: 'http'
          },
          rateLimit: {
            enabled: true,
            requestsPerSecond: 2,
            burstSize: 5,
            respectRobotsTxt: true
          },
          customHeaders: {
            'Authorization': 'Bearer token',
            'Custom-Header': 'value'
          }
        },
        concurrency: 3,
        downloadImages: true
      };

      const summary = getConfigSummary(config);

      expect(summary).toContain('Navigation Selector: .main-nav');
      expect(summary).toContain('Content Selector: .article-content');
      expect(summary).toContain('Concurrency: 3');
      expect(summary).toContain('Download Images: true');
      expect(summary).toContain('Proxy: http://proxy.example.com:8080');
      expect(summary).toContain('Rate Limit: 2 req/s');
      expect(summary).toContain('Custom Headers: 2 defined');
      expect(summary).toContain('Exclude Selectors: 2 defined');
    });

    it('should handle minimal configuration', () => {
      const minimalConfig: DocToMdConfig = {
        ...DEFAULT_CONFIG,
        selectors: {
          navigation: '.nav',
          content: '.content',
          excludeSelectors: [],
          includeSelectors: []
        }
      };

      const summary = getConfigSummary(minimalConfig);

      expect(summary).toContain('Navigation Selector: .nav');
      expect(summary).toContain('Content Selector: .content');
      expect(summary).not.toContain('Proxy:');
      expect(summary).not.toContain('Rate Limit:');
      expect(summary).not.toContain('Custom Headers:');
    });
  });

  describe('Configuration Initialization', () => {
    it('should initialize configuration file with defaults', async () => {
      mockedFs.mkdir.mockResolvedValueOnce(undefined);
      mockedFs.writeFile.mockResolvedValueOnce();

      await initializeConfigFile('config.json');

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        'config.json',
        expect.stringContaining('"navigation"'),
        'utf-8'
      );
    });

    it('should handle file system errors during initialization', async () => {
      mockedFs.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(initializeConfigFile('/readonly/config.json')).rejects.toThrow();
    });
  });

  describe('Advanced Configuration Features', () => {
    it('should handle custom headers configuration', () => {
      const config = mergeConfigs(DEFAULT_CONFIG, {
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          customHeaders: {
            'Authorization': 'Bearer secret-token',
            'Accept-Language': 'en-US,en;q=0.9',
            'Custom-API-Key': 'api-key-123'
          }
        }
      });

      expect(config.crawl.customHeaders).toEqual({
        'Authorization': 'Bearer secret-token',
        'Accept-Language': 'en-US,en;q=0.9',
        'Custom-API-Key': 'api-key-123'
      });
    });

    it('should handle proxy authentication configuration', () => {
      const config = mergeConfigs(DEFAULT_CONFIG, {
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          proxy: {
            enabled: true,
            host: 'proxy.company.com',
            port: 3128,
            protocol: 'https' as const,
            auth: {
              username: 'proxyuser',
              password: 'proxypass'
            }
          }
        }
      });

      expect(config.crawl.proxy).toEqual({
        enabled: true,
        host: 'proxy.company.com',
        port: 3128,
        protocol: 'https',
        auth: {
          username: 'proxyuser',
          password: 'proxypass'
        }
      });
    });

    it('should handle SSL configuration options', () => {
      const config = mergeConfigs(DEFAULT_CONFIG, {
        crawl: {
          ...DEFAULT_CONFIG.crawl,
          sslConfig: {
            rejectUnauthorized: false,
            allowSelfSigned: true,
            ciphers: 'HIGH:!aNULL:!MD5'
          }
        }
      });

      expect(config.crawl.sslConfig).toEqual({
        rejectUnauthorized: false,
        allowSelfSigned: true,
        ciphers: 'HIGH:!aNULL:!MD5'
      });
    });

    it('should handle output format configuration', () => {
      const config = mergeConfigs(DEFAULT_CONFIG, {
        output: {
          ...DEFAULT_CONFIG.output,
          format: 'json' as const,
          includeMetadata: false,
          includeToc: true,
          tocMaxDepth: 2,
          maxImageSize: 5,
          imageFormats: ['png', 'jpg']
        }
      });

      expect(config.output.format).toBe('json');
      expect(config.output.includeMetadata).toBe(false);
      expect(config.output.includeToc).toBe(true);
      expect(config.output.tocMaxDepth).toBe(2);
      expect(config.output.maxImageSize).toBe(5);
      expect(config.output.imageFormats).toEqual(['png', 'jpg']);
    });
  });
});
