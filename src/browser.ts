import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';
import { SERVER_PORT, USER_AGENT } from './config.ts';

/**
 * Installed Chrome (not Playwright's Chromium), with every hostname resolved
 * to the local server and `navigator.webdriver` hidden: Plausible and
 * Privatrak skip visits from automated browsers.
 */
export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      `--host-resolver-rules=MAP * 127.0.0.1:${SERVER_PORT}`,
      // The local server's certificate is self-signed. The context's
      // `ignoreHTTPSErrors` does not cover requests sent while a page
      // unloads, which is when several trackers send their last batch.
      '--ignore-certificate-errors',
    ],
  });
}

/** A fresh profile per tool, so nothing one tool stored is seen by the next. */
export async function newVisitorContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    acceptDownloads: true,
    // The local server's certificate is self-signed.
    ignoreHTTPSErrors: true,
  });
}

/** Waits after the last page closed, so beacons sent while it unloaded arrive. */
export async function waitForUnloadBeacons(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 2000));
}
