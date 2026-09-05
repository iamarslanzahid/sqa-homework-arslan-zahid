import { test, expect } from '@playwright/test';
import { AgentChat } from './helpers/chat';
import { checkPermissionAnswer, failedChecks } from './helpers/assertions';

/**
 * Part 2 — validating a non-deterministic response.
 * Topic: "What is Permission?". We run the real ask twice (once through the UI, once
 * through the API) and hold both answers to the same rules in helpers/assertions.ts.
 */

test.describe('agent — "What is Permission?" answer quality', () => {
  test('the rendered answer passes every reasonable-answer check', async ({ page }) => {
    const chat = new AgentChat(page);
    await chat.goto();

    const suggestions = await chat.fetchSuggestions();
    const topic =
      suggestions.find((s) => /what is permission/i.test(s.title)) ?? suggestions[0];

    const { message } = await chat.askSuggestedTopic(topic);
    const rendered = await chat.lastAssistantText();

    for (const source of [
      { label: 'api', text: message },
      { label: 'rendered', text: rendered },
    ]) {
      const failures = failedChecks(checkPermissionAnswer(source.text));
      expect(
        failures,
        `${source.label} answer failed: ${failures.map((f) => `${f.name} (${f.detail})`).join('; ')}\n---\n${source.text}`,
      ).toEqual([]);
    }
  });
});
