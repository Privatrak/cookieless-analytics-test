import { TEST_EMAIL, identifyElement } from '../test-site.ts';
import type { Tool, EventKind } from '../tools/tool.ts';
import type { RecordedRequest, VisitRun } from '../recording.ts';
import { stepForElement } from '../visit.ts';
import { eventsOf } from './events.ts';
import type { SentEvent } from './events.ts';
import { readable } from './text.ts';

/** What happened to the email address the visit's last page carried in its URL. */
export type EmailHandling = 'leaked' | 'redacted' | 'dropped';

export interface VisitSummary {
  scriptGzip: number;
  /** Scripts the tool loaded itself after its own (Mixpanel's session recorder). */
  extraScriptsGzip: number;
  cookies: { name: string; expires: string }[];
  localStorage: string[];
  sessionStorage: string[];
  indexedDB: string[];
  requests: number;
  bytesSent: number;
  pageViews: number;
  sessionRecording: boolean;
  /** Per visit step, what the tool recorded about it beyond page views. */
  recorded: Record<string, EventKind[]>;
  emailInUrl: EmailHandling;
}

/** Events that say something about an interaction, as opposed to the page or the session. */
const INTERACTIONS = new Set<EventKind>([
  'click',
  'dead-click',
  'rage-click',
  'form-submit',
  'download',
  'outbound-link',
]);

/**
 * The step an event is about. An event about an element belongs to the step
 * that interacted with that element, not to the step in which it was sent:
 * a dead click is only known once the click has had no effect for a while,
 * so it can arrive during the next step.
 */
function stepOf(event: SentEvent): string | null {
  const element = event.element ? identifyElement(event.element) : null;
  return (element && stepForElement(element.id)) ?? event.request.phase;
}

function recordedPerStep(events: readonly SentEvent[]): Record<string, EventKind[]> {
  const perStep = new Map<string, Set<EventKind>>();
  for (const event of events) {
    if (!INTERACTIONS.has(event.kind)) continue;
    const step = stepOf(event) ?? 'unknown';
    const kinds = perStep.get(step) ?? new Set<EventKind>();
    kinds.add(event.kind);
    perStep.set(step, kinds);
  }
  return Object.fromEntries([...perStep].map(([step, kinds]) => [step, [...kinds].sort()]));
}

/** Whether the address reached the tool as it was, with a placeholder, or not at all. */
export function emailHandling(requests: readonly RecordedRequest[]): EmailHandling {
  const texts = requests.map((request) => readable(`${request.url} ${request.body ?? ''}`));
  if (texts.some((text) => text.includes(TEST_EMAIL))) return 'leaked';
  if (texts.some((text) => text.includes(':redacted'))) return 'redacted';
  return 'dropped';
}

export function summarizeVisit(tool: Tool, run: VisitRun): VisitSummary {
  const [ownScript, ...extraScripts] = run.scripts;
  const extraScriptSizes = new Map(
    extraScripts
      .filter((script) => script.url !== ownScript?.url)
      .map((script) => [script.url, script.gzip]),
  );
  const events = eventsOf(tool, run.sent);
  return {
    scriptGzip: ownScript?.gzip ?? 0,
    extraScriptsGzip: [...extraScriptSizes.values()].reduce((sum, size) => sum + size, 0),
    cookies: run.afterVisit.cookies.map(({ name, expires }) => ({ name, expires })),
    localStorage: run.afterVisit.localStorage.map(({ key }) => key),
    sessionStorage: run.afterVisit.sessionStorage.map(({ key }) => key),
    indexedDB: run.afterVisit.indexedDB,
    requests: run.sent.length,
    bytesSent: run.sent.reduce((sum, request) => sum + request.bodyBytes + request.urlBytes, 0),
    pageViews: events.filter((event) => event.kind === 'pageview').length,
    sessionRecording: events.some((event) => event.kind === 'session-recording'),
    recorded: recordedPerStep(events),
    emailInUrl: emailHandling(run.sent),
  };
}
