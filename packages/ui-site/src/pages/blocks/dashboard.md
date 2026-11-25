---
title: "Dashboard"
group: "Blocks"
order: 30
description: "A sidebar, four stat cards, a chart with a range switch, and a table that filters, sorts and pages."
layout: "/src/layouts/wide.tscl"
---

# Dashboard

<blockView name="dashboard">

<iframe src="/view/dashboard" title="Dashboard preview" loading="lazy" style="height: 1100px"></iframe>

<<< ../../registry/blocks/dashboard/dashboard.tscl

<<< ../../registry/blocks/dashboard/dashboard-table.tscl

<<< ../../registry/blocks/dashboard/stat-card.tscl

<<< ../../registry/blocks/dashboard/data.ts

<<< ../../registry/sidebar.css

<<< ../../registry/card.tscl

<<< ../../registry/badge.tscl

<<< ../../registry/chart.tscl

<<< ../../registry/chart-geometry.ts

<<< ../../registry/chart-interactive.tscl

<<< ../../registry/table.tscl

<<< ../../registry/button.tscl

<<< ../../registry/input.tscl

</blockView>

## Use it

Copy `dashboard.tscl` into `src/pages/`, `dashboard-table.tscl`, `stat-card.tscl` and `data.ts` beside it, and the components under Code into `src/components/ui/`. Put `SIDEBAR_SCRIPT` from `@clarusjs/ui-primitives` in your `<head>` (for example `head.tags` in `vite.config.ts`), so a collapsed sidebar stays collapsed on load. Replace the data in `data.ts` with yours: `stats` for the cards, `visitors` for the chart, `rows` for the table; `filterRows`, `sortRows` and `pageRows` work on any rows of that shape.

<needs name="dashboard" />
