import { isRecord, jsonBody, readSnippet, stringOrNull } from '../tool.ts';
import type { Tool } from '../tool.ts';

/** Pirsch sends page views to `/hit` and its automatic events to `/event`. */
export const pirsch: Tool = {
  id: 'pirsch',
  name: 'Pirsch',
  snippet: readSnippet(import.meta.dirname),
  scripts: [
    {
      url: 'https://api.pirsch.io/pa.js',
      file: 'pirsch.js',
      source: { url: 'https://api.pirsch.io/pa.js' },
    },
  ],
  parseEvents(request) {
    const url = new URL(request.url);
    if (url.pathname === '/hit') {
      return [
        {
          kind: 'pageview',
          name: 'pageview',
          page: url.searchParams.get('url'),
          referrer: url.searchParams.get('ref'),
        },
      ];
    }
    if (url.pathname !== '/event') return [];
    const body = jsonBody(request);
    if (!isRecord(body) || typeof body.event_name !== 'string') return [];
    const meta = isRecord(body.event_meta) ? body.event_meta : {};
    switch (body.event_name) {
      case 'File Download':
        return [
          { kind: 'download', name: body.event_name, element: { href: stringOrNull(meta.file) } },
        ];
      case 'Outbound Link Click':
        return [
          {
            kind: 'outbound-link',
            name: body.event_name,
            element: { href: stringOrNull(meta.url) },
          },
        ];
      default:
        return [{ kind: 'other', name: body.event_name }];
    }
  },
};
