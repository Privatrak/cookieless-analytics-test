import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULTS_DIR, URL_RESULTS_DIR } from './config.ts';
import type { UrlRun, VisitRun } from './recording.ts';

export function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export const visitResultFile = (toolId: string): string => path.join(RESULTS_DIR, `${toolId}.json`);
export const urlResultFile = (toolId: string): string =>
  path.join(URL_RESULTS_DIR, `${toolId}.json`);

export const VISIT_SUMMARY_FILE = path.join(RESULTS_DIR, 'summary.json');
export const URL_SUMMARY_FILE = path.join(URL_RESULTS_DIR, 'summary.json');
export const BLOCKING_FILE = path.join(RESULTS_DIR, 'blocking.json');

export const writeVisitRun = (run: VisitRun): void => {
  writeJson(visitResultFile(run.tool), run);
};
export const readVisitRun = (toolId: string): VisitRun =>
  readJson(visitResultFile(toolId)) as VisitRun;
export const writeUrlRun = (run: UrlRun): void => {
  writeJson(urlResultFile(run.tool), run);
};
export const readUrlRun = (toolId: string): UrlRun => readJson(urlResultFile(toolId)) as UrlRun;
