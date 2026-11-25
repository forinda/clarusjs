---
title: "OTP input"
group: "Form"
order: 17
description: "A one-time code shown as a box per digit; one native field, so paste and SMS autofill just work."
---

# OTP input

<p class="lead">A one-time code shown as a box per digit; one native field, so paste and SMS autofill just work.</p>

<otpInputDemo />

## Usage

It's one `<input autocomplete="one-time-code" inputmode="numeric">` laid, unseen, over the boxes: pasting a whole code, a phone offering the code from a text message, Backspace and screen readers all work as in any field, with none of the focus-juggling of a field per digit. Letters are dropped. `length` sets the number of boxes (6 unless you say); `(complete)` sends the code once they're all filled, and the form gets it as `name`.

<<< ../../registry/otp-input-demo.tscl

## Source

Copy it into `src/components/ui/` as `otp-input.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="otp-input">

<<< ../../registry/otp-input.tscl

<<< ../../registry/otp-input.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `otp`, `otp-label`, `otp-field`, `otp-cells`, `otp-cell` and `otp-input`; on a box, state attributes `data-filled` and `data-active` (where the next digit goes).
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="otp-input" />
