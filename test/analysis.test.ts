import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decode, readable } from '../src/analysis/text.ts';
import { judgeCase, summarizeUrls } from '../src/analysis/urls.ts';
import { emailHandling, summarizeVisit } from '../src/analysis/visit.ts';
import type { UrlRun, VisitRun } from '../src/recording.ts';
import { mixpanel } from '../src/tools/mixpanel/index.ts';
import { privatrak } from '../src/tools/privatrak/index.ts';
import { mixpanelBody, request } from './helpers.ts';

const SITE = 'https://cookieless-test.example';
const EVENTS = 'https://api.privatrak.com/api/events';
const SECRETS = { email: 'someone@example.com' };

describe('text', () => {
  it('decodes valid escapes and leaves broken ones', () => {
    assert.equal(decode('a%40b%'), 'a@b%');
    assert.equal(readable('someone%2540example.com+x'), 'someone@example.com x');
  });
});

describe('judgeCase', () => {
  const emailCase = { id: 'query-email', path: '/welcome?email=x', secret: 'email' };

  it('finds the value however often it was encoded', () => {
    const views = [{ page: `${SITE}/welcome?email=someone%2540example.com`, referrer: null }];
    assert.equal(judgeCase(emailCase, views, SECRETS).verdict, 'leaked');
  });

  it('tells a placeholder from a value that was cut off', () => {
    const redacted = [{ page: `${SITE}/welcome?email=%3Aredacted`, referrer: null }];
    const dropped = [{ page: '/welcome', referrer: null }];
    assert.equal(judgeCase(emailCase, redacted, SECRETS).verdict, 'redacted');
    assert.equal(judgeCase(emailCase, dropped, SECRETS).verdict, 'dropped');
  });

  it('reads a referrer case from the page view after the click', () => {
    const referrerCase = { ...emailCase, then: '#next' };
    const views = [
      { page: '/account', referrer: null },
      { page: '/pricing', referrer: '$direct' },
    ];
    assert.deepEqual(judgeCase(referrerCase, views, SECRETS), {
      where: 'referrer',
      recorded: '$direct',
      verdict: 'no referrer',
    });
  });

  it('marks data worth keeping as kept, dropped or rewritten', () => {
    const keepCase = { id: 'keep-date', path: '/blog/2026/10/x', keep: '/blog/2026/10/x' };
    const verdict = (page: string): string =>
      judgeCase(keepCase, [{ page, referrer: null }], SECRETS).verdict;
    assert.equal(verdict(`${SITE}/blog/2026/10/x`), 'kept');
    assert.equal(verdict(`${SITE}/blog/:id/:id/x`), 'rewritten');
    assert.equal(verdict(`${SITE}/blog`), 'dropped');
  });
});

describe('summarizeUrls', () => {
  it('counts a page view sent when the page unloads for the case it belongs to', () => {
    const view = (id: string, page: string): unknown => ({
      event: '$mp_web_page_view',
      properties: { $insert_id: id, $current_url: page, $referrer: '' },
    });
    const track = 'https://api-js.mixpanel.com/track/';
    const casePage = `${SITE}/unsubscribe/someone@example.com`;
    const run: UrlRun = {
      tool: 'mixpanel',
      cases: [{ id: 'path-email', path: '/unsubscribe/someone@example.com', secret: 'email' }],
      secrets: SECRETS,
      sent: [
        // The start page's view, sent as it unloads, once the case has opened.
        request(track, mixpanelBody([view('start', `${SITE}/`)]), 'path-email'),
        // The case's own view, sent as it unloads during the next start page, then resent.
        request(track, mixpanelBody([view('case', casePage)]), 'between'),
        request(track, mixpanelBody([view('case', casePage)]), 'between'),
      ],
      ranAt: '',
    };
    assert.deepEqual(summarizeUrls(mixpanel, run)['path-email'], {
      where: 'page',
      recorded: casePage,
      verdict: 'leaked',
    });
  });
});

describe('summarizeVisit', () => {
  const storage = { cookies: [], localStorage: [], sessionStorage: [], indexedDB: [] };
  const run = (sent: VisitRun['sent']): VisitRun => ({
    tool: 'privatrak',
    note: null,
    scripts: [{ url: 'https://api.privatrak.com/tracker.js', bytes: 100, gzip: 50 }],
    afterLoad: storage,
    afterVisit: storage,
    sent,
    ranAt: '',
  });

  it('puts a late dead click under the step that clicked the element', () => {
    const late = request(
      EVENTS,
      { events: [{ event_type: 'dead_click', element_tag: 'img' }] },
      'download',
    );
    const summary = summarizeVisit(privatrak, run([late]));
    assert.deepEqual(summary.recorded, { 'clickable-picture': ['dead-click'] });
  });

  it('counts page views, and Mixpanel resends once', () => {
    const view = {
      event: '$mp_web_page_view',
      properties: { $insert_id: 'x', $current_url: `${SITE}/` },
    };
    const track = 'https://api-js.mixpanel.com/track/';
    const summary = summarizeVisit(mixpanel, {
      ...run([request(track, mixpanelBody([view])), request(track, mixpanelBody([view]))]),
      tool: 'mixpanel',
    });
    assert.equal(summary.pageViews, 1);
  });
});

describe('emailHandling', () => {
  it('reports whether the address arrived, as a placeholder, or not at all', () => {
    assert.equal(emailHandling([request(`${SITE}/?e=someone%40example.com`)]), 'leaked');
    assert.equal(emailHandling([request(EVENTS, { page_url: '/?e=%3Aredacted' })]), 'redacted');
    assert.equal(emailHandling([request(`${SITE}/welcome`)]), 'dropped');
  });
});
