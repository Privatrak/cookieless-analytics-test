import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RecordedRequest } from '../recording.ts';
import type { ElementHint } from '../test-site.ts';

/** What kind of thing a tool recorded, whatever it calls it. */
export type EventKind =
  | 'pageview'
  | 'click'
  | 'dead-click'
  | 'rage-click'
  | 'form-submit'
  | 'download'
  | 'outbound-link'
  | 'engagement'
  | 'session-recording'
  | 'other';

/** One event a tool sent, read from its request. */
export interface TrackedEvent {
  kind: EventKind;
  /** The tool's own name for the event, as sent. */
  name: string;
  /** For events about an element: what the tool said about it. */
  element?: ElementHint;
  /** For page views: the page address and referrer exactly as sent. */
  page?: string | null;
  referrer?: string | null;
  /**
   * Set when the tool resends events and its server drops repeats by an id
   * (Mixpanel's `$insert_id`); events with the same key are counted once.
   */
  dedupeKey?: string;
}

/** Where `npm run setup` gets a script from. */
export type ScriptSource = { url: string } | { npmFile: string };

/** A script the snippet loads, served by the local server from `scripts/`. */
export interface ToolScript {
  /** The address the snippet requests. */
  url: string;
  /** The file name in `scripts/`. */
  file: string;
  source: ScriptSource;
}

/** A canned answer to one of the tool's requests, as its server would give it. */
export interface StubResponse {
  contentType: string;
  body: string;
}

export interface Tool {
  /** Used in file names and on the command line. */
  id: string;
  /** Display name. */
  name: string;
  /** For a tool's cookieless setting: the id of the tool's standard setup. */
  variantOf?: string;
  /** The install snippet, put in the head of every page. */
  snippet: string;
  scripts: ToolScript[];
  /** Anything about how this tool was set up that the results should carry. */
  note?: string;
  /**
   * The script address ad blockers are checked against, when the test serves
   * the script from somewhere else than a real installation would.
   */
  blockcheckScriptUrl?: string;
  /** Answers the tool's server requests that need more than an empty success. */
  respond?: (url: URL) => StubResponse | undefined;
  /** The events in one of the tool's requests. */
  parseEvents: (request: RecordedRequest) => TrackedEvent[];
}

/** A tool's snippet file, next to its definition. */
export function readSnippet(toolDir: string, file = 'snippet.html'): string {
  return readFileSync(path.join(toolDir, file), 'utf8').trim();
}

/** `request.body` parsed as JSON, or `undefined` when it isn't JSON. */
export function jsonBody(request: RecordedRequest): unknown {
  if (!request.body) return undefined;
  try {
    return JSON.parse(request.body) as unknown;
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value` if it is a string, otherwise `null`. */
export function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** The kind a tool's own event name stands for; unknown names are `other`. */
export function kindOf(name: string, kinds: Record<string, EventKind>): EventKind {
  return kinds[name] ?? 'other';
}
