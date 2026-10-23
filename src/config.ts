import path from 'node:path';

/** The repository root. Every path the test reads or writes is below it. */
export const ROOT = path.resolve(import.meta.dirname, '..');

export const SCRIPTS_DIR = path.join(ROOT, 'scripts');
export const BLOCKLISTS_DIR = path.join(ROOT, 'blocklists');
export const RESULTS_DIR = path.join(ROOT, 'results');
export const URL_RESULTS_DIR = path.join(RESULTS_DIR, 'urls');
export const KEY_FILE = path.join(ROOT, 'key.pem');
export const CERT_FILE = path.join(ROOT, 'cert.pem');

/** The made-up site every tool is installed on. */
export const SITE_HOST = 'cookieless-test.example';
export const SITE_ORIGIN = `https://${SITE_HOST}`;

/** Where the test page's outbound link goes. */
export const PARTNER_URL = 'https://example.org/partner';

/** The local HTTPS server Chrome sends every request to. */
export const SERVER_PORT = 8443;

/**
 * A fixed desktop Chrome user agent. With `navigator.webdriver` hidden as
 * well, no tool can tell the visit is automated and skip it.
 */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

/**
 * Hosts of Chrome's own background services (update checks, autofill,
 * sign-in). They reach the local server too, because every hostname resolves
 * to it, and are neither answered as a tool nor recorded.
 */
export const CHROME_SERVICE_HOSTS = ['google.com', 'googleapis.com', 'gstatic.com', 'gvt1.com'];

export function isChromeServiceHost(host: string): boolean {
  return CHROME_SERVICE_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
