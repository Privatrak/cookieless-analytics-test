import { isRecord, jsonBody, kindOf, readSnippet, stringOrNull } from '../tool.ts';
import type { EventKind, Tool, TrackedEvent } from '../tool.ts';
import type { ElementHint } from '../../test-site.ts';

const TOKEN = 'phc_TESTTESTTESTTESTTESTTESTTESTTESTTESTTESTTEST';

/**
 * The remote config PostHog's server sends a new project, as
 * `posthog/models/remote_config.py` builds it from a new team's defaults in
 * `posthog/models/team/team.py` (read on 2026-10-23): autocapture on
 * (`autocapture_opt_out` is null), heatmaps off (`heatmaps_opt_in` is null),
 * dead-click capture off (`capture_dead_clicks` defaults to False), network
 * timing on (`capture_performance_opt_in` defaults to True), no session
 * recording.
 */
const NEW_PROJECT_CONFIG = {
  token: TOKEN,
  supportedCompression: ['gzip', 'gzip-js'],
  hasFeatureFlags: false,
  captureDeadClicks: false,
  capturePerformance: { network_timing: true, web_vitals: false, web_vitals_allowed_metrics: null },
  autocapture_opt_out: false,
  autocaptureExceptions: false,
  elementsChainAsString: true,
  sessionRecording: false,
  heatmaps: false,
  surveys: false,
  productTours: false,
  defaultIdentifiedOnly: true,
  siteApps: [],
};

function respond(url: URL): { contentType: string; body: string } | undefined {
  if (!url.host.endsWith('posthog.com')) return undefined;
  const config = JSON.stringify(NEW_PROJECT_CONFIG);
  if (/\/array\/[^/]+\/config\.js$/.test(url.pathname)) {
    return {
      contentType: 'application/javascript',
      body: `(function(){window._POSTHOG_REMOTE_CONFIG=window._POSTHOG_REMOTE_CONFIG||{};window._POSTHOG_REMOTE_CONFIG[${JSON.stringify(TOKEN)}]={config:${config},siteApps:[]}})();`,
    };
  }
  if (/\/array\/[^/]+\/config$/.test(url.pathname)) {
    return { contentType: 'application/json', body: config };
  }
  if (url.pathname.startsWith('/flags')) {
    return {
      contentType: 'application/json',
      body: JSON.stringify({ flags: {}, errorsWhileComputingFlags: false, ...NEW_PROJECT_CONFIG }),
    };
  }
  return undefined;
}

/**
 * The clicked element, from the first entry of `$elements_chain`, e.g.
 * `button.btn:attr__id="dead"text="Download report";p:...`.
 */
export function elementFromChain(chain: string): ElementHint {
  const first = chain.split(';', 1)[0] ?? '';
  const attribute = (name: string): string | null =>
    new RegExp(`(?:^|[:"])${name}="([^"]*)"`).exec(first)?.[1] ?? null;
  return {
    tag: /^[a-z0-9-]+/i.exec(first)?.[0] ?? null,
    id: attribute('attr__id'),
    href: attribute('href'),
    text: attribute('text'),
  };
}

const KINDS: Record<string, EventKind> = {
  $pageview: 'pageview',
  $pageleave: 'engagement',
  $rageclick: 'rage-click',
  $dead_click: 'dead-click',
};

function toEvent(event: Record<string, unknown>): TrackedEvent | undefined {
  const name = stringOrNull(event.event);
  if (!name) return undefined;
  const properties = isRecord(event.properties) ? event.properties : {};
  const element = elementFromChain(stringOrNull(properties.$elements_chain) ?? '');
  if (name === '$autocapture') {
    const kind = properties.$event_type === 'submit' ? 'form-submit' : 'click';
    return { kind, name, element };
  }
  const kind = kindOf(name, KINDS);
  if (kind === 'pageview') {
    return {
      kind,
      name,
      page: stringOrNull(properties.$current_url),
      referrer: stringOrNull(properties.$referrer),
    };
  }
  return kind === 'rage-click' || kind === 'dead-click' ? { kind, name, element } : { kind, name };
}

/** PostHog posts batches of events, as a list or as `{ batch: [...] }`. */
function parseEvents(body: unknown): TrackedEvent[] {
  const batch = Array.isArray(body) ? body : isRecord(body) ? body.batch : undefined;
  if (!Array.isArray(batch)) return [];
  return batch.filter(isRecord).flatMap((event) => toEvent(event) ?? []);
}

export const posthog: Tool = {
  id: 'posthog',
  name: 'PostHog',
  snippet: readSnippet(import.meta.dirname),
  scripts: [
    {
      url: 'https://us-assets.i.posthog.com/static/array.js',
      file: 'posthog.js',
      source: { url: 'https://us-assets.i.posthog.com/static/array.js' },
    },
  ],
  note: 'posthog-js array.js as served on 2026-10-23, official HTML snippet; remote config answered as a new project gets it',
  respond,
  parseEvents: (request) => parseEvents(jsonBody(request)),
};

export const posthogCookieless: Tool = {
  ...posthog,
  id: 'posthog-cookieless',
  name: "PostHog with cookieless_mode: 'always'",
  variantOf: posthog.id,
  snippet: readSnippet(import.meta.dirname, 'snippet-cookieless.html'),
  note: "posthog-js as above, init with cookieless_mode: 'always'",
};
