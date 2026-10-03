import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { asksMocks, decide, fulfillment, isLocalUrl, toMockRequest } from './network.ts';

const base = { method: 'GET', resourceType: 'xhr', url: 'http://localhost:3000/api/notes', postData: null };

describe('decide (requests no mock answered)', () => {
  it('passes everything local through', () => {
    for (const resourceType of ['document', 'script', 'stylesheet', 'image', 'font', 'xhr', 'fetch']) {
      expect(decide({ ...base, resourceType }, 'block').kind).toBe('passthrough');
    }
  });

  it('answers external API calls with a 503 when blocking', () => {
    expect(decide({ ...base, url: 'https://api.example.com/notes' }, 'block')).toMatchObject({ kind: 'fulfill', status: 503, label: 'blocked' });
    expect(decide({ ...base, resourceType: 'fetch', method: 'POST', url: 'https://api.example.com/notes' }, 'block')).toMatchObject({ status: 503 });
  });

  it('lets read-only external assets through but aborts other external requests', () => {
    for (const resourceType of ['image', 'font', 'stylesheet']) {
      expect(decide({ ...base, resourceType, url: 'https://cdn.example.com/x' }, 'block').kind).toBe('passthrough');
    }
    expect(decide({ ...base, resourceType: 'script', url: 'https://cdn.example.com/x.js' }, 'block')).toMatchObject({ kind: 'abort' });
    expect(decide({ ...base, resourceType: 'document', method: 'POST', url: 'https://other.example.com/' }, 'block')).toMatchObject({ kind: 'abort' });
    expect(decide({ ...base, resourceType: 'image', method: 'POST', url: 'https://cdn.example.com/x' }, 'block')).toMatchObject({ kind: 'abort' });
  });

  it('allows everything with external: allow', () => {
    expect(decide({ ...base, url: 'https://api.example.com/notes' }, 'allow').kind).toBe('passthrough');
  });
});

describe('isLocalUrl', () => {
  it('knows loopback hosts', () => {
    expect(isLocalUrl('http://localhost:5173/')).toBe(true);
    expect(isLocalUrl('http://127.0.0.1/')).toBe(true);
    expect(isLocalUrl('http://app.localhost/')).toBe(true);
    expect(isLocalUrl('https://localhost.example.com/')).toBe(false);
  });
});

describe('asksMocks', () => {
  it('asks for API calls anywhere and for anything external, never for local page assets', () => {
    expect(asksMocks(base)).toBe(true);
    expect(asksMocks({ ...base, resourceType: 'image', url: 'https://cdn.example.com/a.jpg' })).toBe(true);
    expect(asksMocks({ ...base, resourceType: 'script', url: 'http://localhost:3000/src/main.ts' })).toBe(false);
  });
});

describe('toMockRequest', () => {
  it('parses the URL and a JSON body', () => {
    const r = toMockRequest({ ...base, method: 'POST', url: 'http://localhost:3000/api/notes?x=1', postData: '{"title":"Hi"}' });
    expect(r.path).toBe('/api/notes');
    expect(r.query.get('x')).toBe('1');
    expect(r.body).toEqual({ title: 'Hi' });
  });

  it('keeps a non-JSON body raw', () => {
    const r = toMockRequest({ ...base, method: 'POST', postData: '--boundary' });
    expect(r.body).toBeNull();
    expect(r.raw).toBe('--boundary');
  });
});

describe('fulfillment', () => {
  const assets = path.resolve('/project/tutorials/assets');

  it('serialises JSON with status 200 by default', () => {
    expect(fulfillment({ json: { ok: true } }, assets)).toMatchObject({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });

  it('serves files from the assets folder with a guessed type', () => {
    expect(fulfillment({ file: 'photos/cake.jpg' }, assets)).toMatchObject({ status: 200, path: path.join(assets, 'photos', 'cake.jpg'), contentType: 'image/jpeg' });
  });

  it('passes text bodies and statuses through', () => {
    expect(fulfillment({ status: 404, body: 'nope' }, assets)).toMatchObject({ status: 404, body: 'nope', contentType: 'text/plain' });
  });

  it('aborts on { abort: true }', () => {
    expect(fulfillment({ abort: true }, assets)).toBeNull();
  });
});
