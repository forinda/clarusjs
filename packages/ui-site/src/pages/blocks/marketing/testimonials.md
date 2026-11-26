---
title: "Testimonials"
group: "Blocks"
order: 54
description: "What people who use it say, as one quote or a grid of them."
layout: "/src/layouts/wide.tscl"
---

# Testimonials

<p class="lead">What people who use it say, as one quote or a grid of them. Copy a version into <code>src/components/sections/testimonials/</code> with its <code>data.ts</code>, and the components it lists into <code>src/components/ui/</code>; put it in a page, then change <code>data.ts</code> to your words.</p>

## One quote

<blockView name="testimonials-quote">

<iframe src="/view/testimonials-quote" title="Testimonials, one quote preview" loading="lazy" style="height: 420px"></iframe>

<<< ../../../registry/sections/testimonials/testimonials-quote.tscl

<<< ../../../registry/sections/testimonials/data.ts

</blockView>

<needs name="testimonials-quote" />

## Grid

<blockView name="testimonials-grid">

<iframe src="/view/testimonials-grid" title="Testimonials, grid preview" loading="lazy" style="height: 620px"></iframe>

<<< ../../../registry/sections/testimonials/testimonials-grid.tscl

<<< ../../../registry/sections/testimonials/data.ts

</blockView>

<needs name="testimonials-grid" />
