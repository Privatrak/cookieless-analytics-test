/**
 * The visit, for every tool or the ones named: results/<tool>.json
 *
 *   npm run visit [-- tool ...]
 */
import { writeVisitRun } from '../results.ts';
import { runVisit } from '../visit.ts';
import { runForEachTool } from './run-tools.ts';

await runForEachTool(runVisit, writeVisitRun);
