import { test, expect } from '@playwright/test';
import { AgentChat } from './helpers/chat';

/**
 * The two "your call" tests. Chosen because they cover the parts of the pre-login
 * experience most likely to break on a routine change and most visible to a user:
 * the path to signing in, and whether the agent is actually usable on a phone.
 */

test('Log in and Sign Up lead to the auth experience', async ({ page }) => {
  const chat = new AgentChat(page);
  await chat.goto();

  await expect(page.getByTestId('log-in-button')).toBeVisible();
  await expect(page.getByTestId('sign-up-button')).toBeVisible();

  await page.getByTestId('sign-up-button').click();
  await expect(page).toHaveURL(/register|sign-?up/i, { timeout: 15_000 });
  await expect(page.getByText(/create your account/i)).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first(),
  ).toBeVisible({ timeout: 15_000 });
});

test('mobile: the agent is usable and the layout does not overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'runs in the mobile project only');

  const chat = new AgentChat(page);
  await chat.goto();

  // no horizontal scroll — the classic responsive break
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page scrolls sideways on mobile').toBeLessThanOrEqual(1);

  // the input and send control are reachable, not clipped off-screen or under the banner
  await expect(chat.input).toBeInViewport();
  await chat.input.fill('What is passive earning?');
  await expect(chat.sendButton).toBeInViewport();

  const before = await chat.assistantMessages.count();
  await chat.ask('What is passive earning?');
  await expect(chat.assistantMessages).toHaveCount(before + 1);
});
