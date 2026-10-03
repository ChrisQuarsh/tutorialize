import type { TutorialConfig } from './types.ts';

const config: TutorialConfig = {
  app: {
    url: 'http://localhost:4321',
    command: 'node server.mjs',
    cwd: '..',
    env: { PORT: '4321' },
  },
  brand: { kicker: 'Notes tutorial', accent: '#2357d9' },
};

export default config;
