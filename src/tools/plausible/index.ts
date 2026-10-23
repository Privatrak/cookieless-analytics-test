import { SITE_ORIGIN } from '../../config.ts';
import { isRecord, jsonBody, kindOf, readSnippet, stringOrNull } from '../tool.ts';
import type { Tool } from '../tool.ts';

/**
 * Plausible builds a script per site (`pa-<id>.js`) with that site's settings.
 * The test loads the same tracker from its official npm package, with its
 * documented defaults: outbound links, file downloads and form submissions off.
 */
export const plausible: Tool = {
  id: 'plausible',
  name: 'Plausible',
  snippet: readSnippet(import.meta.dirname),
  scripts: [
    {
      url: `${SITE_ORIGIN}/vendor/plausible.js`,
      file: 'plausible.js',
      source: { npmFile: '@plausible-analytics/tracker/plausible.js' },
    },
  ],
  note: '@plausible-analytics/tracker 0.4.6 with its documented defaults (the code behind the pa-*.js site script)',
  blockcheckScriptUrl: 'https://plausible.io/js/pa-AbCdEfGhIjKl.js',
  parseEvents(request) {
    if (new URL(request.url).pathname !== '/api/event') return [];
    const body = jsonBody(request);
    if (!isRecord(body) || typeof body.n !== 'string') return [];
    return [
      {
        kind: kindOf(body.n, { pageview: 'pageview', engagement: 'engagement' }),
        name: body.n,
        page: stringOrNull(body.u),
        referrer: stringOrNull(body.r),
      },
    ];
  },
};
