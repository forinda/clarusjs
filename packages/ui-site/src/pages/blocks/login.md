---
title: "Login"
group: "Blocks"
order: 10
description: "Sign in with email and password, with errors on their fields and a handler you replace."
layout: "/src/layouts/wide.tscl"
---

# Login

<blockView name="login">

<iframe src="/view/login" title="Login preview" loading="lazy" style="height: 640px"></iframe>

<<< ../../registry/blocks/login/login.tscl

<<< ../../registry/blocks/login/data.ts

<<< ../../registry/card.tscl

<<< ../../registry/field.tscl

<<< ../../registry/button.tscl

</blockView>

## Use it

Copy `login.tscl` into `src/pages/` and `data.ts` beside it, and the components under Code into `src/components/ui/`. Replace `signIn` in `data.ts` with your own: it gets the email and password and returns `{ errors: { password: '…' } }` to show an error on a field, or `{ user }` when it worked.

<needs name="login" />
