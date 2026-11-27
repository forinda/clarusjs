---
title: "Calendar"
group: "Form"
order: 15
description: "A month to pick a day or a range from, by pointer or keyboard, within limits, in your locale."
---

# Calendar

<p class="lead">A month to pick a day or a range from, by pointer or keyboard, within limits, in your locale.</p>

<calendarDemo />

## Usage

Bind the day with `[(value)]`, as `'YYYY-MM-DD'`: dates are plain strings, so no time zone shifts a day. The header: single arrows move a month, double arrows a year, and the month and year lists jump straight to one (the years within `min` and `max`). The keyboard: the arrow keys move a day or a week, PageUp and PageDown a month (with Shift, a year), Home and End the week's first and last day, Enter or Space picks. Today is marked once the page is live. `locale` names the months and days (`en-US` unless you say), `firstDay` starts the week (0 Sunday … 6 Saturday).

<<< ../../registry/calendar-demo.tscl

## Examples

### A range

`[range]="true"`: the first pick is the start (`[(value)]`), the second the end (`[(end)]`), in either order; the days between are marked.

<calendarRangeDemo />

<<< ../../registry/calendar-range-demo.tscl

### Limits

`min` and `max`: days outside stay reachable by keyboard, say they're unavailable, and can't be picked.

<calendarLimitsDemo />

<<< ../../registry/calendar-limits-demo.tscl

## API

<componentApi name="calendar" />

## Source

Copy both files into `src/components/ui/`: `calendar.tscl` (in plain CSS, or in Tailwind classes: switch below; the Tailwind version needs `tailwind.css`), and `calendar-dates.ts` beside it.

<sourceFlavor name="calendar">

<<< ../../registry/calendar.tscl

<<< ../../registry/calendar.tw.tscl

</sourceFlavor>

<<< ../../registry/calendar-dates.ts

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `calendar`, `calendar-head`, `calendar-title`, `calendar-prev`, `calendar-next`, `calendar-prev-year`, `calendar-next-year`, `calendar-month`, `calendar-year`, `calendar-grid` and `calendar-day`; state attributes `data-range` on the root, and on a day `aria-pressed` (picked), `aria-current="date"` (today), `aria-disabled` (outside the limits), `data-outside` (another month) and `data-between` (inside a range).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="calendar" />
