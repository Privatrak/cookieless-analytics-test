import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  CERT_FILE,
  KEY_FILE,
  PARTNER_URL,
  SCRIPTS_DIR,
  SERVER_PORT,
  SITE_HOST,
  isChromeServiceHost,
} from './config.ts';
import type { LoadedScript, RecordedRequest } from './recording.ts';
import { PARTNER_PAGE, sitePage } from './test-site.ts';
import type { Tool } from './tools/tool.ts';

/** Bodies are cut at this length to keep the result files small. */
const MAX_BODY_CHARS = 20_000;

/** An answer; the test site's pages have the same shape. */
interface Reply {
  status: number;
  contentType: string;
  body: string | Buffer;
  headers?: Record<string, string>;
}

const NO_CONTENT: Reply = { status: 204, contentType: 'text/plain', body: '' };

const PARTNER_HOST = new URL(PARTNER_URL).hostname;

/** A 1×1 GIF, what image beacons expect back. */
const PIXEL_GIF = Buffer.from('R0lGODlhAQABAAAAACw=', 'base64');

/** What one tool's run sent and loaded. `phase` is set by the run as it goes. */
export class Recording {
  phase: string | null = null;
  readonly requests: RecordedRequest[] = [];
  readonly scripts: LoadedScript[] = [];
  readonly tool: Tool;
  readonly scriptFiles: ReadonlyMap<string, Buffer>;

  constructor(tool: Tool) {
    this.tool = tool;
    this.scriptFiles = new Map(
      tool.scripts.map((script) => [script.url, readFileSync(path.join(SCRIPTS_DIR, script.file))]),
    );
  }
}

/**
 * The body as text: gunzipped, or base64-decoded where the URL says so. A body
 * that can't be decoded is recorded as a marker, with a warning, rather than
 * failing the request the tool is waiting for.
 */
export function decodeBody(body: Buffer, url: string): string | null {
  if (body.length === 0) return null;
  try {
    if (body[0] === 0x1f && body[1] === 0x8b) return gunzipSync(body).toString('utf8');
    const text = body.toString('utf8');
    const base64 = url.includes('compression=base64') ? /^data=(.+)$/.exec(text)?.[1] : undefined;
    return base64 ? Buffer.from(decodeURIComponent(base64), 'base64').toString('utf8') : text;
  } catch (error) {
    console.warn(`Could not decode the body of ${url}:`, error);
    return '(undecodable body)';
  }
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

function corsHeaders(request: IncomingMessage): Record<string, string> {
  return {
    'access-control-allow-origin': request.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': request.headers['access-control-request-headers'] ?? '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };
}

/**
 * Stands in for the test site, the partner site and every tool's servers.
 * Chrome resolves every hostname to it, so nothing reaches a vendor. Requests
 * to a tool's servers are recorded and answered as those servers would:
 * with the tool's own stub where one is needed, otherwise with a plain
 * success.
 */
export class TestServer {
  readonly #server: Server;
  #recording: Recording | null = null;

  private constructor(server: Server) {
    this.#server = server;
  }

  static async start(): Promise<TestServer> {
    const server = createServer({ key: readFileSync(KEY_FILE), cert: readFileSync(CERT_FILE) });
    const testServer = new TestServer(server);
    server.on('request', (request: IncomingMessage, response: ServerResponse) => {
      testServer.#handle(request, response).catch((error: unknown) => {
        console.error(`Failed to answer ${request.url ?? ''}:`, error);
        if (!response.headersSent) response.writeHead(500);
        response.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(SERVER_PORT, '127.0.0.1', resolve));
    return testServer;
  }

  /** Starts recording `tool`'s run; the previous recording ends. */
  record(tool: Tool): Recording {
    this.#recording = new Recording(tool);
    return this.#recording;
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  async #handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const body = await readBody(request);
    const reply = this.#route(request, body);
    response.writeHead(reply.status, {
      'content-type': reply.contentType,
      ...corsHeaders(request),
      ...reply.headers,
    });
    response.end(reply.body);
  }

  /** The answer to one request, recording it first if it went to a tool's server. */
  #route(request: IncomingMessage, body: Buffer): Reply {
    // Recorded exactly as received; `url` is only for routing.
    const rawUrl = `https://${request.headers.host ?? SITE_HOST}${request.url ?? '/'}`;
    const url = new URL(rawUrl);
    if (request.method === 'OPTIONS' || isChromeServiceHost(url.hostname)) return NO_CONTENT;

    const recording = this.#recording;
    if (!recording) return { status: 503, contentType: 'text/plain', body: 'No run in progress' };

    const script = recording.scriptFiles.get(`${url.origin}${url.pathname}`);
    if (script) {
      recording.scripts.push({
        url: rawUrl,
        bytes: script.length,
        gzip: gzipSync(script, { level: 9 }).length,
      });
      return { status: 200, contentType: 'application/javascript', body: script };
    }
    if (url.hostname === SITE_HOST) return sitePage(url.pathname, recording.tool.snippet);
    if (url.hostname === PARTNER_HOST) return PARTNER_PAGE;

    recording.requests.push(toRecordedRequest(request, rawUrl, body, recording.phase));
    const stub = recording.tool.respond?.(url);
    if (stub) return { status: 200, ...stub };
    const wantsImage =
      (request.headers.accept ?? '').startsWith('image/') || /\.(gif|png)$/.test(url.pathname);
    if (wantsImage) return { status: 200, contentType: 'image/gif', body: PIXEL_GIF };
    return { status: 200, contentType: 'application/json', body: '{}' };
  }
}

function toRecordedRequest(
  request: IncomingMessage,
  url: string,
  body: Buffer,
  phase: string | null,
): RecordedRequest {
  const decoded = decodeBody(body, url);
  return {
    phase,
    method: request.method ?? 'GET',
    url,
    bodyBytes: body.length,
    urlBytes: Buffer.byteLength(url),
    contentType: request.headers['content-type'] ?? null,
    cookieHeader: request.headers.cookie ?? null,
    body:
      decoded && decoded.length > MAX_BODY_CHARS ? `${decoded.slice(0, MAX_BODY_CHARS)}…` : decoded,
  };
}
