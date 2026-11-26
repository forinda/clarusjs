---
title: "Appointment picker"
group: "Form"
order: 17
description: "A date and a time in one popover, with shortcuts (Today, Tomorrow, Next week) and time slots."
---

# Appointment picker

<p class="lead">A date and a time in one popover, with shortcuts (Today, Tomorrow, Next week) and time slots.</p>

<appointmentPickerDemo />

## Usage

The button opens three columns: **shortcuts** (Yesterday, Today, Tomorrow, Next week), the [Calendar](/components/calendar) for any other day, and the **times** from `from` to `to` every `interval` minutes (9:00 to 17:00, every 30, unless you say). Picking a time once there's a day sets the appointment, closes, and puts the focus back on the button; **Clear** empties it. The value is `'YYYY-MM-DDTHH:MM'`, as `<input type="datetime-local">` has it, in a hidden input named `name`; bind it with `[(value)]`. On a narrow screen the columns stack.

<<< ../../registry/appointment-picker-demo.tscl

## Examples

### From today

`min="today"` (the visitor's day, worked out in the browser) makes the days before it unavailable, Yesterday too; hourly slots with `[interval]="60"`.

<appointmentPickerMinDemo />

<<< ../../registry/appointment-picker-min-demo.tscl

## Source

Copy it into `src/components/ui/` as `appointment-picker.tscl`, beside the calendar: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="appointment-picker">

<<< ../../registry/appointment-picker.tscl

<<< ../../registry/appointment-picker.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `appointment`, `appointment-label`, `appointment-trigger`, `appointment-popover`, `appointment-shortcuts`, `appointment-times`, `appointment-footer` and `appointment-clear`, around the calendar's; state attribute `data-empty` until both are picked, and `aria-pressed` on the chosen shortcut and time.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="appointment-picker" />
