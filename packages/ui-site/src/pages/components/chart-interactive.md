---
title: "Chart (interactive)"
group: "Components"
order: 28
description: "A chart with a range switch and a tooltip that follows the pointer or the arrow keys."
---

# Chart (interactive)

<p class="lead">A chart with a range switch and a tooltip that follows the pointer or the arrow keys.</p>

<chartInteractiveDemo />

## Usage

<<< ../../registry/chart-interactive-demo.tscl

## Source

Copy it into `src/components/ui/` as `chart-interactive.tscl`, beside the chart. It takes the chart's inputs and `ranges` (`{ label, last }`: show the last N points). Focus the plot and the arrow keys read each point (Home, End, Escape to hide).

<<< ../../registry/chart-interactive.tscl

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `chart-interactive`, `chart-ranges`, `chart-surface`, `chart-guide` and `chart-tooltip`, around the chart's own (`chart-plot` and the rest).
- **Colours:** each series takes `--ui-chart-1` to `--ui-chart-5` in turn (set as `--ui-series` on its shapes).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="chart-interactive" />
