# AI workflow

## Tools

**Claude Code (Sonnet)** as the main tool. Picked over Copilot/Cursor because this task is a
loop, not autocomplete: probe the live site, write a test, run it against `ask.permission.ai`,
read the failure, fix, repeat. An agent that runs the suite and reads its own traces closes
that loop; an inline completion tool cannot.

## Generated vs. corrected

AI-drafted: the Playwright scaffold, spec skeletons, the DeepEval file, the CI YAML. I
directed and rewrote the parts that carry the grade:

- **Waiting strategy** — probe the network *before* writing any wait. That is how we found
  `/ask-unauthenticated` returns one atomic JSON response (not SSE) and the "streaming" is a
  client-side typewriter. The wait was built around that.
- **Cookie handling** — the first two tries (accept-click, then a `display:none` override)
  still flaked; pushed to a MutationObserver that removes the OneTrust nodes. Verified with 5
  clean runs, not one.
- **The 8 tests and the assertions** — chosen by me.

## One thing the AI got wrong

Its first locator for user messages filtered for a `<p>` element. Probing the DOM showed user
bubbles use `div.whitespace-pre-wrap` and only the assistant uses `<p>` — it would have
matched nothing. Fixed in `tests/helpers/chat.ts`. It also reached for `retries` to hide the
cookie flake; I rejected that and fixed the root cause.

## Built by hand / not delegated

Test selection, what to assert (and not assert) on a non-deterministic answer, and the call
to treat the missing topic pills as a UX finding rather than force a brittle assertion. That
is judgment, and it is the point of the exercise.
