import type { Browser, BrowserContext, Page } from 'playwright';
import { newVisitorContext, waitForUnloadBeacons } from './browser.ts';
import { PARTNER_URL, SITE_ORIGIN } from './config.ts';
import type { BrowserStorage, VisitRun } from './recording.ts';
import type { Recording } from './server.ts';
import { ELEMENTS, TEST_EMAIL } from './test-site.ts';
import type { PageElement } from './test-site.ts';

/**
 * How long to wait after each action before the next. The trackers batch:
 * Privatrak sends every 5 seconds, and its dead-click detection waits up to 5
 * seconds for a click to have an effect, so every wait after a click covers a
 * full batch; the longer waits leave room for that detection on top.
 */
const SETTLE = { short: 2000, navigation: 4000, batch: 6000, deadClick: 8000 } as const;

/** Clicks quickly enough to count as rage clicks in every tool that has them. */
const RAGE_CLICKS = 4;

type Action =
  | { type: 'open'; path: string }
  | { type: 'click'; element: PageElement; times?: number }
  | { type: 'download'; element: PageElement }
  | { type: 'follow'; element: PageElement; to: string }
  | { type: 'back' };

export interface VisitStep {
  /** Recorded as `phase` with every request sent while the step runs. */
  id: string;
  action: Action;
  settle: number;
}

/** The visit, the same for every tool. */
export const VISIT_STEPS: readonly VisitStep[] = [
  { id: 'load', action: { type: 'open', path: '/' }, settle: SETTLE.batch },
  {
    id: 'button',
    action: { type: 'click', element: ELEMENTS.workingButton },
    settle: SETTLE.batch,
  },
  {
    id: 'dead-clicks',
    action: { type: 'click', element: ELEMENTS.brokenButton, times: RAGE_CLICKS },
    settle: SETTLE.deadClick,
  },
  {
    // A picture with a pointer cursor and no handler: it looks clickable, but isn't a control.
    id: 'clickable-picture',
    action: { type: 'click', element: ELEMENTS.clickablePicture, times: RAGE_CLICKS },
    settle: SETTLE.deadClick,
  },
  {
    id: 'download',
    action: { type: 'download', element: ELEMENTS.downloadLink },
    settle: SETTLE.batch,
  },
  {
    id: 'internal-link',
    action: { type: 'follow', element: ELEMENTS.internalLink, to: `${SITE_ORIGIN}/pricing` },
    settle: SETTLE.navigation,
  },
  { id: 'back', action: { type: 'back' }, settle: SETTLE.navigation },
  {
    id: 'outbound',
    action: { type: 'follow', element: ELEMENTS.outboundLink, to: PARTNER_URL },
    settle: SETTLE.short,
  },
  { id: 'back-from-outbound', action: { type: 'back' }, settle: SETTLE.navigation },
  {
    id: 'form',
    action: { type: 'follow', element: ELEMENTS.subscribeButton, to: `${SITE_ORIGIN}/thanks` },
    settle: SETTLE.navigation,
  },
  {
    id: 'email-in-url',
    action: {
      type: 'open',
      path: `/welcome?email=${encodeURIComponent(TEST_EMAIL)}&utm_source=newsletter`,
    },
    settle: SETTLE.navigation,
  },
];

/** The id of the step whose action targets the element with `elementId`. */
export function stepForElement(elementId: string): string | undefined {
  // Submitting the form is the subscribe button's step, whichever of the two a tool names.
  if (elementId === ELEMENTS.newsletterForm.id) return stepForElement(ELEMENTS.subscribeButton.id);
  return VISIT_STEPS.find(({ action }) => 'element' in action && action.element.id === elementId)
    ?.id;
}

async function perform(page: Page, action: Action): Promise<void> {
  switch (action.type) {
    case 'open':
      await page.goto(`${SITE_ORIGIN}${action.path}`, { waitUntil: 'load' });
      return;
    case 'click':
      for (let i = 0; i < (action.times ?? 1); i++) {
        await page.click(`#${action.element.id}`, { delay: 20 });
      }
      return;
    case 'download': {
      const download = page.waitForEvent('download', { timeout: 4000 });
      await page.click(`#${action.element.id}`);
      await download;
      return;
    }
    case 'follow':
      await Promise.all([page.waitForURL(action.to), page.click(`#${action.element.id}`)]);
      return;
    case 'back':
      await page.goBack({ waitUntil: 'load' });
      return;
  }
}

async function readStorage(context: BrowserContext, page: Page): Promise<BrowserStorage> {
  const cookies = (await context.cookies()).map((cookie) => ({
    name: cookie.name,
    domain: cookie.domain,
    expires: cookie.expires > 0 ? new Date(cookie.expires * 1000).toISOString() : 'session',
  }));
  const storage = await page.evaluate(async () => {
    const entries = (store: Storage): { key: string; value: string }[] =>
      Object.keys(store).map((key) => ({ key, value: String(store.getItem(key)).slice(0, 400) }));
    return {
      localStorage: entries(localStorage),
      sessionStorage: entries(sessionStorage),
      indexedDB: (await indexedDB.databases()).map((database) => database.name ?? ''),
    };
  });
  return { cookies, ...storage };
}

/** Runs the visit for the tool `recording` is for, and what it left in the browser. */
export async function runVisit(browser: Browser, recording: Recording): Promise<VisitRun> {
  const context = await newVisitorContext(browser);
  const page = await context.newPage();
  let afterLoad: BrowserStorage | undefined;
  for (const step of VISIT_STEPS) {
    recording.phase = step.id;
    await perform(page, step.action);
    await page.waitForTimeout(step.settle);
    afterLoad ??= await readStorage(context, page);
  }
  const afterVisit = await readStorage(context, page);
  recording.phase = 'close';
  await page.close({ runBeforeUnload: true });
  await waitForUnloadBeacons();
  await context.close();
  return {
    tool: recording.tool.id,
    note: recording.tool.note ?? null,
    scripts: recording.scripts,
    afterLoad: afterLoad ?? afterVisit,
    afterVisit,
    sent: recording.requests,
    ranAt: new Date().toISOString(),
  };
}
