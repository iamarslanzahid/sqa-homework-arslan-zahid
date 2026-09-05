# Data-layer reasoning

No DB access. Inferred from what the client exposes: `POST /api/agent/ask-unauthenticated`
returns `{ message, session_id }` (fresh UUID per anonymous conversation);
`GET /api/agent/suggestions-unauthenticated` returns rows with `id, title, prompt,
for_authenticated, order, enabled, created_at, updated_at` — effectively a table dump.
Post-signup: a **100 ASK signup grant** lands as *pending*, the wallet shows a 4,900-ASK
withdrawal floor and an "Earning Activity" ledger, referrals pay "1000 ASK on verified
signup", and the profile stores email (verified flag), phone, country, DOB, gender.

## Expected writes

**(a) User sends a message to the agent**

| table | key columns |
|---|---|
| `agent_session` | `id` (uuid), `user_id` (nullable — null pre-login), `created_at`, `client_ip_hash`, `user_agent` |
| `agent_message` | `id`, `session_id` FK, `role` ('user'\|'assistant'), `content`, `created_at`, `model`, `completion_tokens`, `latency_ms`, `suggestion_id` (nullable, set when the turn came from a pill) |
| `agent_suggestion` | the rows already visible via the API |
| `analytics_event` | `ai_agent_request` — `session_id`, `distinct_id`, `ts` (GA + PostHog) |

**(b) User creates an account**

| table | key columns |
|---|---|
| `user` | `id`, `email` (unique, lower), `password_hash`, `status`, `created_at`, `email_verified_at`, `phone`, `country`, `dob`, `id_verification_status` |
| `email_verification_token` | `token_hash`, `user_id`, `expires_at`, `consumed_at` |
| `wallet` | `id`, `user_id` (unique), `settled_ask`, `pending_ask`, `created_at` |
| `ask_transaction` | `id`, `user_id`, `type` ('signup_grant'\|'referral'\|'enrichment_task'\|'withdrawal'), `amount`, `status` ('pending'\|'settled'), `created_at` |
| `referral` | `referrer_id`, `referred_user_id`, `reward_amount`, `status` (paid once referred user is verified) |

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

-- 3. New accounts are consistent: exactly one wallet, no negative balances, wallet
--    not older than the user, and the wallet's pending_ask equals the sum of its
--    still-pending transactions (the 100 ASK grant should reconcile).
SELECT us.id, us.email
FROM "user" us
JOIN wallet w ON w.user_id = us.id
WHERE us.created_at > now() - INTERVAL '7 days'
GROUP BY us.id, us.email, w.pending_ask, w.settled_ask, w.created_at
HAVING COUNT(w.id) <> 1
    OR w.settled_ask < 0 OR w.pending_ask < 0
    OR w.created_at < MIN(us.created_at)
    OR w.pending_ask <> COALESCE((
         SELECT SUM(t.amount) FROM ask_transaction t
         WHERE t.user_id = us.id AND t.status = 'pending'), 0);
```

## Downstream pipeline integrity check

The analytics warehouse ingests `agent_message`. Add a not-null / range assertion on load:
reject the batch if `completion_tokens = 0` on an `assistant` row with non-empty `content`,
or if `created_at` is in the future or precedes its `agent_session.created_at` — that pattern
means a broken producer or clock skew, and it would silently corrupt any "messages per
session" or cost-per-conversation metric built on top.
