import { isRecord, jsonBody, readSnippet, stringOrNull } from '../tool.ts';
import type { Tool } from '../tool.ts';

/** Umami posts every event to `/api/send`; a page view is one without a name. */
export const umami: Tool = {
  id: 'umami',
  name: 'Umami',
  snippet: readSnippet(import.meta.dirname),
  scripts: [
    {
      url: 'https://cloud.umami.is/script.js',
      file: 'umami.js',
      source: { url: 'https://cloud.umami.is/script.js' },
    },
  ],
  parseEvents(request) {
    if (new URL(request.url).pathname !== '/api/send') return [];
    const body = jsonBody(request);
    if (!isRecord(body) || !isRecord(body.payload)) return [];
    const { payload } = body;
    const name = stringOrNull(payload.name);
    return [
      {
        kind: name ? 'other' : 'pageview',
        name: name ?? 'pageview',
        page: stringOrNull(payload.url),
        referrer: stringOrNull(payload.referrer),
      },
    ];
  },
};
