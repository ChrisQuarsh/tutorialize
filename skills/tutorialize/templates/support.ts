import type { Page } from '@playwright/test';

// Helpers shared by this app's flows. Adjust the locators to your app.

/** A value from tutorials/.env.tutorial, e.g. the demo account's password. Never hard-code secrets in flows. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}: set it in tutorials/.env.tutorial`);
  return value;
}

/** Off-camera sign-in with the demo account. Use it as a flow's `setup`. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(requireEnv('TUTORIAL_USER_EMAIL'));
  await page.getByLabel('Password', { exact: true }).fill(requireEnv('TUTORIAL_USER_PASSWORD'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}

/** The whole toast card, so a zoom frames it in full. */
export const toast = (p: Page, text: string | RegExp) => p.getByRole('status').filter({ hasText: text });
