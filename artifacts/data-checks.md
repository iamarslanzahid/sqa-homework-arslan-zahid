# Data-layer reasoning

No DB access. This is inferred from what the client exposes: `POST /api/agent/ask-unauthenticated`
returns `{ message, session_id }` (a fresh UUID per anonymous conversation);
`GET /api/agent/suggestions-unauthenticated` returns rows with `id, title, prompt,
for_authenticated, order, enabled, created_at, updated_at` — effectively a table dump; the
register screen collects email + password, promises a verification email, and runs reCAPTCHA.

## Expected writes

**(a) User sends a message to the agent**

| table | key columns |
|---|---|
| `agent_session` | `id` (uuid), `user_id` (nullable — null pre-login), `created_at`, `client_ip_hash`, `user_agent` |
| `agent_message` | `id`, `session_id` → `agent_session.id`, `role` ('user'\|'assistant'), `content`, `created_at`, `model`, `prompt_tokens`, `completion_tokens`, `latency_ms`, `suggestion_id` (nullable → `agent_suggestion.id` when the turn came from a pill) |
| `agent_suggestion` | the row set already visible via the API |
| `analytics_event` | `ai_agent_request` with `session_id`, `distinct_id`, `ts` (GA + PostHog fire this) |

**(b) User creates an account**

| table | key columns |
|---|---|
| `user` | `id`, `email` (unique, lower), `password_hash`, `status`, `created_at`, `email_verified_at` (null until verified) |
| `email_verification_token` | `token_hash`, `user_id`, `expires_at`, `consumed_at` |
| `wallet` | `id`, `user_id` (unique), `ask_balance` (default 0), `created_at` |
| `analytics_event` | `sign_up_started` / `sign_up_completed` |

Pre-login `agent_session` rows should be claimed (`user_id` back-filled) when the same client
signs in, so a new user keeps their first conversation.

## Verification queries

```sql
-- 1. No orphaned messages: every message belongs to a real session.
SELECT m.id
FROM agent_message m
LEFT JOIN agent_session s ON s.id = m.session_id
WHERE s.id IS NULL;

-- 2. Every user turn got an assistant reply in the same session within 60s
--    (catches dropped / errored generations).
SELECT u.id AS unanswered_user_message
FROM agent_message u
WHERE u.role = 'user'
  AND NOT EXISTS (
    SELECT 1 FROM agent_message a
    WHERE a.session_id = u.session_id
      AND a.role = 'assistant'
      AND a.created_at BETWEEN u.created_at AND u.created_at + INTERVAL '60 seconds'
  );

-- 3. New accounts are consistent: exactly one wallet, balance not negative,
--    wallet not created before the user, verified users actually have a timestamp.
SELECT us.id, us.email
FROM "user" us
LEFT JOIN wallet w ON w.user_id = us.id
WHERE us.created_at > now() - INTERVAL '7 days'
GROUP BY us.id, us.email, us.status
HAVING COUNT(w.id) <> 1
    OR MIN(w.ask_balance) < 0
    OR MIN(w.created_at) < us.created_at
    OR (us.status = 'active' AND us.email_verified_at IS NULL);
```

## Downstream pipeline integrity check

The analytics warehouse ingests `agent_message`. Add a not-null / range assertion on load:
reject the batch if `completion_tokens = 0` on an `assistant` row with non-empty `content`,
or if `created_at` is in the future or precedes its `agent_session.created_at` — that pattern
means a broken producer or clock skew, and it would silently corrupt any "messages per
session" or cost-per-conversation metric built on top.
