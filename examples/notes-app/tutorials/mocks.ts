import type { MockHandler } from './types.ts';

// The notes app talks to https://api.notes.example/notes. These mocks stand in for it while recording.

interface Note { title: string; body: string; colour: string }
interface State { notes: Note[] }

export function createState(): State {
  return {
    notes: [
      { title: 'Groceries', body: 'Oat milk, apples, coffee beans', colour: 'Yellow' },
      { title: 'Team sync', body: 'Thursday 10:00, bring the roadmap', colour: 'Blue' },
    ],
  };
}

const handle: MockHandler<State> = (req, state) => {
  if (req.url.hostname !== 'api.notes.example') return undefined;
  if (req.path === '/notes' && req.method === 'GET') return { json: state.notes };
  if (req.path === '/notes' && req.method === 'POST') {
    state.notes.push(req.body as Note);
    return { status: 201, json: req.body };
  }
  return undefined;
};

export default handle;
