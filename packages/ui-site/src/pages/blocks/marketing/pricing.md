---
title: "Pricing"
group: "Blocks"
order: 52
description: "Plans side by side, or a table comparing what each includes."
layout: "/src/layouts/wide.tscl"
---

# Pricing

<p class="lead">Plans side by side, or a table comparing what each includes. Copy a version into <code>src/components/sections/pricing/</code> with its <code>data.ts</code>, and the components it lists into <code>src/components/ui/</code>; put it in a page, then change <code>data.ts</code> to your words.</p>

## Plans

<blockView name="pricing-plans">

<iframe src="/view/pricing-plans" title="Pricing, plans preview" loading="lazy" style="height: 760px"></iframe>

<<< ../../../registry/sections/pricing/pricing-plans.tscl

<<< ../../../registry/sections/pricing/data.ts

<<< ../../../registry/button.tscl

<<< ../../../registry/switch.tscl

<<< ../../../registry/grid-backdrop.tscl

<<< ../../../registry/grid-effect.tscl

<<< ../../../registry/grid-effect.ts

</blockView>

<needs name="pricing-plans" />

## Comparison

<blockView name="pricing-compare">

<iframe src="/view/pricing-compare" title="Pricing, comparison preview" loading="lazy" style="height: 820px"></iframe>

<<< ../../../registry/sections/pricing/pricing-compare.tscl

<<< ../../../registry/sections/pricing/data.ts

<<< ../../../registry/button.tscl

<<< ../../../registry/grid-backdrop.tscl

<<< ../../../registry/grid-effect.tscl

<<< ../../../registry/grid-effect.ts

</blockView>

<needs name="pricing-compare" />
