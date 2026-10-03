import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listFlows, resolveProject, videoPath, workDir } from './project.ts';

const dir = path.resolve('/app/tutorials');

describe('resolveProject', () => {
  it('fills in defaults relative to the tutorials folder', () => {
    const p = resolveProject(dir, { app: { url: 'http://localhost:3000/' } });
    expect(p.app).toEqual({ url: 'http://localhost:3000', command: undefined, cwd: path.resolve('/app'), env: {}, reuseExistingServer: false, startTimeoutMs: 60_000 });
    expect(p.flowsDir).toBe(path.join(dir, 'flows'));
    expect(p.assetsDir).toBe(path.join(dir, 'assets'));
    expect(p.outDir).toBe(path.resolve('/app/docs/tutorials'));
    expect(p.viewport).toEqual({ width: 1920, height: 1080 });
    expect(p.network.external).toBe('block');
    expect(p.browser.channel).toBe('chrome');
    expect(p.mocks).toBeNull(); // no mocks.ts on disk
  });

  it('keeps explicit settings', () => {
    const p = resolveProject(dir, {
      app: { url: 'http://localhost:5173', command: 'pnpm dev', cwd: '../web', env: { A: '1' } },
      brand: { kicker: 'Acme', accent: '#123456' },
      network: { external: 'allow' },
      outDir: './out',
      browser: { channel: '' },
    });
    expect(p.app.cwd).toBe(path.resolve('/app/web'));
    expect(p.app.env).toEqual({ A: '1' });
    expect(p.brand).toEqual({ kicker: 'Acme', accent: '#123456' });
    expect(p.network.external).toBe('allow');
    expect(p.outDir).toBe(path.join(dir, 'out'));
    expect(p.browser.channel).toBe('');
  });

  it('requires app.url and a known network mode', () => {
    expect(() => resolveProject(dir, {} as never)).toThrow(/app.url/);
    expect(() => resolveProject(dir, { app: { url: 'http://x' }, network: { external: 'maybe' as never } })).toThrow(/network.external/);
  });

  it('files finished videos by category', () => {
    const p = resolveProject(dir, { app: { url: 'http://x' } });
    expect(workDir(p, '01-a')).toBe(path.join(p.outDir, '01-a'));
    expect(videoPath(p, { slug: '01-a', category: 'billing' })).toBe(path.join(p.outDir, 'videos', 'billing', '01-a.mp4'));
    expect(videoPath(p, { slug: '01-a', category: '' })).toBe(path.join(p.outDir, 'videos', '01-a.mp4'));
  });
});

describe('listFlows', () => {
  let tmp = '';
  afterEach(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

  const touch = (rel: string) => {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '');
  };

  it('finds *.flow.ts files, taking the slug from the name and the category from the folder', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorialize-'));
    touch('users/01-add-a-user.flow.ts');
    touch('billing/invoices/02-send-an-invoice.flow.ts');
    touch('00-welcome.flow.ts');
    touch('users/helpers.ts');
    expect(listFlows(tmp).map((f) => [f.category, f.slug])).toEqual([
      ['', '00-welcome'],
      ['billing/invoices', '02-send-an-invoice'],
      ['users', '01-add-a-user'],
    ]);
  });

  it('rejects two flows with the same slug', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorialize-'));
    touch('a/01-x.flow.ts');
    touch('b/01-x.flow.ts');
    expect(() => listFlows(tmp)).toThrow(/share the slug/);
  });

  it('is empty when the folder does not exist', () => {
    expect(listFlows(path.join(os.tmpdir(), 'tutorialize-missing-dir'))).toEqual([]);
  });
});
