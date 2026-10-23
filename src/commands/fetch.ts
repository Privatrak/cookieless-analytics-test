/**
 * Downloads each tool's script into `scripts/` and the filter lists into
 * `blocklists/`. The scripts are not in this repository because they belong
 * to their vendors, and they change: a later run may differ from `results/`.
 *
 *   npm run setup   (or: node src/commands/fetch.ts)
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { FILTER_LISTS, filterListFile } from '../blocklists.ts';
import { BLOCKLISTS_DIR, SCRIPTS_DIR } from '../config.ts';
import { TOOLS } from '../tools/index.ts';
import type { ScriptSource } from '../tools/tool.ts';

const require = createRequire(import.meta.url);

async function download(url: string, file: string): Promise<void> {
  const response = await fetch(url, { headers: { 'accept-encoding': 'identity' } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  writeFileSync(file, Buffer.from(await response.arrayBuffer()));
}

async function fetchScript(source: ScriptSource, file: string): Promise<void> {
  if ('npmFile' in source) copyFileSync(require.resolve(source.npmFile), file);
  else await download(source.url, file);
}

mkdirSync(SCRIPTS_DIR, { recursive: true });
const scripts = new Map(
  TOOLS.flatMap((tool) => tool.scripts).map((script) => [script.file, script.source]),
);
for (const [file, source] of scripts) {
  await fetchScript(source, path.join(SCRIPTS_DIR, file));
  console.log(`scripts/${file}`);
}

mkdirSync(BLOCKLISTS_DIR, { recursive: true });
for (const [name, url] of Object.entries(FILTER_LISTS)) {
  await download(url, filterListFile(name));
  console.log(`blocklists/${name}.txt`);
}
