---
title: "Signature pad"
group: "Form"
order: 14
description: "Sign with a mouse, finger or pen, or type a name instead; the signature is a PNG its form sends."
---

# Signature pad

<p class="lead">Sign with a mouse, finger or pen, or type a name instead; the signature is a PNG its form sends.</p>

<signaturePadDemo />

## Usage

The signature is a PNG data URL (`data:image/png;base64,…`) in a hidden input named `name`, so a form sends it as it is; `(change)` gives it to you too, or `''` when it's empty. It's drawn on screen in the theme's text colour, and saved in dark ink on transparent, so it prints whatever the theme. A canvas can't be drawn with a keyboard: **Type instead** sets a typed name in a handwriting face, which becomes the signature.

<<< ../../registry/signature-pad-demo.tscl

## Source

Copy it into `src/components/ui/` as `signature-pad.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="signature-pad">

<<< ../../registry/signature-pad.tscl

<<< ../../registry/signature-pad.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `signature-pad`, `signature-canvas`, `signature-typed`, `signature-actions`, `signature-mode`, `signature-undo` and `signature-clear`; state attribute `data-typing` while typing a name.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="signature-pad" />
