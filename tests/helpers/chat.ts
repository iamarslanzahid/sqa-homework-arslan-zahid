import { expect, type Locator, type Page, type Response } from '@playwright/test';

/**
 * One place for every way the suite talks to the agent UI.
 *
 * Why a helper module and not a page-object class hierarchy: there is exactly one
 * screen under test. A class adds ceremony without adding safety. What actually needs
 * protecting is the two brittle spots — the locator for a message bubble (no test id
 * on individual messages yet) and the wait for a streamed reply — so those live here,
 * named, and every spec goes through them. A markup change touches this file, not ten specs.
 */

export const ASK_ENDPOINT = '/api/agent/ask-unauthenticated';
export const SUGGESTIONS_ENDPOINT = '/api/agent/suggestions-unauthenticated';

export type Suggestion = {
  id: string;
  title: string;
  prompt: string;
  for_authenticated: boolean;
  order: number;
  enabled: boolean;
};

export class AgentChat {
  constructor(private readonly page: Page) {}

  // --- locators -------------------------------------------------------------

  get input(): Locator {
    return this.page.getByTestId('agent-chat-input');
  }

  get sendButton(): Locator {
    return this.page.getByTestId('agent-chat-input-send-button');
  }

  get title(): Locator {
    return this.page.getByTestId('ai-page-title');
  }

  /**
   * All assistant message bubbles, oldest first (the opening greeting counts as one).
   *
   * The app renders each turn as a flex row: the assistant's row aligns left
   * (`justify-start`), the user's aligns right (`justify-end`), and the assistant's
   * text lives in `<p>` tags while the user's sits in a `whitespace-pre-wrap` div.
   * There is no per-message test id today, so this pair of getters is the single
   * structural assumption in the suite — deliberately isolated here. If Permission
   * adds `data-testid="agent-message"` this becomes a one-line change and no spec moves.
   */
  get assistantMessages(): Locator {
    return this.page.locator('div.justify-start').filter({ has: this.page.locator('p') });
  }

  get userMessages(): Locator {
    return this.page
      .locator('div.justify-end')
      .filter({ has: this.page.locator('.whitespace-pre-wrap') });
  }

  /** Answer text only — the timestamp is a sibling node, so read the content wrapper. */
  async lastAssistantText(): Promise<string> {
    return (await this.assistantMessages.last().locator('.text-md').first().innerText()).trim();
  }

  // --- actions -------------------------------------------------------------

  async goto(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.dismissCookieBanner();
    await expect(this.input).toBeVisible();
    // The opening greeting arrives a beat after the input renders. Wait for it so any
    // test that snapshots the message count starts from a settled state.
    await expect.poll(() => this.assistantMessages.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  }

  /**
   * OneTrust banner overlays the bottom of the viewport (and the input on mobile).
   * Best-effort: it is not always present and must never fail a test on its own.
   */
  async dismissCookieBanner(): Promise<void> {
    const accept = this.page.getByRole('button', { name: /accept all/i });
    try {
      await accept.click({ timeout: 4000 });
      await accept.waitFor({ state: 'hidden', timeout: 4000 });
    } catch {
      /* no banner this run */
    }
  }

  async fetchSuggestions(): Promise<Suggestion[]> {
    const res = await this.page.request.get(SUGGESTIONS_ENDPOINT);
    expect(res.ok()).toBeTruthy();
    return res.json();
  }

  /**
   * Send a question the way a user would: type into the box, press the send button.
   * Returns the parsed `/ask-unauthenticated` response so a caller can reuse the
   * server's own answer text instead of re-scraping it from the DOM.
   */
  async ask(question: string): Promise<{ message: string; session_id: string }> {
    const before = await this.assistantMessages.count();
    await this.input.fill(question);
    await expect(this.sendButton).toBeEnabled();

    const [response] = await Promise.all([
      this.waitForAskResponse(),
      this.sendButton.click(),
    ]);

    await this.waitForStreamedReply(before);
    return response.json();
  }

  /**
   * Click a suggested-topic pill if the UI is rendering them; otherwise fall back to
   * sending the topic's canonical prompt. Same user intent either way, and the suite
   * keeps working through the current state where pills are not shown pre-login.
   */
  async askSuggestedTopic(topic: Suggestion): Promise<{ message: string; session_id: string }> {
    const pill = this.page.getByRole('button', { name: topic.title, exact: false });
    if (await pill.count()) {
      const before = await this.assistantMessages.count();
      const [response] = await Promise.all([
        this.waitForAskResponse(),
        pill.first().click(),
      ]);
      await this.waitForStreamedReply(before);
      return response.json();
    }
    return this.ask(topic.prompt);
  }

  waitForAskResponse(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.url().includes(ASK_ENDPOINT) && r.request().method() === 'POST' && r.status() === 200,
      { timeout: 45_000 },
    );
  }

  /**
   * The network reply is a single JSON blob; the visible answer then types itself in.
   * So: wait for one new assistant bubble, then poll its length until it stops growing
   * for two consecutive reads. No fixed sleeps, no assertion on the text itself.
   */
  async waitForStreamedReply(previousCount: number): Promise<string> {
    await expect(this.assistantMessages).toHaveCount(previousCount + 1, { timeout: 30_000 });

    const content = this.assistantMessages.nth(previousCount).locator('.text-md').first();
    let last = -1;
    let stableReads = 0;
    await expect
      .poll(
        async () => {
          const len = (await content.innerText()).trim().length;
          stableReads = len === last && len > 0 ? stableReads + 1 : 0;
          last = len;
          return stableReads;
        },
        { timeout: 30_000, intervals: [400] },
      )
      .toBeGreaterThanOrEqual(2);

    return (await content.innerText()).trim();
  }
}
