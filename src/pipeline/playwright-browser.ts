/**
 * Shared Playwright browser singleton.
 * Launched once, reused across jobs in the same process.
 * Re-launched automatically on crash.
 */
import type { Browser } from 'playwright-core';

let _browser: Browser | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (_browser?.isConnected()) return _browser;

  const { chromium } = await import('playwright-core');
  _browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  _browser.on('disconnected', () => {
    _browser = null;
  });

  return _browser;
}

export async function closeSharedBrowser(): Promise<void> {
  if (_browser?.isConnected()) {
    await _browser.close();
  }
  _browser = null;
}
