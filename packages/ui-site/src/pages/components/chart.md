---
title: "Chart"
group: "Chart"
order: 27
description: "An area, line or bar chart drawn as SVG on the server, coloured by the chart tokens."
---

# Chart

<p class="lead">An area, line or bar chart drawn as SVG on the server, coloured by the chart tokens.</p>

<chartDemo />

## Usage

<<< ../../registry/chart-demo.tscl

## API

<componentApi name="chart" />

## Source

Copy both files into `src/components/ui/`: `chart.tscl`, and `chart-geometry.ts` beside it (the maths: scale, paths, bars). It ships no JavaScript. Pass `label` (what the chart shows, for screen readers), `labels` (the x axis), `series` (`{ name, values }`, values below 0 drawn at 0), `type` (`area`, `line` or `bar`) and `height`.

<sourceFlavor name="chart">

<<< ../../registry/chart.tscl

<<< ../../registry/chart.tw.tscl

</sourceFlavor>

<<< ../../registry/chart-geometry.ts

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `chart`, `chart-frame`, `chart-plot`, `chart-grid`, `chart-tick`, `chart-labels`, `chart-label`, `chart-area`, `chart-line`, `chart-bar`, `chart-legend`, `chart-data` and `chart-table` (the data, visually hidden); state attributes `data-type`, and `data-align` on each label (`start`, `middle`, `end`).
- **Colours:** each series takes `--ui-chart-1` to `--ui-chart-5` in turn (set as `--ui-series` on its shapes).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="chart" />
