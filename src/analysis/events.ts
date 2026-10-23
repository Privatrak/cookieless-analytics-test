import type { RecordedRequest } from '../recording.ts';
import type { Tool, TrackedEvent } from '../tools/tool.ts';

/** An event together with the request that carried it. */
export interface SentEvent extends TrackedEvent {
  request: RecordedRequest;
}

/**
 * Every event in `requests`, in the order sent. An event whose `dedupeKey` was
 * seen before is a resend and is left out, as the tool's server would.
 */
export function eventsOf(tool: Tool, requests: readonly RecordedRequest[]): SentEvent[] {
  const seen = new Set<string>();
  return requests.flatMap((request) =>
    tool.parseEvents(request).flatMap((event) => {
      if (event.dedupeKey !== undefined) {
        if (seen.has(event.dedupeKey)) return [];
        seen.add(event.dedupeKey);
      }
      return [{ ...event, request }];
    }),
  );
}
