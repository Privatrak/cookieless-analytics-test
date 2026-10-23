import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fathom } from '../src/tools/fathom/index.ts';
import { matomo } from '../src/tools/matomo/index.ts';
import { mixpanel } from '../src/tools/mixpanel/index.ts';
import { pirsch } from '../src/tools/pirsch/index.ts';
import { plausible } from '../src/tools/plausible/index.ts';
import { elementFromChain, posthog } from '../src/tools/posthog/index.ts';
import { privatrak } from '../src/tools/privatrak/index.ts';
import { simpleAnalytics } from '../src/tools/simple-analytics/index.ts';
import { umami } from '../src/tools/umami/index.ts';
import { mixpanelBody, request } from './helpers.ts';

const SITE = 'https://cookieless-test.example';

describe('plausible', () => {
  it('reads a page view and its referrer', () => {
    const events = plausible.parseEvents(
      request('https://plausible.io/api/event', { n: 'pageview', u: `${SITE}/`, r: null }),
    );
    assert.deepEqual(events, [
      { kind: 'pageview', name: 'pageview', page: `${SITE}/`, referrer: null },
    ]);
  });
});

describe('fathom', () => {
  it('rebuilds the page from the path and the query parameters it kept', () => {
    const qs = encodeURIComponent(JSON.stringify({ utm_source: 'newsletter' }));
    const [event] = fathom.parseEvents(
      request(`https://cdn.usefathom.com/?p=%2Fwelcome&r=&qs=${qs}`),
    );
    assert.equal(event?.page, '/welcome?utm_source=newsletter');
  });

  it('reads the engagement ping', () => {
    assert.equal(
      fathom.parseEvents(request('https://cdn.usefathom.com/?dp=1'))[0]?.kind,
      'engagement',
    );
  });
});

describe('simple analytics', () => {
  it('reads a page view from the image request', () => {
    const [event] = simpleAnalytics.parseEvents(
      request('https://queue.simpleanalyticscdn.com/simple.gif?path=%2Fsearch&query=&referrer='),
    );
    assert.deepEqual(event, { kind: 'pageview', name: 'pageview', page: '/search', referrer: '' });
  });
});

describe('umami', () => {
  it('counts an event without a name as a page view', () => {
    const [event] = umami.parseEvents(
      request('https://gateway.umami.is/api/send', {
        type: 'event',
        payload: { url: `${SITE}/`, referrer: '' },
      }),
    );
    assert.equal(event?.kind, 'pageview');
  });
});

describe('pirsch', () => {
  it('reads page views from /hit and downloads from /event', () => {
    const [view] = pirsch.parseEvents(
      request(`https://api.pirsch.io/hit?url=${encodeURIComponent(SITE)}&ref=`),
    );
    assert.equal(view?.page, SITE);
    const [download] = pirsch.parseEvents(
      request('https://api.pirsch.io/event', {
        event_name: 'File Download',
        event_meta: { file: '/files/report.pdf' },
      }),
    );
    assert.deepEqual(download, {
      kind: 'download',
      name: 'File Download',
      element: { href: '/files/report.pdf' },
    });
  });
});

describe('matomo', () => {
  const tracker = 'https://example.matomo.cloud/matomo.php';

  it('tells page views, downloads, outbound links and pings apart', () => {
    const kinds = [
      `${tracker}?action_name=Test&url=${encodeURIComponent(SITE)}`,
      `${tracker}?download=${encodeURIComponent(`${SITE}/files/report.pdf`)}`,
      `${tracker}?link=${encodeURIComponent('https://example.org/partner')}`,
      `${tracker}?ping=1`,
    ].map((url) => matomo.parseEvents(request(url))[0]?.kind);
    assert.deepEqual(kinds, ['pageview', 'download', 'outbound-link', 'other']);
  });
});

describe('posthog', () => {
  it('reads the clicked element from the elements chain', () => {
    const chain =
      'button.btn:attr__class="btn"attr__id="dead"text="Download report";p:nth-child="4"';
    assert.deepEqual(elementFromChain(chain), {
      tag: 'button',
      id: 'dead',
      href: null,
      text: 'Download report',
    });
  });

  it('reads a batch of clicks, form submits and page views', () => {
    const events = posthog.parseEvents(
      request('https://us.i.posthog.com/e/', {
        batch: [
          {
            event: '$autocapture',
            properties: { $event_type: 'click', $elements_chain: 'a:attr__id="internal"' },
          },
          {
            event: '$autocapture',
            properties: { $event_type: 'submit', $elements_chain: 'form:attr__id="newsletter"' },
          },
          { event: '$rageclick', properties: { $elements_chain: 'img:attr__id="photo"' } },
          { event: '$pageview', properties: { $current_url: `${SITE}/`, $referrer: '$direct' } },
        ],
      }),
    );
    assert.deepEqual(
      events.map((event) => event.kind),
      ['click', 'form-submit', 'rage-click', 'pageview'],
    );
    assert.equal(events[2]?.element?.id, 'photo');
  });
});

describe('mixpanel', () => {
  const track = 'https://api-js.mixpanel.com/track/?verbose=1';

  it('reads events from the form-encoded batch, with their insert id', () => {
    const [event] = mixpanel.parseEvents(
      request(
        track,
        mixpanelBody([
          {
            event: '$mp_dead_click',
            properties: { $insert_id: 'a1', $el_tag_name: 'img', $el_id: 'photo' },
          },
        ]),
      ),
    );
    assert.ok(event);
    assert.equal(event.kind, 'dead-click');
    assert.equal(event.dedupeKey, 'a1');
    assert.equal(event.element?.id, 'photo');
  });

  it('counts an upload to /record/ as session recording', () => {
    const [event] = mixpanel.parseEvents(
      request('https://api-js.mixpanel.com/record/?$current_url=x', '[]'),
    );
    assert.equal(event?.kind, 'session-recording');
  });

  it('answers batches as accepted, so they are not resent', () => {
    assert.deepEqual(JSON.parse(mixpanel.respond?.(new URL(track))?.body ?? ''), {
      status: 1,
      error: null,
    });
  });
});

describe('privatrak', () => {
  it('reads clicks with their element and page views with their address', () => {
    const events = privatrak.parseEvents(
      request('https://api.privatrak.com/api/events', {
        events: [
          { event_type: 'pageview', page_url: `${SITE}/`, referrer: null },
          { event_type: 'dead_click', element_tag: 'img', element_text: null },
        ],
      }),
    );
    assert.deepEqual(events, [
      { kind: 'pageview', name: 'pageview', page: `${SITE}/`, referrer: null },
      { kind: 'dead-click', name: 'dead_click', element: { tag: 'img', text: null } },
    ]);
  });

  it('answers its config request with a new project’s settings', () => {
    const config = privatrak.respond?.(new URL('https://api.privatrak.com/api/config'));
    assert.equal((JSON.parse(config?.body ?? '{}') as { autocapture?: boolean }).autocapture, true);
  });
});
