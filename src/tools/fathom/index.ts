import { readSnippet } from '../tool.ts';
import type { Tool } from '../tool.ts';

/** Fathom sends a page view, and later an engagement ping (`dp=1`), as GET requests. */
export const fathom: Tool = {
  id: 'fathom',
  name: 'Fathom',
  snippet: readSnippet(import.meta.dirname),
  scripts: [
    {
      url: 'https://cdn.usefathom.com/script.js',
      file: 'fathom.js',
      source: { url: 'https://cdn.usefathom.com/script.js' },
    },
  ],
  parseEvents(request) {
    const url = new URL(request.url);
    if (url.host !== 'cdn.usefathom.com') return [];
    const params = url.searchParams;
    if (params.get('dp') === '1') return [{ kind: 'engagement', name: 'engagement' }];
    // The query parameters Fathom kept travel as a JSON object in `qs`.
    const kept = JSON.parse(params.get('qs') ?? '{}') as Record<string, string>;
    const query = Object.entries(kept)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    return [
      {
        kind: 'pageview',
        name: 'pageview',
        page: (params.get('p') ?? '') + (query ? `?${query}` : ''),
        referrer: params.get('r'),
      },
    ];
  },
};
