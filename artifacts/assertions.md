# Validating a non-deterministic answer

Topic: **"What is Permission?"** (the first suggested pill's prompt). The answer streams and
differs every run, so nothing asserts on exact text or timing.

## Waiting

`/api/agent/ask-unauthenticated` returns the whole answer as one JSON blob; the UI then types
it out. So `waitForStreamedReply` ([tests/helpers/chat.ts](../tests/helpers/chat.ts)) waits
for that POST response, then polls the new bubble's length until it is non-zero and unchanged
for two reads. No fixed sleeps.

## What I assert

`checkPermissionAnswer` ([tests/helpers/assertions.ts](../tests/helpers/assertions.ts)),
applied to both the API text and the rendered bubble
([tests/agent-assertions.spec.ts](../tests/agent-assertions.spec.ts)):

- **Length 40–2000 chars** — rules out a dropped stream and a runaway essay.
- **≥ 3 domain terms** from a 12-word set (permission, data, earn, ASK, wallet, own, …) —
  on-topic on any phrasing, fails on an off-topic answer.
- **Names "Permission"**.
- **No error/refusal signals** ("something went wrong", "I can't help", leaked `undefined`).
- **Prose, not plumbing** — no `<>{}`, code fences, or JSON keys in rendered text.

## What I deliberately do NOT assert

Exact wording; sentence count; whether it ends with a follow-up question; concept order;
specific numbers (ASK price, % rewards) — the model should not commit to those, and pinning
them would be flaky *and* wrong. Latency — a third-party model's behaviour, not our SLA.

## LLM-eval wiring — DeepEval G-Eval

[evals/test_permission_answer_eval.py](../evals/test_permission_answer_eval.py) runs inside
`npm test` and skips cleanly when no judge is configured. One G-Eval metric grades a live
answer on: correct explanation of Permission **and no invented specifics** (token price,
guaranteed earnings, capabilities it lacks), threshold 0.7. The judge is swappable
(`DEEPEVAL_JUDGE`) — default is Google Gemini's free tier; local Ollama also works with no key.

Chosen over Promptfoo: pytest-native, and Promptfoo's native SQLite dep would not build here.
It catches what string checks cannot — a fluent, keyword-rich answer that is confidently
**wrong** ("Permission pays $500/month guaranteed" passes every assertion above, fails the
rubric).
