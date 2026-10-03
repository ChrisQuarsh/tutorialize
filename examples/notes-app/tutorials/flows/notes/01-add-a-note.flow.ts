import type { Page } from '@playwright/test';
import type { Flow } from '../../types.ts';

const dialog = (p: Page) => p.getByRole('dialog');
const newNote = (p: Page) => p.getByRole('listitem').filter({ hasText: 'Book the venue' });

const flow: Flow = {
  title: 'How to add a note',
  intro: "In this video you'll add a note and choose its colour.",
  outro: 'Your note is saved and pinned to your Notes page.',
  setup: async (page) => { await page.goto('/'); },

  steps: [
    {
      id: 'open-notes',
      caption: 'Click Notes',
      narration: 'Click Notes in the menu at the top.',
      actions: [
        { kind: 'click', target: (p) => p.getByRole('navigation').getByRole('button', { name: 'Notes' }), zoom: false },
        { kind: 'expect', target: (p) => p.getByRole('heading', { name: 'Notes' }) },
      ],
    },
    {
      id: 'open-form',
      caption: 'Click New note',
      narration: 'Click New note. A form opens.',
      actions: [
        { kind: 'click', target: (p) => p.getByRole('button', { name: 'New note' }) },
        { kind: 'expect', target: (p) => dialog(p).getByRole('heading', { name: 'New note' }) },
      ],
    },
    {
      id: 'write-note',
      caption: 'Write a title and note',
      narration: 'Give the note a short title, then write the details underneath.',
      actions: [
        { kind: 'fill', target: (p) => dialog(p).getByLabel('Title'), text: 'Book the venue' },
        { kind: 'fill', target: (p) => dialog(p).getByLabel('Note'), text: 'Call by Friday for 40 guests' },
      ],
    },
    {
      id: 'choose-colour',
      caption: 'Choose a colour',
      narration: 'Pick a colour so related notes stand out. Here we choose green.',
      actions: [{ kind: 'select', target: (p) => dialog(p).getByLabel('Colour'), option: 'Green' }],
    },
    {
      id: 'save',
      caption: 'Click Save note',
      narration: 'Click Save note. A message confirms it was saved.',
      actions: [
        { kind: 'click', target: (p) => dialog(p).getByRole('button', { name: 'Save note' }) },
        { kind: 'expect', target: (p) => p.getByRole('status').filter({ hasText: 'Note saved' }), zoom: true },
      ],
    },
    {
      id: 'verify',
      caption: 'Find your new note',
      narration: 'Your new note now sits with the others on the Notes page.',
      holdMs: 2500,
      actions: [{ kind: 'expect', target: newNote, zoomArea: [newNote] }],
    },
  ],
};

export default flow;
