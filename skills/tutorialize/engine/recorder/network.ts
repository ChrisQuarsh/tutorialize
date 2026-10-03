import type { BrowserContext } from '@playwright/test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { MockHandler, MockRequest, MockResponse, Project } from '../core/types.ts';

export interface NetRequest { method: string; resourceType: string; url: string; postData: string | null }
export type Decision = { kind: 'passthrough' } | { kind: 'abort'; label: string } | { kind: 'fulfill'; status: number; json: unknown; label: string };

// What happens to a request no mock answered.
// - Requests to localhost (the app's dev server, a local API) pass through.
// - With network.external 'allow', everything else passes through too.
// - With 'block' (the default), nothing the app sends reaches another origin: xhr/fetch get a 503
//   (so the page shows its error or fallback state), other requests are aborted, except read-only GETs
//   for images, fonts and stylesheets the UI needs to look right.
// WebSockets to other origins are closed and service workers are blocked (see installNetwork).
const READ_ONLY_ASSETS = new Set(['image', 'font', 'stylesheet']);

export function isLocalUrl(url: string | URL): boolean {
  const host = new URL(url).hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.localhost');
}

export function decide(req: NetRequest, external: 'block' | 'allow'): Decision {
  if (isLocalUrl(req.url) || external === 'allow') return { kind: 'passthrough' };
  if (req.resourceType === 'xhr' || req.resourceType === 'fetch') {
    return { kind: 'fulfill', status: 503, json: { message: 'tutorial mode: external API blocked (add a mock for it)' }, label: 'blocked' };
  }
  if (req.method === 'GET' && READ_ONLY_ASSETS.has(req.resourceType)) return { kind: 'passthrough' };
  return { kind: 'abort', label: 'external' };
}

/** The mocks see every xhr/fetch and every request to another origin; page loads and scripts from the dev server never reach them. */
export function asksMocks(req: NetRequest): boolean {
  return req.resourceType === 'xhr' || req.resourceType === 'fetch' || !isLocalUrl(req.url);
}

export function toMockRequest(req: NetRequest): MockRequest {
  const url = new URL(req.url);
  let body: unknown = null;
  if (req.postData) { try { body = JSON.parse(req.postData); } catch { /* not JSON */ } }
  return { method: req.method, url, path: url.pathname, query: url.searchParams, body, raw: req.postData, resourceType: req.resourceType };
}

const TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json', '.pdf': 'application/pdf' };

/** Arguments for route.fulfill from a mock's answer; null means abort. */
export function fulfillment(res: MockResponse, assetsDir: string): null | { status: number; headers?: Record<string, string>; contentType?: string; body?: string; path?: string } {
  if ('abort' in res) return null;
  const status = res.status ?? 200;
  if ('json' in res) return { status, headers: res.headers, contentType: 'application/json', body: JSON.stringify(res.json) };
  if ('file' in res) {
    const p = path.resolve(assetsDir, res.file);
    return { status, path: p, contentType: res.contentType ?? TYPES[path.extname(p).toLowerCase()] ?? 'application/octet-stream' };
  }
  return { status, headers: res.headers, contentType: res.contentType ?? 'text/plain', body: res.body };
}

export async function loadMocks(project: Project): Promise<{ handle: MockHandler | null; state: unknown }> {
  if (!project.mocks) return { handle: null, state: {} };
  const mod = await import(pathToFileURL(project.mocks).href);
  if (typeof mod.default !== 'function') throw new Error(`${project.mocks} must default-export a handler function (req, state) => response | undefined`);
  return { handle: mod.default, state: typeof mod.createState === 'function' ? await mod.createState() : {} };
}

export async function installNetwork(context: BrowserContext, project: Project): Promise<void> {
  const debug = process.env.TUTORIAL_DEBUG === '1';
  const log = (label: string, r: NetRequest) => debug && console.log(`[network] ${label} ${r.method} ${r.resourceType} ${r.url}`);
  if (project.network.external === 'block') {
    await context.routeWebSocket((url) => !isLocalUrl(url), (ws) => {
      if (debug) console.log(`[network] websocket-closed ${ws.url()}`);
      return ws.close();
    });
  }
  const mocks = await loadMocks(project); // one state per recording, so the flow's writes show up in later reads
  await context.route('**/*', async (route) => {
    const request = route.request();
    const req: NetRequest = { method: request.method(), resourceType: request.resourceType(), url: request.url(), postData: request.postData() };
    if (mocks.handle && asksMocks(req)) {
      const res = await mocks.handle(toMockRequest(req), mocks.state);
      if (res) {
        log('mocked', req);
        const f = fulfillment(res, project.assetsDir);
        return f ? route.fulfill(f) : route.abort('blockedbyclient');
      }
    }
    const d = decide(req, project.network.external);
    if (d.kind === 'passthrough') return route.continue();
    log(d.label, req);
    if (d.kind === 'abort') return route.abort('blockedbyclient');
    return route.fulfill({ status: d.status, contentType: 'application/json', body: JSON.stringify(d.json) });
  });
}
