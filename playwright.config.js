// playwright.config.js
// TODO: CRITICAL - Configuration is too minimal for robust automation
// MISSING: Proper timeout settings, retry logic, error handling configurations
// MISSING: Test-specific settings for modal interactions
// MISSING: Proper reporter configurations for debugging
module.exports = {
  reporter: [['html', { open: 'never' }]],
  // TODO: ADD - timeout: 300000, expect: { timeout: 10000 }, retries: 2
  // TODO: ADD - workers: 1 (WhatsApp needs sequential execution)
  // TODO: ADD - use: { trace: 'on-first-retry', screenshot: 'only-on-failure' }
};