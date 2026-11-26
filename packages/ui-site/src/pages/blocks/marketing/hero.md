---
title: "Hero"
group: "Blocks"
order: 50
description: "The top of a landing page: a headline, a line and the first buttons."
layout: "/src/layouts/wide.tscl"
---

# Hero

<p class="lead">The top of a landing page: a headline, a line and the first buttons. Copy a version into <code>src/components/sections/</code> with its <code>data.ts</code>, and the components it lists into <code>src/components/ui/</code>; put it in a page, then change <code>data.ts</code> to your words.</p>

## Centred

<blockView name="hero-centred">

<iframe src="/view/hero-centred" title="Hero, centred preview" loading="lazy" style="height: 460px"></iframe>

<<< ../../../registry/sections/hero/hero-centred.tscl

<<< ../../../registry/sections/hero/data.ts

<<< ../../../registry/button.tscl

</blockView>

<needs name="hero-centred" />

## Split

<blockView name="hero-split">

<iframe src="/view/hero-split" title="Hero, split preview" loading="lazy" style="height: 560px"></iframe>

<<< ../../../registry/sections/hero/hero-split.tscl

<<< ../../../registry/sections/hero/data.ts

<<< ../../../registry/button.tscl

</blockView>

<needs name="hero-split" />

## Grid

<blockView name="hero-grid">

<iframe src="/view/hero-grid" title="Hero, grid preview" loading="lazy" style="height: 640px"></iframe>

<<< ../../../registry/sections/hero/hero-grid.tscl

<<< ../../../registry/sections/hero/data.ts

<<< ../../../registry/button.tscl

<<< ../../../registry/grid-backdrop.tscl

<<< ../../../registry/grid-effect.tscl

<<< ../../../registry/grid-effect.ts

</blockView>

<needs name="hero-grid" />
