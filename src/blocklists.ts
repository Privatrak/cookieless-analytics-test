import { readFileSync } from 'node:fs';
import path from 'node:path';
import { FiltersEngine, Request } from '@ghostery/adblocker';
import type { RequestType } from '@ghostery/adblocker';
import { BLOCKLISTS_DIR, SITE_ORIGIN } from './config.ts';

/** The filter lists, downloaded by `npm run setup` into `blocklists/<name>.txt`. */
export const FILTER_LISTS = {
  easylist: 'https://easylist.to/easylist/easylist.txt',
  easyprivacy: 'https://easylist.to/easylist/easyprivacy.txt',
  'ubo-filters': 'https://ublockorigin.github.io/uAssets/filters/filters.txt',
  'ubo-privacy': 'https://ublockorigin.github.io/uAssets/filters/privacy.txt',
  'ubo-unbreak': 'https://ublockorigin.github.io/uAssets/filters/unbreak.txt',
  'ubo-quick-fixes': 'https://ublockorigin.github.io/uAssets/filters/quick-fixes.txt',
  'ubo-badware': 'https://ublockorigin.github.io/uAssets/filters/badware.txt',
  'peter-lowe':
    'https://pgl.yoyo.org/adservers/serverlist.php?hostformat=adblockplus&showintro=1&mimetype=plaintext',
  'adguard-base': 'https://filters.adtidy.org/extension/ublock/filters/2_without_easylist.txt',
  'adguard-tracking': 'https://filters.adtidy.org/extension/ublock/filters/3.txt',
} as const;

type FilterList = keyof typeof FILTER_LISTS;

/** The combinations of lists that common ad blockers turn on by default. */
export const BLOCKER_SETUPS: Record<string, readonly FilterList[]> = {
  'uBlock Origin (default lists)': [
    'ubo-filters',
    'ubo-privacy',
    'ubo-unbreak',
    'ubo-quick-fixes',
    'ubo-badware',
    'easylist',
    'easyprivacy',
    'peter-lowe',
  ],
  'EasyList + EasyPrivacy (Brave, Adblock Plus with privacy list)': ['easylist', 'easyprivacy'],
  'AdGuard (Base + Tracking Protection)': ['adguard-base', 'adguard-tracking'],
};

export const filterListFile = (name: string): string => path.join(BLOCKLISTS_DIR, `${name}.txt`);

/** One matching engine per blocker setup, built from the downloaded lists. */
export function loadBlockers(): Map<string, FiltersEngine> {
  return new Map(
    Object.entries(BLOCKER_SETUPS).map(([setup, lists]) => {
      const rules = lists.map((list) => readFileSync(filterListFile(list), 'utf8')).join('\n');
      return [setup, FiltersEngine.parse(rules, { loadCosmeticFilters: false, debug: true })];
    }),
  );
}

/** What a blocker does with a request from the test page: the rule that blocks or allows it. */
export function verdictFor(engine: FiltersEngine, url: string, type: RequestType): string {
  const match = engine.match(Request.fromRawDetails({ url, sourceUrl: `${SITE_ORIGIN}/`, type }));
  if (match.match) return `blocked by ${match.filter?.toString() ?? 'an unnamed rule'}`;
  if (match.exception) return `allowed by ${match.exception.toString()}`;
  return 'not blocked';
}
