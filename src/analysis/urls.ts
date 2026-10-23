import { SITE_ORIGIN } from '../config.ts';
import type { RecordedRequest, UrlCase, UrlRun } from '../recording.ts';
import type { Tool } from '../tools/tool.ts';
import { eventsOf } from './events.ts';
import { readable } from './text.ts';

/**
 * For personal data the good result is that it is gone (`redacted`,
 * `dropped`, `no referrer`); for data worth keeping it is `kept`.
 */
export type UrlVerdict =
  'leaked' | 'redacted' | 'dropped' | 'no referrer' | 'kept' | 'rewritten' | 'no page view sent';

export interface UrlCaseResult {
  /** Where the case's address was looked for: the page view's page, or the next page view's referrer. */
  where: 'page' | 'referrer';
  /** The address exactly as the tool sent it. */
  recorded: string | null;
  verdict: UrlVerdict;
}

interface PageView {
  page: string | null;
  referrer: string | null;
}

/** The neutral page each case starts from; its page views are not part of any case. */
function isStartPage(page: string | null): boolean {
  if (!page) return true;
  const url = new URL(page, SITE_ORIGIN);
  return url.pathname === '/' && url.search === '';
}

/**
 * Each case's page views, in the order sent. A tool may send a page view only
 * when its page unloads (Mixpanel does), so a request belongs to the last case
 * opened before it, not only to that case's own phase. Repeats within a case
 * are dropped (a tool may send the same batch twice).
 */
export function pageViewsPerCase(tool: Tool, run: UrlRun): Map<string, PageView[]> {
  const perCase = new Map(run.cases.map((urlCase) => [urlCase.id, [] as PageView[]]));
  const caseOfRequest = new Map<RecordedRequest, string | null>();
  let current: string | null = null;
  for (const request of run.sent) {
    if (request.phase !== null && perCase.has(request.phase)) current = request.phase;
    caseOfRequest.set(request, current);
  }
  const seen = new Set<string>();
  for (const event of eventsOf(tool, run.sent)) {
    const caseId = caseOfRequest.get(event.request) ?? null;
    if (caseId === null || event.kind !== 'pageview') continue;
    const page = event.page ?? null;
    const referrer = event.referrer ?? null;
    const key = JSON.stringify([caseId, page, referrer]);
    if (seen.has(key) || isStartPage(page)) continue;
    seen.add(key);
    perCase.get(caseId)?.push({ page, referrer });
  }
  return perCase;
}

function hasPlaceholder(recorded: string): boolean {
  return recorded.includes(':id') || readable(recorded).includes(':redacted');
}

export function judgeCase(
  urlCase: UrlCase,
  views: readonly PageView[],
  secrets: Readonly<Record<string, string>>,
): UrlCaseResult {
  const where = urlCase.then ? 'referrer' : 'page';
  const recorded =
    where === 'referrer'
      ? views.length >= 2
        ? (views.at(-1)?.referrer ?? null)
        : null
      : (views[0]?.page ?? null);
  const result = (verdict: UrlVerdict): UrlCaseResult => ({ where, recorded, verdict });

  if (recorded === null) return result('no page view sent');
  const text = readable(recorded);
  if (urlCase.secret !== undefined) {
    const secret = secrets[urlCase.secret];
    if (secret !== undefined && text.includes(secret)) return result('leaked');
    if (hasPlaceholder(recorded)) return result('redacted');
    if (where === 'referrer' && (text === '' || text === '$direct')) return result('no referrer');
    return result('dropped');
  }
  if (urlCase.keep !== undefined && text.includes(readable(urlCase.keep))) return result('kept');
  return result(hasPlaceholder(recorded) ? 'rewritten' : 'dropped');
}

export function summarizeUrls(tool: Tool, run: UrlRun): Record<string, UrlCaseResult> {
  const views = pageViewsPerCase(tool, run);
  return Object.fromEntries(
    run.cases.map((urlCase) => [
      urlCase.id,
      judgeCase(urlCase, views.get(urlCase.id) ?? [], run.secrets),
    ]),
  );
}
