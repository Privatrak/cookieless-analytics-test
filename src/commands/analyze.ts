/**
 * Summarises the recorded runs into results/summary.json and
 * results/urls/summary.json, and prints them as Markdown tables.
 *
 *   npm run analyze
 */
import { existsSync } from 'node:fs';
import { markdownTable } from '../analysis/markdown.ts';
import { summarizeUrls } from '../analysis/urls.ts';
import type { UrlCaseResult } from '../analysis/urls.ts';
import { summarizeVisit } from '../analysis/visit.ts';
import type { VisitSummary } from '../analysis/visit.ts';
import {
  URL_SUMMARY_FILE,
  VISIT_SUMMARY_FILE,
  readUrlRun,
  readVisitRun,
  urlResultFile,
  visitResultFile,
  writeJson,
} from '../results.ts';
import { TOOLS } from '../tools/index.ts';
import { URL_CASES } from '../url-test.ts';
import { VISIT_STEPS } from '../visit.ts';

const kilobytes = (bytes: number): string => `${(bytes / 1024).toFixed(1)} KB`;

function printVisitSummaries(summaries: Record<string, VisitSummary>): void {
  const entries = Object.entries(summaries);
  console.log(
    markdownTable(
      [
        'Tool',
        'Script (gzip)',
        'Cookies',
        'localStorage',
        'sessionStorage',
        'IndexedDB',
        'Requests',
        'Email in URL',
      ],
      entries.map(([tool, s]) => [
        tool,
        kilobytes(s.scriptGzip) + (s.extraScriptsGzip ? ` + ${kilobytes(s.extraScriptsGzip)}` : ''),
        s.cookies.map((cookie) => `${cookie.name} (${cookie.expires.slice(0, 10)})`).join(', ') ||
          'none',
        s.localStorage.join(', ') || 'none',
        s.sessionStorage.join(', ') || 'none',
        s.indexedDB.join(', ') || 'none',
        String(s.requests),
        s.emailInUrl,
      ]),
    ),
  );
  console.log();
  const steps = VISIT_STEPS.map((step) => step.id).filter((id) =>
    entries.some(([, s]) => s.recorded[id] !== undefined),
  );
  console.log(
    markdownTable(
      ['Tool', ...steps],
      entries.map(([tool, s]) => [
        tool,
        ...steps.map((step) => s.recorded[step]?.join(', ') ?? '–'),
      ]),
    ),
  );
}

function printUrlSummaries(summaries: Record<string, Record<string, UrlCaseResult>>): void {
  const tools = Object.keys(summaries);
  const groups = [
    { title: 'Personal data and secrets', cases: URL_CASES.filter((c) => c.secret !== undefined) },
    { title: 'Data worth keeping', cases: URL_CASES.filter((c) => c.secret === undefined) },
  ];
  for (const { title, cases } of groups) {
    console.log(`\n### ${title}\n`);
    console.log(
      markdownTable(
        ['Case', ...tools],
        cases.map((c) => [c.id, ...tools.map((tool) => summaries[tool]?.[c.id]?.verdict ?? '–')]),
      ),
    );
  }
}

const visitSummaries = Object.fromEntries(
  TOOLS.filter((tool) => existsSync(visitResultFile(tool.id))).map((tool) => [
    tool.id,
    summarizeVisit(tool, readVisitRun(tool.id)),
  ]),
);
writeJson(VISIT_SUMMARY_FILE, visitSummaries);
printVisitSummaries(visitSummaries);

const urlSummaries = Object.fromEntries(
  TOOLS.filter((tool) => existsSync(urlResultFile(tool.id))).map((tool) => [
    tool.id,
    summarizeUrls(tool, readUrlRun(tool.id)),
  ]),
);
writeJson(URL_SUMMARY_FILE, urlSummaries);
printUrlSummaries(urlSummaries);
