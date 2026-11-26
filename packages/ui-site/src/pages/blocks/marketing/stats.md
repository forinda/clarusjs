---
title: "Stats"
group: "Blocks"
order: 59
description: "A few numbers that say it works."
layout: "/src/layouts/wide.tscl"
---

# Stats

<p class="lead">A few numbers that say it works. Copy a version into <code>src/components/sections/</code> with its <code>data.ts</code>, and the components it lists into <code>src/components/ui/</code>; put it in a page, then change <code>data.ts</code> to your words.</p>

## Stats

<blockView name="stats">

<iframe src="/view/stats" title="Stats, stats preview" loading="lazy" style="height: 340px"></iframe>

<<< ../../../registry/sections/stats/stats.tscl

<<< ../../../registry/sections/stats/data.ts

<<< ../../../registry/grid-backdrop.tscl

<<< ../../../registry/grid-effect.tscl

<<< ../../../registry/grid-effect.ts

</blockView>

<needs name="stats" />
