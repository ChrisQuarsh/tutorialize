import type { TutorialConfig } from './types.ts';

// Settings for recording tutorials of this app. Relative paths resolve from this folder.
const config: TutorialConfig = {
  app: {
    url: 'http://localhost:3000',   // where the app runs while recording
    command: 'npm run dev',         // how to start it (omit if you start it yourself)
    cwd: '..',                      // where to run the command: the app's root
    // Extra env for the command. Example: point the app's API base URL at a fake address the mocks answer.
    // env: { VITE_API_URL: 'https://api.demo.example' },
  },
  brand: {
    kicker: 'My App tutorial',      // small label above each title
    accent: '#DF0A0A',              // step badge, kicker and click-ripple colour
  },
  // network: { external: 'block' }, // default: nothing the app sends leaves this machine unless mocked
  // outDir: '../docs/tutorials',    // default: working files + finished videos (git-ignore it)
};

export default config;
