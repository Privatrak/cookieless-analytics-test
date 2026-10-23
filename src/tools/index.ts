import { fathom } from './fathom/index.ts';
import { matomo, matomoCookieless } from './matomo/index.ts';
import { mixpanel, mixpanelCookieless } from './mixpanel/index.ts';
import { pirsch } from './pirsch/index.ts';
import { plausible } from './plausible/index.ts';
import { posthog, posthogCookieless } from './posthog/index.ts';
import { privatrak } from './privatrak/index.ts';
import { simpleAnalytics } from './simple-analytics/index.ts';
import type { Tool } from './tool.ts';
import { umami } from './umami/index.ts';

/** Every setup the test runs, in the order the results list them. */
export const TOOLS: readonly Tool[] = [
  plausible,
  fathom,
  simpleAnalytics,
  umami,
  pirsch,
  matomo,
  matomoCookieless,
  posthog,
  posthogCookieless,
  mixpanel,
  mixpanelCookieless,
  privatrak,
];

/** The tools named on the command line, or all of them; an unknown name is an error. */
export function selectTools(ids: readonly string[]): Tool[] {
  const unknown = ids.filter((id) => !TOOLS.some((tool) => tool.id === id));
  if (unknown.length > 0) {
    const known = TOOLS.map((tool) => tool.id).join(', ');
    throw new Error(`Unknown tool: ${unknown.join(', ')}. Known tools: ${known}`);
  }
  return ids.length === 0 ? [...TOOLS] : TOOLS.filter((tool) => ids.includes(tool.id));
}
