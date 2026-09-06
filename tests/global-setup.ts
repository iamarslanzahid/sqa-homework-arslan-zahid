/**
 * One upfront reachability check. The whole suite hits a live external site, so if the
 * network or DNS is having a moment, fail once here with a clear message instead of
 * letting every test die with a cryptic `ERR_NAME_NOT_RESOLVED`.
 */
import { request } from '@playwright/test';

export default async function globalSetup() {
  const ctx = await request.newContext();
  try {
    const res = await ctx.get('https://ask.permission.ai/', { timeout: 30_000 });
    if (!res.ok()) throw new Error(`ask.permission.ai responded ${res.status()}`);
  } catch (err) {
    throw new Error(
      `Cannot reach https://ask.permission.ai (${(err as Error).message}). ` +
        'Check your connection / DNS and that the site is up, then re-run.',
    );
  } finally {
    await ctx.dispose();
  }
}
