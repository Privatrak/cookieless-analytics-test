/**
 * Checks each tool's script and the addresses it sent to (from
 * results/<tool>.json) against the filter lists, with Ghostery's matching
 * engine: results/blocking.json
 *
 *   npm run blockcheck
 */
import type { RequestType } from '@ghostery/adblocker';
import { loadBlockers, verdictFor } from '../blocklists.ts';
import { BLOCKING_FILE, readVisitRun, writeJson } from '../results.ts';
import { TOOLS } from '../tools/index.ts';
import type { Tool } from '../tools/tool.ts';

interface Check {
  what: 'script' | 'send';
  url: string;
  type: RequestType;
}

/** The script, and every distinct address (origin and path) the tool sent to. */
function checksFor(tool: Tool): Check[] {
  const scriptUrl = tool.blockcheckScriptUrl ?? tool.scripts[0]?.url;
  const checks: Check[] = scriptUrl ? [{ what: 'script', url: scriptUrl, type: 'script' }] : [];
  const seen = new Set<string>();
  for (const request of readVisitRun(tool.id).sent) {
    const url = new URL(request.url);
    const address = url.origin + url.pathname;
    if (seen.has(address)) continue;
    seen.add(address);
    const isBeacon = request.method === 'GET' && /gif|\?h=/.test(request.url);
    checks.push({ what: 'send', url: request.url, type: isBeacon ? 'image' : 'xmlhttprequest' });
  }
  return checks;
}

const blockers = loadBlockers();
// A cookieless setting changes nothing about the addresses, so only standard setups are checked.
const results = Object.fromEntries(
  TOOLS.filter((tool) => tool.variantOf === undefined).map((tool) => [
    tool.id,
    checksFor(tool).map((check) => ({
      ...check,
      url: check.url.slice(0, 160),
      verdicts: Object.fromEntries(
        [...blockers].map(([setup, engine]) => [setup, verdictFor(engine, check.url, check.type)]),
      ),
    })),
  ]),
);
writeJson(BLOCKING_FILE, results);

for (const [tool, checks] of Object.entries(results)) {
  console.log(`\n${tool}`);
  for (const check of checks) {
    console.log(`  ${check.what} ${check.url.slice(0, 70)}`);
    for (const [setup, verdict] of Object.entries(check.verdicts)) {
      console.log(`    ${setup.slice(0, 30).padEnd(30)} ${verdict}`);
    }
  }
}
