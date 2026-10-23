import type { Browser } from 'playwright';
import { launchBrowser } from '../browser.ts';
import { TestServer } from '../server.ts';
import type { Recording } from '../server.ts';
import { selectTools } from '../tools/index.ts';

/**
 * Runs `test` for each tool named on the command line (all of them by
 * default), each in a fresh browser profile, with one server and one browser
 * for the whole run.
 */
export async function runForEachTool<T>(
  test: (browser: Browser, recording: Recording) => Promise<T>,
  save: (result: T) => void,
): Promise<void> {
  const tools = selectTools(process.argv.slice(2));
  const server = await TestServer.start();
  const browser = await launchBrowser();
  try {
    for (const tool of tools) {
      const result = await test(browser, server.record(tool));
      save(result);
      console.log(`${tool.id}: done`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}
