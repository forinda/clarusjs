---
title: "Button"
group: "Button"
order: 1
description: "A native button in seven variants and three sizes, with icons, loading, shapes and full width."
---

# Button

<p class="lead">A native button in seven variants and three sizes, with icons, loading, shapes and full width.</p>

<buttonDemo />

## Usage

<<< ../../registry/button-demo.tscl

## Examples

### Variants

Seven looks for seven weights of action: one default (primary) per section, the rest for what follows it.

<buttonVariantsDemo />

<<< ../../registry/button-variants-demo.tscl

### Sizes

Small, medium (the default) and large; circle buttons follow the size too.

<buttonSizesDemo />

<<< ../../registry/button-sizes-demo.tscl

### Icons

An icon goes where you put it: before the text, after it, or alone (then give the button an `aria-label`).

<buttonIconsDemo />

<<< ../../registry/button-icons-demo.tscl

### Loading

`loading` shows a spinner, disables the button and sets `aria-busy`, so a second click never sends twice.

<buttonLoadingDemo />

<<< ../../registry/button-loading-demo.tscl

### Shapes

`shape="round"` for a pill, `shape="circle"` for an icon alone.

<buttonShapesDemo />

<<< ../../registry/button-shapes-demo.tscl

### Full width

`block` fills its container: forms, cards and phones.

<buttonBlockDemo />

<<< ../../registry/button-block-demo.tscl

### Disabled

Every variant, disabled.

<buttonDisabledDemo />

<<< ../../registry/button-disabled-demo.tscl

### With other buttons

One primary action, the rest outline; group related ones with Button group.

<buttonActionsDemo />

<<< ../../registry/button-actions-demo.tscl

## Source

Copy it into `src/components/ui/` as `button.tscl`: in plain CSS, or in Tailwind classes (switch below; the Tailwind version needs `tailwind.css`).

<sourceFlavor name="button">

<<< ../../registry/button.tscl

<<< ../../registry/button.tw.tscl

</sourceFlavor>

## Styling

- **On the root:** `class`, `style`, `id`, `aria-*` and `data-*` written on the tag land on its root element; `class` and `style` merge with its own.
- **Selectors:** `data-part` names `button` and `button-spinner` (while loading); state attributes `data-variant`, `data-size`, `data-block`, `data-shape`, `aria-busy`.
- **Your rules win:** every rule here has zero specificity (`:where()`) and sits in `@layer components`, so your own CSS and Tailwind utilities override it.

## Needs

<needs name="button" />
