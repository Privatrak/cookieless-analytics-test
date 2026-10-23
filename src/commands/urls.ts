/**
 * The URL test, for every tool or the ones named: results/urls/<tool>.json
 *
 *   npm run urls [-- tool ...]
 */
import { writeUrlRun } from '../results.ts';
import { runUrlTest } from '../url-test.ts';
import { runForEachTool } from './run-tools.ts';

await runForEachTool(runUrlTest, writeUrlRun);
