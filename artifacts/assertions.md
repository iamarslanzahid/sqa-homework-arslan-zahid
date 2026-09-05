# Validating a non-deterministic answer

Topic: **"What is Permission?"** (the first suggested pill's prompt). The agent streams a
different answer every run, so nothing asserts on exact text or timing.

## Waiting

`/api/agent/ask-unauthenticated` returns the whole answer in one JSON blob; the UI then
types it out. So the wait is two steps ([tests/helpers/chat.ts](../tests/helpers/chat.ts),
`waitForStreamedReply`): wait for that POST response, then poll the new bubble's text length
until it is non-zero and unchanged for two consecutive reads. No fixed sleeps.

## What I assert

Rules live in [tests/helpers/assertions.ts](../tests/helpers/assertions.ts) (`checkPermissionAnswer`)
and run against **both** the API text and the rendered bubble, in
[tests/agent-assertions.spec.ts](../tests/agent-assertions.spec.ts):

- **Length band** 40–2000 chars — rules out an empty/dropped stream and a runaway essay.
- **≥ 3 domain terms** from {permission, data, earn, ASK, token, wallet, agent, own, control,
  privacy, reward, broker} — on-topic on any phrasing, fails on an answer about something else.
- **Names "Permission"** explicitly.
- **No error/refusal signals** ("something went wrong", "I can't help", "as an AI language
  model", leaked `undefined`/`[object Object]`).
- **Prose, not plumbing** — no `< > { }`, code fences, or JSON keys bleeding into the UI.

## What I deliberately do NOT assert

Exact wording; sentence or paragraph count; whether it ends with a follow-up question; the
order concepts appear in; specific numbers (ASK price, % rewards) — the model should *not* be
committing to those and pinning them would make the test both flaky and wrong. Response
latency — third-party model, not our SLA to assert here.

## LLM-eval wiring — DeepEval (G-Eval), judged by Claude

[evals/test_permission_answer_eval.py](../evals/test_permission_answer_eval.py) runs in the
suite via `npm test` (skips cleanly without `ANTHROPIC_API_KEY`). Chosen over Promptfoo
because it is pytest-native — no extra runner — and its native SQLite dep would not build on
the dev machine. One G-Eval metric grades a live answer on: correct explanation of Permission
**and no invented specifics** (token price, guaranteed earnings, capabilities it lacks),
threshold 0.7.

It catches what the string checks cannot: a fluent, keyword-rich answer that is confidently
**wrong** — e.g. "Permission pays $500/month guaranteed" passes every assertion above and
fails the rubric.
