/**
 * What one test run records, as it is written to `results/`. The analysis
 * reads these files back, so their shape is the contract between the two.
 */

/** A request a tool sent to its server. */
export interface RecordedRequest {
  /** The step of the visit (or the URL case) that was running when it arrived. */
  phase: string | null;
  method: string;
  url: string;
  bodyBytes: number;
  urlBytes: number;
  contentType: string | null;
  cookieHeader: string | null;
  /** The body as text, gunzipped or base64-decoded where needed, cut at 20,000 characters. */
  body: string | null;
}

/** A script the page loaded from one of the tool's script URLs. */
export interface LoadedScript {
  url: string;
  bytes: number;
  /** Size gzipped at level 9 here, not as the vendor's CDN serves it. */
  gzip: number;
}

export interface CookieRecord {
  name: string;
  domain: string;
  /** ISO date, or `session` for a session cookie. */
  expires: string;
}

export interface StorageEntry {
  key: string;
  /** The stored value, cut at 400 characters. */
  value: string;
}

/** Everything the tool left in the browser at one moment. */
export interface BrowserStorage {
  cookies: CookieRecord[];
  localStorage: StorageEntry[];
  sessionStorage: StorageEntry[];
  indexedDB: string[];
}

/** One tool's run of the visit (`npm run visit`). */
export interface VisitRun {
  tool: string;
  note: string | null;
  scripts: LoadedScript[];
  afterLoad: BrowserStorage;
  afterVisit: BrowserStorage;
  sent: RecordedRequest[];
  ranAt: string;
}

/** One address of the URL test. */
export interface UrlCase {
  id: string;
  /** Path, query and fragment opened on the test site. */
  path: string;
  /** Which value of `UrlRun.secrets` must not reach the tool. */
  secret?: string;
  /** Text that should arrive unchanged. */
  keep?: string;
  /** Selector of a link clicked afterwards, so the address goes out as the referrer. */
  then?: string;
}

/** One tool's run of the URL test (`npm run urls`). */
export interface UrlRun {
  tool: string;
  cases: UrlCase[];
  secrets: Record<string, string>;
  sent: RecordedRequest[];
  ranAt: string;
}
