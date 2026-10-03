// The example app keeps its notes behind an API on another origin. While recording, the tutorial's
// mocks answer it (see ../tutorials/mocks.ts), so the video needs no real backend.
const API = 'https://api.notes.example/notes';

const $ = (s) => document.querySelector(s);
const show = (view) => {
  for (const id of ['home', 'notes']) $(`#${id}`).hidden = id !== view;
  for (const b of document.querySelectorAll('nav button')) b.toggleAttribute('aria-current', b.dataset.view === view);
  if (view === 'notes') load();
};

async function load() {
  const list = $('#list');
  try {
    const notes = await (await fetch(API)).json();
    list.replaceChildren(...notes.map((n) => {
      const li = document.createElement('li');
      li.dataset.colour = n.colour;
      li.innerHTML = `<b></b><span></span>`;
      li.querySelector('b').textContent = n.title;
      li.querySelector('span').textContent = n.body;
      return li;
    }));
  } catch {
    list.textContent = 'Could not load notes.';
  }
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 4000);
}

for (const b of document.querySelectorAll('nav button')) b.addEventListener('click', () => show(b.dataset.view));
$('#new-note').addEventListener('click', () => { $('#form').reset(); $('#form-dialog').showModal(); });
$('#cancel').addEventListener('click', () => $('#form-dialog').close());
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  $('#form-dialog').close();
  if (res.ok) { toast('Note saved'); load(); } else toast('Could not save the note');
});
