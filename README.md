# sqa-homework-arslan-zahid

Automated suite + non-deterministic-answer validation for the pre-login agent at
**[ask.permission.ai](https://ask.permission.ai)**, plus a UX review and data-layer reasoning.

## Setup

```bash
# 1. browser suite
npm ci
npx playwright install --with-deps chromium

# 2. Part 2 LLM eval (optional locally; runs in CI)
pip install -r evals/requirements.txt
cp .env.example .env      # then add a judge key — framework is free, the judge is the only cost:
#   free : Google Gemini free tier -> https://aistudio.google.com/apikey   (GOOGLE_API_KEY, default)
#   free : local Ollama, no key    -> DEEPEVAL_JUDGE=ollama  (needs a running ollama daemon)
#   paid : DEEPEVAL_JUDGE=anthropic|openai  with the matching key

# 3. run everything (browser tests, then the eval). Reads .env automatically.
npm test

# just the browser tests / just mobile / open the report
npm run test:pw
npm run test:mobile
npm run report
```

`npm test` runs the 8 Playwright tests, then the DeepEval check. The eval **skips, not
fails**, when no judge is configured, so step 2 is optional to get a green run. For CI, add
`GOOGLE_API_KEY` as a repository secret (Settings → Secrets and variables → Actions).

## Test strategy (TL;DR)

- **Covered:** page + agent ready; suggested-topic reply; free-text reply; Shift+Enter
  newline; send-button enable/disable; empty-input safety; the "What is Permission?" answer
  held to quality rules (Part 2); auth navigation; mobile viewport (no overflow, input usable,
  agent answers).
- **Skipped on purpose:** exact response text and timing (flaky by design — the trap);
  post-login (brief says automation stays pre-login); Log in happy path (needs real creds);
  visual regression, perf, a11y audit (out of scope for 8 tests).
- **Why:** the four required behaviours plus the smallest set that catches a regression a
  user would feel — not eight shallow smoke checks.

## Key decisions

- **Waiting:** `/api/agent/ask-unauthenticated` returns the whole answer as one JSON blob and
  the UI *types it out*. So: `waitForResponse` on that POST, then poll the new bubble's length
  until stable for two reads. No sleeps, no assertion on wording — only that a new bubble
  appeared and settled.
- **Locators:** `getByTestId` for the six hooks the app already ships; roles/text for nav.
  Messages have **no** test id, so the one structural assumption (assistant = left row with
  `<p>`, user = `whitespace-pre-wrap`) lives in **one** getter pair in `tests/helpers/chat.ts`
  — a markup change there is a one-line fix, and `data-testid="agent-message"` would drop in.
- **Framework:** Playwright + TypeScript — fastest path for a live-site suite; built-in HTML
  reporter, no Allure server for 8 tests.
- **Projects:** Chromium desktop + Pixel 7 (also Chromium — one browser to install). Mobile
  re-runs only the viewport test, so the suite stays at 8.
- **Cookie widget:** a MutationObserver removes the OneTrust nodes on sight — third-party
  furniture that overlays the input and was the only source of flake. 5× clean after.
- **Eval:** DeepEval (pytest-native; Promptfoo's native SQLite dep would not build here), one
  G-Eval rubric, swappable + free-by-default judge.
- **Missing pills:** the brief's suggested-topic pills do not render pre-login now (API still
  returns them). Test 1 asserts the suggestions API contract, not a brittle pill locator;
  `artifacts/ux-review.md` files it as a finding.

## AI disclosure

Built with Claude Code under direction; full disclosure in
[artifacts/ai-workflow.md](artifacts/ai-workflow.md).

## Next steps (with 1–2 more days)

- Golden-set regression: 15–20 prompts × rubric, tracked over time to catch answer drift.
- Post-login suite once there is a test account + seedable state.
- Make the CI workflow a required check and add axe-core a11y checks to landing + register.
- Ask Permission to add `data-testid` to message bubbles and restore the topic pills.

## Submission checklist

- [x] Repo named `sqa-homework-arslan-zahid`, default branch `main`
- [ ] Submitted as a new email, subject "Senior Quality Assurance Engineer – Take-Home Submission"
- [x] README has exact Setup + run commands (verified from a clean clone)
- [x] README ≤ 500 words (excluding commands/checkboxes)
- [x] Max 8 tests; all 4 required behaviours covered
- [x] `artifacts/assertions.md` (≤ 300 words)
- [x] At least one assertion in an LLM-eval framework, running as part of the suite
- [ ] `artifacts/ux-review.md` (≤ 400 words, desktop + mobile, post-signup, 3–5 prioritised)
- [x] `artifacts/data-checks.md` (≤ 300 words + SQL)
- [x] `artifacts/ai-workflow.md` (≤ 300 words, all 4 questions)
- [x] `artifacts/report/` included
- [ ] `artifacts/demo.mp4` (60–90 sec, narrated)
- [x] Commit history shows how the work evolved
