import { isRecord, jsonBody, kindOf, readSnippet, stringOrNull } from '../tool.ts';
import type { EventKind, Tool, TrackedEvent } from '../tool.ts';

/** What `api.privatrak.com/api/config` answers for a new project (2026-10-23). */
const NEW_PROJECT_CONFIG = {
  flush_interval_ms: 5000,
  max_queue_size: 10,
  walk_depth: 3,
  max_text_length: 100,
  autocapture_pageviews: true,
  autocapture: true,
  autocapture_elements: [
    'a',
    'button',
    'input[type=submit]',
    '[role=button]',
    '[role=link]',
    '[role=menuitem]',
    '[role=menuitemcheckbox]',
    '[role=menuitemradio]',
    '[role=option]',
    '[role=tab]',
    '[role=switch]',
    '[role=checkbox]',
    '[role=radio]',
    '[role=combobox]',
  ],
  pii_url_params: [
    'email',
    '*email',
    'e-mail',
    'mail',
    'token',
    '*_token',
    '*-token',
    'access_token',
    'refresh_token',
    'id_token',
    'key',
    'api_key',
    'apikey',
    'api-key',
    'password',
    '*password',
    'pass',
    'pwd',
    'secret',
    '*secret',
    'client_secret',
    'session',
    'sessionid',
    'session_id',
    'auth',
    'code',
  ],
  pii_value_patterns: [
    '[^/@\\s]+(?:@|%40)[^/@\\s.]+(?:\\.[^/@\\s.]+)+',
    'eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+',
    'gh[pousr]_[A-Za-z0-9]{36,}',
    'github_pat_[A-Za-z0-9_]{22,}',
    '(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}',
    'xox[abposr]-[A-Za-z0-9-]{10,}',
    'AIza[0-9A-Za-z_-]{35}',
    '(?:AKIA|ASIA)[0-9A-Z]{16}',
    '(?:stk_[0-9a-f]{64}|pt[ar]_[A-Za-z0-9_-]{43})',
  ],
  excluded_urls: [],
  normalize_path_ids: true,
  capture_dead_clicks: true,
  capture_rage_clicks: true,
  capture_error_clicks: true,
  capture_slow_clicks: true,
  dead_click_window_ms: 1000,
  dead_click_wait_ms: 5000,
  slow_click_threshold_ms: 1000,
  rage_click_threshold: 3,
  rage_click_window_ms: 1000,
};

function respond(url: URL): { contentType: string; body: string } | undefined {
  if (url.host !== 'api.privatrak.com' || url.pathname !== '/api/config') return undefined;
  return { contentType: 'application/json', body: JSON.stringify(NEW_PROJECT_CONFIG) };
}

const KINDS: Record<string, EventKind> = {
  pageview: 'pageview',
  click: 'click',
  dead_click: 'dead-click',
  rage_click: 'rage-click',
  form_submit: 'form-submit',
};

function toEvent(event: Record<string, unknown>): TrackedEvent | undefined {
  const name = stringOrNull(event.event_type);
  if (!name) return undefined;
  const kind = kindOf(name, KINDS);
  if (kind === 'pageview') {
    return {
      kind,
      name,
      page: stringOrNull(event.page_url),
      referrer: stringOrNull(event.referrer),
    };
  }
  return {
    kind,
    name,
    element: { tag: stringOrNull(event.element_tag), text: stringOrNull(event.element_text) },
  };
}

/** Privatrak posts batches of events to `/api/events`. */
export const privatrak: Tool = {
  id: 'privatrak',
  name: 'Privatrak',
  snippet: readSnippet(import.meta.dirname),
  scripts: [
    {
      url: 'https://api.privatrak.com/tracker.js',
      file: 'privatrak.js',
      source: { url: 'https://api.privatrak.com/tracker.js' },
    },
  ],
  respond,
  parseEvents(request) {
    if (new URL(request.url).pathname !== '/api/events') return [];
    const body = jsonBody(request);
    if (!isRecord(body) || !Array.isArray(body.events)) return [];
    return body.events.filter(isRecord).flatMap((event) => toEvent(event) ?? []);
  },
};
