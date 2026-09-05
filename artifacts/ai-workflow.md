# AI workflow

## Tools

**Claude Code (Sonnet)** as the main tool, plus Claude for rubber-ducking assertion design.
Picked over Copilot/Cursor because this task is a loop, not autocomplete: probe the live
site, write a test, run it against `ask.permission.ai`, read the failure, fix, repeat. An
agent that can run the suite and read traces itself closes that loop; an inline completion
tool cannot.

## Generated vs. corrected

AI-generated first drafts: the Playwright scaffold, spec skeletons, the DeepEval file, the CI
YAML, this repo's boilerplate. I directed and rewrote the parts that carry the grade:

- **Waiting strategy** — I had it probe the network before writing any wait. That is how we
  found `/ask-unauthenticated` is one atomic JSON response, not SSE, and that the "streaming"
  is a client-side typewriter. The wait was rewritten around that fact.
- **Cookie handling** — the first two attempts (accept-click, then a `display:none`
  override) still flaked; I pushed until it was a MutationObserver that removes the OneTrust
  nodes. Verified with 5 consecutive clean runs, not one.
- **The 8 tests and the assertion set** — chosen by me. See README and assertions.md.

## One thing the AI got wrong

Its first pass located user messages by filtering for a `<p>` element. Probing the DOM showed
user bubbles render in a `div.whitespace-pre-wrap` and only the assistant uses `<p>` — the
locator would have quietly matched nothing. Fixed in `tests/helpers/chat.ts`.

It also leaned toward keeping `retries` to paper over the cookie flake; I rejected that and
fixed the root cause.

## Built by hand / not delegated

Test selection, what to assert (and not assert) on a non-deterministic answer, and the call
to treat the missing suggested-topic pills as a UX finding instead of forcing a brittle
assertion. Those are judgment, and they are the point of the exercise.
