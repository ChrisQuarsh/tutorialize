import type { Flow } from '../../types.ts';

// An example flow: copy it, rename the file (<nn>-<task>.flow.ts) and point the locators at your app.
// The slug is the file name; the folder (getting-started) is the category videos are filed under.
const flow: Flow = {
  title: 'How to add an item',
  intro: "In this video you'll add a new item and check that it was saved.",
  outro: 'Your new item is saved and listed.',
  setup: async (page) => { await page.goto('/'); },   // off camera: sign in here if the app needs it

  steps: [
    {
      id: 'open-form',
      caption: 'Click New item',
      narration: 'Click New item at the top of the page.',
      actions: [{ kind: 'click', target: (p) => p.getByRole('button', { name: 'New item' }) }],
    },
    {
      id: 'enter-name',
      caption: 'Enter a name',
      narration: 'Give the item a name you will recognise later.',
      actions: [{ kind: 'fill', target: (p) => p.getByLabel('Name'), text: 'Weekly report' }],
    },
    {
      id: 'save',
      caption: 'Click Save',
      narration: 'Click Save to add the item.',
      actions: [{ kind: 'click', target: (p) => p.getByRole('button', { name: 'Save' }) }],
    },
    {
      id: 'verify',
      caption: 'Find the new item',
      narration: 'The new item now appears in your list.',
      holdMs: 2500,
      actions: [{ kind: 'expect', target: (p) => p.getByRole('listitem').filter({ hasText: 'Weekly report' }), zoom: true }],
    },
  ],
};

export default flow;
