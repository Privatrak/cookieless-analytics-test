import { PARTNER_URL, SITE_ORIGIN } from './config.ts';

/** An element on the home page that the visit interacts with. */
export interface PageElement {
  id: string;
  tag: string;
  text?: string;
  href?: string;
}

/**
 * The home page's elements. The visit clicks them by id, and the analysis
 * matches what a tool reports about a clicked element back to one of them.
 */
export const ELEMENTS = {
  internalLink: { id: 'internal', tag: 'a', text: 'Pricing', href: '/pricing' },
  workingButton: { id: 'signup', tag: 'button', text: 'Start free trial' },
  brokenButton: { id: 'dead', tag: 'button', text: 'Download report' },
  clickablePicture: { id: 'photo', tag: 'img' },
  downloadLink: { id: 'download', tag: 'a', text: 'Price list (PDF)', href: '/files/report.pdf' },
  outboundLink: { id: 'outbound', tag: 'a', text: 'Our partner', href: PARTNER_URL },
  subscribeButton: { id: 'subscribe', tag: 'button', text: 'Subscribe' },
  newsletterForm: { id: 'newsletter', tag: 'form' },
} as const satisfies Record<string, PageElement>;

const ALL_ELEMENTS: readonly PageElement[] = Object.values(ELEMENTS);

/** The email address the newsletter form is filled in with, and the visit's last page carries. */
export const TEST_EMAIL = 'someone@example.com';

const PICTURE_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%23ccd'/%3E%3C/svg%3E";

const HOME = `<h1>Test shop</h1>
<p><a id="internal" href="/pricing">Pricing</a></p>
<p><button id="signup" class="btn" onclick="document.getElementById('msg').textContent='Thanks!'">Start free trial</button> <span id="msg"></span></p>
<p><button id="dead" class="btn">Download report</button></p>
<p><img id="photo" alt="Product photo" width="160" height="90" style="cursor:pointer" src="${PICTURE_SRC}"></p>
<p><a id="download" href="/files/report.pdf">Price list (PDF)</a></p>
<p><a id="outbound" href="${PARTNER_URL}">Our partner</a></p>
<form id="newsletter" action="/thanks" method="post"><input type="email" name="email" value="${TEST_EMAIL}"> <button id="subscribe" class="btn" type="submit">Subscribe</button></form>`;

const PAGES: Record<string, { title: string; body: string }> = {
  '/': { title: 'Test shop', body: HOME },
  '/pricing': { title: 'Pricing', body: '<h1>Pricing</h1><p><a href="/">Home</a></p>' },
  '/thanks': { title: 'Thanks', body: '<h1>Thanks for subscribing</h1>' },
  '/welcome': { title: 'Welcome', body: '<h1>Welcome back</h1>' },
};

/** Any other path, for the URL test: a plain page with a link onward. */
const OTHER_PAGE = {
  title: 'Page',
  body: '<h1>Page</h1><p><a id="next" href="/pricing">Next page</a></p>',
};

const STYLE =
  'body{font-family:sans-serif;max-width:640px;margin:40px auto}.btn{display:inline-block;padding:8px 14px;border:1px solid #333;border-radius:6px;cursor:pointer;margin:6px 0}';

export interface SiteResponse {
  status: number;
  contentType: string;
  body: string;
  headers?: Record<string, string>;
}

/** The test site's answer for `pathname`, with the tool's snippet in every page's head. */
export function sitePage(pathname: string, snippet: string): SiteResponse {
  if (pathname === '/files/report.pdf') {
    return {
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4\n%%EOF',
      headers: { 'content-disposition': 'attachment; filename=report.pdf' },
    };
  }
  if (pathname === '/favicon.ico') return { status: 404, contentType: 'text/plain', body: '' };
  const page = PAGES[pathname] ?? OTHER_PAGE;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${page.title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
${snippet}
<style>${STYLE}</style>
</head><body>${page.body}</body></html>`;
  return { status: 200, contentType: 'text/html', body: html };
}

/** The page the outbound link leads to. */
export const PARTNER_PAGE: SiteResponse = {
  status: 200,
  contentType: 'text/html',
  body: '<h1>Partner site</h1>',
};

/** What a tool reported about a clicked element; any field may be missing. */
export interface ElementHint {
  id?: string | null;
  tag?: string | null;
  text?: string | null;
  href?: string | null;
}

function sameHref(a: string, b: string): boolean {
  return new URL(a, SITE_ORIGIN).href === new URL(b, SITE_ORIGIN).href;
}

/**
 * The page element a tool's report is about, or `null` when it can't be told.
 * Tools describe elements differently (PostHog and Mixpanel by id, Privatrak
 * by tag and text, Pirsch and Matomo by the link's target), so the most
 * specific field present decides: id, then link target, then text, then a tag
 * that only one element has.
 */
export function identifyElement(hint: ElementHint): PageElement | null {
  const matches = (predicate: (element: PageElement) => boolean): PageElement[] =>
    ALL_ELEMENTS.filter(predicate);
  const unique = (found: PageElement[]): PageElement | null =>
    found.length === 1 ? (found[0] ?? null) : null;

  const { id, href, text, tag } = hint;
  if (id) return unique(matches((element) => element.id === id));
  if (href)
    return unique(matches((element) => element.href !== undefined && sameHref(element.href, href)));
  if (text) return unique(matches((element) => element.text === text.trim()));
  if (tag) return unique(matches((element) => element.tag === tag.toLowerCase()));
  return null;
}
