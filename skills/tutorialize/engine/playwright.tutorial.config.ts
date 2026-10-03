import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import type { Project } from './core/types.ts';

// Run through cli.ts, which loads the project's tutorialize.config.ts, resolves it, and passes it here as JSON.
const project: Project | null = JSON.parse(process.env.TUTORIAL_PROJECT_JSON ?? 'null');
if (!project) throw new Error('Run recordings with "node cli.ts dry|record|render <slug>", not Playwright directly');

export default defineConfig({
  testDir: './recorder',
  testMatch: /\.record\.ts$/,
  workers: 1,
  outputDir: fileURLToPath(new URL('./test-results', import.meta.url)),
  reporter: 'list',
  // Trace is off by default: a trace records every `fill` value, including any password typed in a
  // flow's setup. Set TUTORIAL_TRACE=1 only while debugging a failing run, then delete the engine's
  // test-results/ folder (it holds the trace.zip).
  use: {
    baseURL: project.app.url,
    trace: process.env.TUTORIAL_TRACE === '1' ? 'retain-on-failure' : 'off',
    ...(project.browser.channel ? { channel: project.browser.channel } : {}),
  },
  webServer: project.app.command ? {
    command: project.app.command,
    cwd: project.app.cwd,
    env: project.app.env,
    url: project.app.url,
    reuseExistingServer: project.app.reuseExistingServer,
    timeout: project.app.startTimeoutMs,
  } : undefined,
});
