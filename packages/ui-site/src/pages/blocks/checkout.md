---
title: "Checkout"
group: "Blocks"
order: 20
description: "A cart with live totals beside three steps, contact, shipping and payment, checked by Zod, with a handler you replace."
layout: "/src/layouts/wide.tscl"
---

# Checkout

<blockView name="checkout">

<iframe src="/view/checkout" title="Checkout preview" loading="lazy" style="height: 960px"></iframe>

<<< ../../registry/blocks/checkout/checkout.tscl

<<< ../../registry/blocks/checkout/checkout-form.tscl

<<< ../../registry/blocks/checkout/data.ts

<<< ../../registry/field.tscl

<<< ../../registry/input.tscl

<<< ../../registry/button.tscl

<<< ../../registry/separator.tscl

<<< ../../registry/select.css

<<< ../../registry/toast.css

</blockView>

## Use it

Copy `checkout.tscl` into `src/pages/`, `checkout-form.tscl` and `data.ts` beside it, and the components under Code into `src/components/ui/`. Install `zod` (the rules are a Zod schema per step). In `data.ts`, put your cart in `sampleCart` (or load it), set `currency`, `shippingCents` and `taxRate`, and replace `placeOrder` with your own: it gets the order with its lines, and returns `{ errors: { card: '…' } }` to show an error on a field, or `{ id }` when it worked. A toast says which; the page brings its own `<toastRegion />`, so drop it if your layout has one. Money is whole cents throughout.

The sample declines the card `4000 0000 0000 0002` and fails for `offline@example.com`; `4242 4242 4242 4242` goes through.

<needs name="checkout" />
