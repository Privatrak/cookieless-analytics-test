import type { Browser } from 'playwright';
import { newVisitorContext, waitForUnloadBeacons } from './browser.ts';
import { SITE_ORIGIN } from './config.ts';
import type { UrlCase, UrlRun } from './recording.ts';
import type { Recording } from './server.ts';
import { TEST_EMAIL } from './test-site.ts';

/** The values that must not reach a tool, in the forms they take in real addresses. */
export const SECRETS = {
  email: TEST_EMAIL,
  token: 'k3J9xQ2mP8vL',
  id: '48213',
  uuid: '3f1c9a1e-7b2d-4c8e-9f0a-1d2e3f4a5b6c',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0ODIxMyJ9.c2lnbmF0dXJlLXRlc3Q',
};

const EMAIL_IN_QUERY = encodeURIComponent(SECRETS.email);

/**
 * Personal data and IDs where they turn up in real addresses, and data worth
 * keeping. Each case is one page load; `then` clicks onward, so the case's
 * address goes out as the next page view's referrer.
 */
export const URL_CASES: readonly UrlCase[] = [
  {
    id: 'query-email',
    path: `/welcome?email=${EMAIL_IN_QUERY}&utm_source=newsletter`,
    secret: 'email',
  },
  {
    id: 'query-email-other-name',
    path: `/welcome?u=${EMAIL_IN_QUERY}&utm_source=newsletter`,
    secret: 'email',
  },
  { id: 'query-token', path: `/reset-password?token=${SECRETS.token}`, secret: 'token' },
  { id: 'path-email', path: `/unsubscribe/${SECRETS.email}`, secret: 'email' },
  { id: 'path-id', path: `/users/${SECRETS.id}/settings`, secret: 'id' },
  { id: 'path-uuid', path: `/orders/${SECRETS.uuid}`, secret: 'uuid' },
  { id: 'fragment-token', path: `/callback#access_token=${SECRETS.token}`, secret: 'token' },
  {
    id: 'referrer-email',
    path: `/account?email=${EMAIL_IN_QUERY}`,
    secret: 'email',
    then: '#next',
  },
  { id: 'query-jwt-other-name', path: `/app?t=${SECRETS.jwt}`, secret: 'jwt' },
  { id: 'keep-search', path: '/search?q=running+shoes', keep: 'q=running' },
  { id: 'keep-page-sort', path: '/products?page=2&sort=price', keep: 'sort=price' },
  { id: 'keep-slug', path: '/products/blue-running-shoes', keep: '/products/blue-running-shoes' },
  { id: 'keep-date', path: '/blog/2026/10/launch-notes', keep: '/blog/2026/10/launch-notes' },
  { id: 'keep-version', path: '/docs/v2/install', keep: '/docs/v2/install' },
];

/** Waits long enough for a page's view to be sent. */
const SETTLE_MS = 4000;
/** The neutral start page needs less: it is only there to separate the cases. */
const START_PAGE_SETTLE_MS = 2500;

/** Opens every case, each from the neutral start page. */
export async function runUrlTest(browser: Browser, recording: Recording): Promise<UrlRun> {
  const context = await newVisitorContext(browser);
  const page = await context.newPage();
  for (const urlCase of URL_CASES) {
    recording.phase = 'between';
    await page.goto(`${SITE_ORIGIN}/`, { waitUntil: 'load' });
    await page.waitForTimeout(START_PAGE_SETTLE_MS);
    recording.phase = urlCase.id;
    await page.goto(`${SITE_ORIGIN}${urlCase.path}`, { waitUntil: 'load' });
    await page.waitForTimeout(SETTLE_MS);
    if (urlCase.then) {
      await Promise.all([page.waitForURL(`${SITE_ORIGIN}/pricing`), page.click(urlCase.then)]);
      await page.waitForTimeout(SETTLE_MS);
    }
  }
  recording.phase = 'close';
  await page.close({ runBeforeUnload: true });
  await waitForUnloadBeacons();
  await context.close();
  return {
    tool: recording.tool.id,
    cases: [...URL_CASES],
    secrets: SECRETS,
    sent: recording.requests,
    ranAt: new Date().toISOString(),
  };
}
