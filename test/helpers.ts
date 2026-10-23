import type { RecordedRequest } from '../src/recording.ts';

/** A recorded request with only the fields a test cares about set. */
export function request(
  url: string,
  body: unknown = null,
  phase: string | null = null,
): RecordedRequest {
  const text = body === null || typeof body === 'string' ? body : JSON.stringify(body);
  return {
    phase,
    method: text ? 'POST' : 'GET',
    url,
    bodyBytes: text?.length ?? 0,
    urlBytes: url.length,
    contentType: null,
    cookieHeader: null,
    body: text,
  };
}

/** Mixpanel's form-encoded batch. */
export function mixpanelBody(events: unknown[]): string {
  return `data=${encodeURIComponent(JSON.stringify(events))}`;
}
