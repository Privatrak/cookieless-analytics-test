import { isRecord, kindOf, readSnippet, stringOrNull } from '../tool.ts';
import type { EventKind, Tool, TrackedEvent } from '../tool.ts';
import type { RecordedRequest } from '../../recording.ts';

const SCRIPTS = [
  {
    url: 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js',
    file: 'mixpanel.js',
    source: { url: 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js' },
  },
  {
    // The session recorder mixpanel-js 2.84.0 loads, named after that build.
    url: 'https://cdn.mxpnl.com/libs/mixpanel-recorder-CcIR1Do8.min.js',
    file: 'mixpanel-recorder.js',
    source: { url: 'https://cdn.mxpnl.com/libs/mixpanel-recorder-CcIR1Do8.min.js' },
  },
];

/**
 * Mixpanel asks for `verbose=1` and keeps, and later resends, every batch
 * not answered with `status: 1`, as its API answers an accepted one.
 */
function respond(url: URL): { contentType: string; body: string } | undefined {
  if (!url.host.endsWith('mixpanel.com')) return undefined;
  return { contentType: 'application/json', body: JSON.stringify({ status: 1, error: null }) };
}

const KINDS: Record<string, EventKind> = {
  $mp_web_page_view: 'pageview',
  $mp_page_leave: 'engagement',
  $mp_click: 'click',
  $mp_rage_click: 'rage-click',
  $mp_dead_click: 'dead-click',
};

function toEvent(event: Record<string, unknown>): TrackedEvent | undefined {
  const name = stringOrNull(event.event);
  if (!name) return undefined;
  const properties = isRecord(event.properties) ? event.properties : {};
  const kind = kindOf(name, KINDS);
  const tracked: TrackedEvent = { kind, name };
  const insertId = stringOrNull(properties.$insert_id);
  if (insertId) tracked.dedupeKey = insertId;
  if (kind === 'pageview') {
    tracked.page = stringOrNull(properties.$current_url);
    tracked.referrer = stringOrNull(properties.$referrer);
  }
  if (kind === 'click' || kind === 'rage-click' || kind === 'dead-click') {
    tracked.element = {
      id: stringOrNull(properties.$el_id),
      tag: stringOrNull(properties.$el_tag_name),
      href: stringOrNull(properties.$el_attr__href),
    };
  }
  return tracked;
}

/** Mixpanel posts form data, `data=<JSON array of events>`, and session recordings to `/record/`. */
function parseEvents(request: RecordedRequest): TrackedEvent[] {
  const url = new URL(request.url);
  if (url.host !== 'api-js.mixpanel.com') return [];
  if (url.pathname === '/record/') return [{ kind: 'session-recording', name: 'record' }];
  const body = request.body ?? '';
  if (url.pathname !== '/track/' || !body.startsWith('data=')) return [];
  const events = JSON.parse(decodeURIComponent(body.slice('data='.length))) as unknown;
  if (!Array.isArray(events)) return [];
  return events.filter(isRecord).flatMap((event) => toEvent(event) ?? []);
}

export const mixpanel: Tool = {
  id: 'mixpanel',
  name: 'Mixpanel',
  snippet: readSnippet(import.meta.dirname),
  scripts: SCRIPTS,
  note: 'mixpanel-js 2.84.0 as served on 2026-10-23, loader and init options from the JavaScript quickstart (docs.mixpanel.com/docs/quickstart/install-mixpanel)',
  respond,
  parseEvents,
};

export const mixpanelCookieless: Tool = {
  ...mixpanel,
  id: 'mixpanel-cookieless',
  name: 'Mixpanel with disable_persistence: true',
  variantOf: mixpanel.id,
  snippet: readSnippet(import.meta.dirname, 'snippet-cookieless.html'),
  note: 'mixpanel-js as above, init with disable_persistence: true',
};
