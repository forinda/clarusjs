---
title: "Login"
group: "Blocks"
order: 10
description: "Sign in with email and password, with errors on their fields and a handler you replace."
---

# Login

<p class="lead">Sign in with email and password, with errors on their fields and a handler you replace.</p>

<blockPreview name="login">
  <iframe src="/view/login" title="Login preview" loading="lazy" style="height: 640px"></iframe>
</blockPreview>

## Files

Copy the page into `src/pages/` as `login.tscl`, and `data.ts` beside it. Replace `signIn` in `data.ts` with your own: it gets the email and password, and returns `{ errors: { password: '…' } }` to show an error on a field, or nothing when it worked.

<<< ../../registry/blocks/login/login.tscl

<<< ../../registry/blocks/login/data.ts

## Needs

<needs name="login" />
