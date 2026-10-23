import { readSnippet } from '../tool.ts';
import type { Tool, TrackedEvent } from '../tool.ts';

const SCRIPT = {
  url: 'https://cdn.matomo.cloud/example.matomo.cloud/matomo.js',
  file: 'matomo.js',
  source: { url: 'https://cdn.jsdelivr.net/gh/matomo-org/matomo@5.5.1/matomo.js' },
};

/**
 * Matomo sends everything as GET requests to `matomo.php`: a page view
 * carries `action_name`, a download `download=`, an outbound link `link=`.
 */
function parseEvents(url: URL): TrackedEvent[] {
  if (url.pathname !== '/matomo.php') return [];
  const params = url.searchParams;
  const download = params.get('download');
  if (download) return [{ kind: 'download', name: 'download', element: { href: download } }];
  const link = params.get('link');
  if (link) return [{ kind: 'outbound-link', name: 'link', element: { href: link } }];
  if (!params.has('action_name')) return [{ kind: 'other', name: 'ping' }];
  return [
    { kind: 'pageview', name: 'pageview', page: params.get('url'), referrer: params.get('urlref') },
  ];
}

export const matomo: Tool = {
  id: 'matomo',
  name: 'Matomo',
  snippet: readSnippet(import.meta.dirname),
  scripts: [SCRIPT],
  note: 'matomo.js 5.5.1, the standard tracking code',
  parseEvents: (request) => parseEvents(new URL(request.url)),
};

export const matomoCookieless: Tool = {
  ...matomo,
  id: 'matomo-cookieless',
  name: 'Matomo with disableCookies',
  variantOf: matomo.id,
  snippet: readSnippet(import.meta.dirname, 'snippet-cookieless.html'),
  note: "matomo.js 5.5.1, standard tracking code plus _paq.push(['disableCookies'])",
};
