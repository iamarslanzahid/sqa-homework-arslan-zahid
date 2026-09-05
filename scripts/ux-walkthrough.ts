/**
 * Not part of the 8 tests. A throwaway helper that signs up with a disposable inbox and
 * screenshots the pre-login and post-signup experience on desktop and mobile, so the
 * observations in artifacts/ux-review.md are grounded in captured evidence.
 *
 *   npm run ux:walkthrough
 *
 * Signup runs reCAPTCHA and needs email verification. If the automated run is challenged,
 * it stops and prints what to do by hand — it will not pretend it got in.
 */
import { chromium, devices, type Browser, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Sibling of artifacts/report/ — the Playwright HTML reporter wipes its own outputFolder.
const OUT = path.join('artifacts', 'ux');
const MAILTM = 'https://api.mail.tm';

type Inbox = { address: string; password: string; token: string };

async function createInbox(): Promise<Inbox> {
  const domains = await (await fetch(`${MAILTM}/domains`)).json();
  const domain = domains['hydra:member'][0].domain;
  const address = `perm.qa.${Date.now()}@${domain}`;
  const password = `Pw!${Math.random().toString(36).slice(2)}A9`;
  await fetch(`${MAILTM}/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, password }),
  });
  const token = (
    await (
      await fetch(`${MAILTM}/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, password }),
      })
    ).json()
  ).token;
  return { address, password, token };
}

async function waitForVerifyLink(inbox: Inbox, timeoutMs = 90_000): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const list = await (
      await fetch(`${MAILTM}/messages`, { headers: { authorization: `Bearer ${inbox.token}` } })
    ).json();
    const first = list['hydra:member']?.[0];
    if (first) {
      const full = await (
        await fetch(`${MAILTM}/messages/${first.id}`, {
          headers: { authorization: `Bearer ${inbox.token}` },
        })
      ).json();
      const body: string = full.text ?? full.html?.join(' ') ?? '';
      const link = body.match(/https?:\/\/[^\s"'<>]*(verify|confirm|token)[^\s"'<>]*/i)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log(`  saved ${name}.png`);
}

async function tour(browser: Browser, label: string, contextOpts: object, inbox: Inbox) {
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  await page.goto('https://ask.permission.ai/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /accept all/i }).click({ timeout: 4000 }).catch(() => {});
  await shoot(page, `${label}-01-landing-prelogin`);

  await page.getByTestId('sign-up-button').click();
  await page.waitForURL(/register/i, { timeout: 15_000 });
  await shoot(page, `${label}-02-register`);

  await page.locator('input[type="email"], input[name="email"]').first().fill(inbox.address);
  await page.locator('input[type="password"], input[name="password"]').first().fill(inbox.password);
  await shoot(page, `${label}-03-register-filled`);
  await page.getByRole('button', { name: /continue|sign up|create/i }).click();

  await page.waitForTimeout(4000);
  await shoot(page, `${label}-04-post-submit`);
  const challenged = await page
    .locator('iframe[src*="recaptcha"][src*="bframe"], iframe[title*="recaptcha" i]')
    .last()
    .isVisible()
    .catch(() => false);
  if (challenged) {
    console.log(
      `\n[${label}] reCAPTCHA image challenge — automated signup stops here (as expected).\n` +
        '  Sign up by hand and pass creds/screenshots for the post-login part of ux-review.md.\n',
    );
    await context.close();
    return;
  }

  const link = await waitForVerifyLink(inbox);
  if (!link) {
    console.log(`\n[${label}] no verification email in 90s — stopping.\n`);
    await context.close();
    return;
  }
  await page.goto(link, { waitUntil: 'networkidle' });
  await shoot(page, `${label}-05-post-verify`);

  // Post-login wander: the agent, then whatever the primary nav exposes (wallet / earn).
  await page.goto('https://ask.permission.ai/', { waitUntil: 'networkidle' });
  await shoot(page, `${label}-06-agent-postlogin`);
  for (const name of ['wallet', 'earn', 'rewards', 'profile', 'account', 'data']) {
    const link = page.getByRole('link', { name: new RegExp(name, 'i') }).first();
    if (await link.isVisible({ timeout: 1500 }).catch(() => false)) {
      await link.click().catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
      await shoot(page, `${label}-07-${name}`);
    }
  }
  await context.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const inbox = await createInbox();
  console.log(`disposable inbox: ${inbox.address}`);

  const browser = await chromium.launch();
  await tour(browser, 'desktop', { viewport: { width: 1440, height: 900 } }, inbox);
  await tour(browser, 'mobile', { ...devices['Pixel 5'] }, inbox);
  await browser.close();
  console.log(`\nscreenshots in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
