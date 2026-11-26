---
title: "Features"
group: "Blocks"
order: 51
description: "What the product does, in columns, ruled cells or a bento grid."
layout: "/src/layouts/wide.tscl"
---

# Features

<p class="lead">What the product does, in columns, ruled cells or a bento grid. Copy a version into <code>src/components/sections/features/</code> with its <code>data.ts</code>, and the components it lists into <code>src/components/ui/</code>; put it in a page, then change <code>data.ts</code> to your words.</p>

## Columns

<blockView name="features-columns">

<iframe src="/view/features-columns" title="Features, columns preview" loading="lazy" style="height: 420px"></iframe>

<<< ../../../registry/sections/features/features-columns.tscl

<<< ../../../registry/sections/features/data.ts

</blockView>

<needs name="features-columns" />

## Ruled grid

<blockView name="features-grid">

<iframe src="/view/features-grid" title="Features, ruled grid preview" loading="lazy" style="height: 640px"></iframe>

<<< ../../../registry/sections/features/features-grid.tscl

<<< ../../../registry/sections/features/data.ts

<<< ../../../registry/grid-backdrop.tscl

<<< ../../../registry/grid-effect.tscl

<<< ../../../registry/grid-effect.ts

</blockView>

<needs name="features-grid" />

## Bento

<blockView name="features-bento">

<iframe src="/view/features-bento" title="Features, bento preview" loading="lazy" style="height: 640px"></iframe>

<<< ../../../registry/sections/features/features-bento.tscl

<<< ../../../registry/sections/features/data.ts

<<< ../../../registry/grid-backdrop.tscl

<<< ../../../registry/grid-effect.tscl

<<< ../../../registry/grid-effect.ts

</blockView>

<needs name="features-bento" />
