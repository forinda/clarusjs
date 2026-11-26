---
title: "Animations"
group: "Templates"
order: 14
description: "Animate what @if and @for insert with CSS alone (@starting-style), page changes with view transitions, and respect reduced motion."
---

# Animations

<p class="lead">Most animation needs no JavaScript: CSS animates what an island's <code>@if</code> and <code>@for</code> insert, and page changes run as view transitions. Here is what works today, and what's next.</p>

## Entering: @starting-style

When `@if` shows a branch or `@for` adds a row in an island, the elements are inserted into the page. Give them a `transition` and say where they start from in `@starting-style`: the browser animates from there to their normal style.

```css
.panel {
  transition: opacity 0.3s, translate 0.3s;
}
@starting-style {
  .panel {
    opacity: 0;
    translate: 0 8px; /* fades and rises in */
  }
}
```

The same works for each row a list adds, here sliding in from the right:

```css
.rows li { transition: opacity 0.3s, translate 0.3s; }
@starting-style {
  .rows li { opacity: 0; translate: 24px 0; }
}
```

Try it:

<enterDemo />

- **It runs only on insertion**: what the server rendered is already in place when the page loads, so nothing animates on the first paint.
- **Each element animates on its own**: give rows a `transition-delay` from a custom property (`style="--i: {{ $index }}"`, `transition-delay: calc(var(--i) * 40ms)`) to stagger them.
- **Browsers without `@starting-style`** show the element at once, in its final style: nothing breaks.

## Leaving

Leaving is instant for now: `@if` and `@for` remove the elements at once, so there's nothing to animate. An `@transition` block that waits for a leave (and moves list rows into place) is coming, with Vue's class names: `fade-enter-from`, `fade-leave-to` and the rest.

## Page changes: view transitions

Between pages, turn on [view transitions](/guide/navigation#view-transitions) once, from any island (`viewTransitions()` from `clarusjs/navigation`), or with `viewTransitions: true` in the docs theme. Each page change then cross-fades, and you change the animation with the `::view-transition-*` pseudo-elements. For example, the new page slides in from the right and the old one leaves to the left:

```css
::view-transition-old(root) { animation: 0.3s ease both slide-out; }
::view-transition-new(root) { animation: 0.3s ease both slide-in; }
@keyframes slide-out { to { translate: -100% 0; } }
@keyframes slide-in { from { translate: 100% 0; } }
```

Name a part of the page (`view-transition-name: hero`) and it animates on its own, from where it was to where it is on the new page.

## Reduced motion

Some visitors ask their system for less motion. Keep fades, drop movement:

```css
@media (prefers-reduced-motion: reduce) {
  .panel, .rows li { transition: opacity 0.2s; translate: none; }
  ::view-transition-old(root), ::view-transition-new(root) { animation: none; }
}
```

The demo above does this.
