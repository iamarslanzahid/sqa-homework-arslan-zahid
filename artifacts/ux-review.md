# UX review — desktop + mobile

Desktop 1440×900 and mobile via Pixel 5 responsive emulation (Chromium).
Evidence: [artifacts/report/ux/](report/ux/). Automated signup is gated by a reCAPTCHA image
challenge, so post-signup was checked on a hand-made account.

## What works

Fast first token; clean bubbles; the agent answers off-topic questions gracefully. Log in /
Sign Up are always visible. Register is short (email + password) with live password-rule
feedback.

## What's rough

- **Cookie notice covers the product.** On mobile first load the OneTrust banner hides the
  entire ASK input and send button. On desktop it overlaps them, and the Accept / Reject
  buttons render on top of each other and the disclaimer text — a layout bug on both.
- **No suggested-topic pills pre-login.** The brief and `/api/agent/suggestions-unauthenticated`
  expect them; the UI shows none. New users get an empty chat, and the greeting text changes
  every reload — no consistent first impression, no scaffold for what to ask.
- **Register on mobile:** the cookie notice renders *inside* the form, semi-transparent, over
  the Password field and Continue button — reads as broken at the trust-sensitive moment.
- **Wasted space:** the conversation is top-aligned; most of a tall viewport is blank.

## Prioritised improvements

1. **Fix the cookie banner overlap, mobile first.** It hides the chat input on first load, so
   new mobile users can't use the core feature — likely a real bounce. Render it as a true
   bottom sheet that never covers the input; fix the button stacking.
2. **Ship the suggested-topic pills pre-login.** The data exists, the UI doesn't show it.
   Pills are the fastest path from "landed" to "asked a good question" — the activation
   event. Render the 6 enabled suggestions as chips above the input and pin the greeting.
3. **De-risk signup.** reCAPTCHA image grid *and* mandatory email verification is two
   hurdles before any value; each drops conversion. Move to invisible reCAPTCHA and let
   users try the agent first, verifying email only on a rewarded action.
4. **Use the empty space.** Most of the viewport is blank — prime room for the pills and a
   one-line "what is this" for cold arrivals. Center the column, fill the top.

## Pre-login vs post-signup / form-factor

_(to complete on the manual account: desktop vs mobile, and what the signed-in agent /
wallet / earning UI adds over pre-login.)_
