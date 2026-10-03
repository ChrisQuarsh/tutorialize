import type { MockHandler, MockRequest } from './types.ts';

// Demo data for recordings, so videos never touch a real account or a real backend.
// The handler sees every xhr/fetch the app makes (any origin) and every request to another origin.
// Return a response to answer it, or undefined to fall through (local requests pass, external ones are blocked).
//
// State is created fresh for each recording; apply the flow's writes to it so later reads show them.

interface State { items: { id: number; name: string }[] }

export function createState(): State {
  return { items: [{ id: 1, name: 'First example item' }] };
}

const handle: MockHandler<State> = (req: MockRequest, state) => {
  // Example: a REST collection at /api/items (adjust the paths and shapes to your API).
  if (req.path === '/api/items' && req.method === 'GET') return { json: state.items };
  if (req.path === '/api/items' && req.method === 'POST') {
    const item = { id: state.items.length + 1, ...(req.body as { name: string }) };
    state.items.push(item);
    return { status: 201, json: item };
  }
  // Example: serve a photo from tutorials/assets/ instead of a real CDN.
  // if (req.url.hostname === 'cdn.example.com') return { file: 'photos/cake.jpg' };
  return undefined;
};

export default handle;
