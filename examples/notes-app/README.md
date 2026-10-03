# Example: notes app

A tiny static app (no build step) with one tutorial, used to show and test tutorialize end to end.
Its notes live behind `https://api.notes.example`, a host that doesn't exist: during recording, `tutorials/mocks.ts` answers it.

```bash
cd examples/notes-app
node ../../skills/tutorialize/engine/cli.ts render 01-add-a-note --draft
```

The video lands in `examples/notes-app/docs/tutorials/videos/notes/01-add-a-note.mp4` (git-ignored).
Set `FFMPEG_DIR` in `tutorials/.env.tutorial` if FFmpeg isn't on PATH.
