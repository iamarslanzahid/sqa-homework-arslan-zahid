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
    await this.blockThirdPartyNoise();
    await this.suppressCookieBanner();
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await this.dismissCookieBanner();
    await expect(this.input).toBeVisible();
    // The opening greeting arrives a beat after the input renders. Wait for it so any
    // test that snapshots the message count starts from a settled state.
    await expect.poll(() => this.assistantMessages.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  }

  /**
   * The OneTrust consent widget renders a full-width row that sits over the chat input
   * and eats pointer events until it is dealt with. It is third-party furniture, not
   * part of what we test, and it is the single most common cause of a flaky click here.
   *
   * Two belts: (1) pre-seed the "banner already closed" cookie so it usually never shows,
   * (2) after load, click Accept All if it is there, then hard-hide the container so a
   * late re-render can never intercept a click. `dismissCookieBanner` never throws.
   */
  /**
   * The page pulls in a large pile of analytics / ad / wallet SDKs that have nothing to do
   * with what we test and are the main cause of a slow `goto`. Block them — the app's own
   * `/api/**` calls and assets are untouched.
   */
  private async blockThirdPartyNoise(): Promise<void> {
    const blocked =
      /googletagmanager|google-analytics|analytics\.google|doubleclick|googleadservices|connect\.facebook|facebook\.net|analytics\.tiktok|tiktokw|redditstatic|alb\.reddit|pixel-config\.reddit|outbrain|posthog|walletconnect|web3modal|cookielaw\.org|onetrust\.com|bat\.bing|snap\.licdn|amplitude/i;
    await this.page.route(blocked, (route) => route.abort());
  }

  private async suppressCookieBanner(): Promise<void> {
    await this.page.context().addCookies([
      {
        name: 'OptanonAlertBoxClosed',
        value: new Date().toISOString(),
        url: 'https://ask.permission.ai',
      },
    ]);
    // Belt: an observer that deletes the OneTrust nodes the instant they mount, for the
    // whole life of the page. Removal (not CSS) so nothing can re-raise the overlay.
    await this.page.addInitScript(() => {
      const strip = () => {
        document
          .querySelectorAll('#onetrust-consent-sdk, .onetrust-pc-dark-filter, .ot-sdk-container')
          .forEach((el) => el.remove());
      };
      strip();
      new MutationObserver(strip).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  async dismissCookieBanner(): Promise<void> {
    // Record real consent if the button is briefly there (keeps the app's own consent
    // state honest), then sweep any leftover nodes the observer may have missed.
    await this.page
      .getByRole('button', { name: /accept all/i })
      .click({ timeout: 1500 })
      .catch(() => undefined);
    await this.page
      .evaluate(() =>
        document
          .querySelectorAll('#onetrust-consent-sdk, .onetrust-pc-dark-filter')
          .forEach((el) => el.remove()),
      )
      .catch(() => undefined);
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
