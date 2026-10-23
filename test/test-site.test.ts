import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { identifyElement } from '../src/test-site.ts';

describe('identifyElement', () => {
  it('matches by id first', () => {
    assert.equal(identifyElement({ id: 'dead', tag: 'img' })?.id, 'dead');
  });

  it('matches a link by its target, relative or absolute', () => {
    assert.equal(identifyElement({ href: '/files/report.pdf' })?.id, 'download');
    assert.equal(
      identifyElement({ href: 'https://cookieless-test.example/files/report.pdf' })?.id,
      'download',
    );
    assert.equal(identifyElement({ href: 'https://example.org/partner' })?.id, 'outbound');
  });

  it('matches by text when there is no id or link', () => {
    assert.equal(identifyElement({ tag: 'button', text: 'Download report' })?.id, 'dead');
  });

  it('matches by tag only when one element has it', () => {
    assert.equal(identifyElement({ tag: 'IMG' })?.id, 'photo');
    assert.equal(identifyElement({ tag: 'button' }), null);
  });

  it('gives up on an unknown element', () => {
    assert.equal(identifyElement({ id: 'nowhere' }), null);
    assert.equal(identifyElement({}), null);
  });
});
