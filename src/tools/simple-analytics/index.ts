import { readSnippet } from '../tool.ts';
import type { Tool } from '../tool.ts';

/** Simple Analytics sends a page view as an image request, and engagement to `/append`. */
export const simpleAnalytics: Tool = {
  id: 'simpleanalytics',
  name: 'Simple Analytics',
  snippet: readSnippet(import.meta.dirname),
  scripts: [
    {
      url: 'https://scripts.simpleanalyticscdn.com/latest.js',
      file: 'simpleanalytics.js',
      source: { url: 'https://scripts.simpleanalyticscdn.com/latest.js' },
    },
  ],
  parseEvents(request) {
    const url = new URL(request.url);
    if (url.pathname === '/append') return [{ kind: 'engagement', name: 'append' }];
    if (!url.pathname.endsWith('simple.gif')) return [];
    const params = url.searchParams;
    const query = params.get('query') ?? '';
    return [
      {
        kind: 'pageview',
        name: 'pageview',
        page: (params.get('path') ?? '') + (query ? `?${query}` : ''),
        referrer: params.get('referrer'),
      },
    ];
  },
};
