export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} — set it in tutorials/.env.tutorial`);
  return value;
}
