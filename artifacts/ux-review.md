# UX review — desktop + mobile

Desktop 1440×900 and mobile via Pixel 7 emulation. Pre-login evidence:
[artifacts/ux/](ux/). Signup and login are both behind a reCAPTCHA image challenge, so the
signed-in walk was manual.

## Pre-login

The agent works well — fast first token, clean bubbles, graceful off-topic. Two problems: the
OneTrust cookie banner is fixed over the ASK input (on mobile it fully hides the input + send
button on first load), and the **suggested-topic pills never render pre-login** though the
suggestions API still returns them — a new visitor gets an empty chat and a greeting that
changes every reload.

## Post-signup

Better: the pills appear, personalised ("Check MY ASK Balance", "Withdraw ASK Tokens"), and a
real app shell arrives — Wallet with an Earning Activity ledger, Data Enrichment Hub,
Referrals, Account Settings.

Rough (both):

- **Withdrawal floor as the headline:** a new user sees "you'll need at least 4,900 ASK"
  against a 100 ASK balance (2%), explained only as "transfer restrictions".
- **Dead-end CTA:** "Withdraw ASK Tokens" is a suggested topic *and* a wallet button disabled
  at 100 ASK.
- **Earning is a chore:** Data Enrichment Hub is a flat ~15-item interest checklist — no
  grouping, no progress, no stated payout.
- **Label drift:** "Check MY ASK Balance" casing; pill "Withdraw ASK Tokens" vs button
  "Withdraw ASK"; "ID Verification: Not Verified" with no hint what it unlocks.

## Worse on mobile

The floating support-chat bubble overlaps content — it covers the "＋" on Add .ASK Domain and
hides "Twitter Handle" on the profile (it's clear of content on desktop). The **referral card
is dropped entirely**, not collapsed — the "Get 1000 ASK" share link is desktop-only, missing
on the form factor people share from.

## Prioritised improvements

1. **Cookie banner off the input, mobile first.** It blocks the core action for new mobile
   users — a likely bounce. A bottom sheet that never covers the input.
2. **Ship the pills pre-login.** The data exists; pills are the shortest path from landing to
   a good first question — the activation moment. Pin the greeting.
3. **Reframe the withdrawal floor** as reachable milestones with per-action payouts, not a 2%
   bar to a 4,900 wall — a day-one retention lever.
4. **Restore mobile referrals and fix the chat-bubble overlap** — a growth channel and real
   click targets lost for near-zero effort.
