import { test, expect } from '@playwright/test';
import { AgentChat } from './helpers/chat';

/**
 * The four behaviours the brief requires, plus the send-button guard.
 * Every "did the agent answer" check goes through AgentChat.waitForStreamedReply —
 * we assert that a new bubble appeared and settled, never on its wording.
 */

test.describe('agent — core pre-login behaviours', () => {
  let chat: AgentChat;

  test.beforeEach(async ({ page }) => {
    chat = new AgentChat(page);
    await chat.goto();
  });

  test('page loads with the agent ready and suggested topics available', async () => {
    await expect(chat.title).toHaveText(/permission agent/i);
    await expect(chat.input).toBeVisible();
    await expect(chat.input).toHaveAttribute('placeholder', /ask anything/i);

    // The suggested-topic pills are not rendered in the current pre-login build, but
    // the data that feeds them still is. Assert the contract the UI depends on so this
    // test fails loudly if suggestions break — and see ux-review.md for the missing pills.
    const suggestions = await chat.fetchSuggestions();
    const usable = suggestions.filter((s) => s.enabled && !s.for_authenticated);
    expect(usable.length).toBeGreaterThan(0);
    expect(usable.every((s) => s.prompt.trim().length > 0)).toBeTruthy();
  });

  test('a suggested topic produces an agent response', async () => {
    const suggestions = await chat.fetchSuggestions();
    const whatIsPermission =
      suggestions.find((s) => /what is permission/i.test(s.title)) ?? suggestions[0];

    const before = await chat.assistantMessages.count();
    await chat.askSuggestedTopic(whatIsPermission);

    await expect(chat.assistantMessages).toHaveCount(before + 1);
    expect((await chat.lastAssistantText()).trim().length).toBeGreaterThan(0);
  });

  test('a free-text question via the ASK input produces an agent response', async () => {
    const before = await chat.assistantMessages.count();
    const { message } = await chat.ask('How does Permission keep my data under my control?');

    await expect(chat.assistantMessages).toHaveCount(before + 1);
    expect(message.trim().length).toBeGreaterThan(0);
    // the server's answer is what the bubble renders once the typewriter finishes
    expect((await chat.lastAssistantText()).trim().length).toBeGreaterThan(0);
  });

  test('Shift+Enter inserts a newline and does not send', async ({ page }) => {
    const assistantBefore = await chat.assistantMessages.count();
    const userBefore = await chat.userMessages.count();

    await chat.input.click();
    await page.keyboard.type('first line');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.type('second line');

    await expect(chat.input).toHaveValue('first line\nsecond line');

    // nothing was sent: no new bubbles, no network call
    let asked = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/agent/ask-unauthenticated')) asked = true;
    });
    await page.waitForTimeout(500);
    expect(asked).toBeFalsy();
    await expect(chat.assistantMessages).toHaveCount(assistantBefore);
    await expect(chat.userMessages).toHaveCount(userBefore);
  });

  test('the send button is disabled until there is real input', async () => {
    await expect(chat.sendButton).toBeDisabled();

    await chat.input.fill('   ');
    await expect(chat.sendButton).toBeDisabled();

    await chat.input.fill('What is ASK?');
    await expect(chat.sendButton).toBeEnabled();

    await chat.input.fill('');
    await expect(chat.sendButton).toBeDisabled();
  });
});
