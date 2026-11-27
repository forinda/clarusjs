---
title: "Date picker"
group: "Form"
order: 16
description: "A button that opens a calendar to pick a date or a range; the date goes to its form."
---

# Date picker

<p class="lead">A button that opens a calendar to pick a date or a range; the date goes to its form.</p>

<datePickerDemo />

## Usage

The button names the field and shows the date; it opens the [Calendar](/components/calendar) in a popover, on the chosen day (or today), where the keyboard works as the calendar's. Picking a day closes it and puts the focus back on the button; so do Escape and a click outside. **Clear** empties the date (both, for a range). The date is `'YYYY-MM-DD'` in a hidden input named `name`, so a form sends it; bind it with `[(value)]`.

<<< ../../registry/date-picker-demo.tscl

## Examples

### A range

`[range]="true"`: two picks, then it closes. The form gets `name` and `name-end`; bind them with `[(value)]` and `[(end)]`.

<datePickerRangeDemo />

<<< ../../registry/date-picker-range-demo.tscl

## API

<componentApi name="date-picker" />

## Source

Copy it into `src/components/ui/` as `date-picker.tscl`, beside the calendar: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="date-picker">

<<< ../../registry/date-picker.tscl

<<< ../../registry/date-picker.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `date-picker`, `date-picker-label`, `date-picker-trigger`, `date-picker-popover`, `date-picker-footer` and `date-picker-clear`, around the calendar's (`calendar`, `calendar-head`, `calendar-title`, `calendar-prev`, `calendar-next`, `calendar-grid`, `calendar-day`); state attribute `data-empty` until a date is picked.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="date-picker" />
