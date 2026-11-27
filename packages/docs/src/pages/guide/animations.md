---
title: "Animations"
group: "Templates"
order: 14
description: "Animate what @if and @for insert with CSS alone (@starting-style), what @if removes with @transition, page changes with view transitions, and respect reduced motion."
---

# Animations

<p class="lead">Most animation needs no JavaScript: CSS animates what an island's <code>@if</code> and <code>@for</code> insert, <code>@transition</code> plays what an <code>@if</code> removes before it goes, and page changes run as view transitions.</p>

## Which one?

Three things here are called a transition. They animate different things:

| | Animates | Where | Written as |
|---|---|---|---|
| [CSS transitions with `@starting-style`](#entering-starting-style) | an element appearing (`@if`, `@for`, or on page load) | any page, no JavaScript | CSS: `transition` and `@starting-style` |
| [`@transition`](#transition) | an island's `@if` branches entering and leaving: the old one stays until it has animated out | in an island; loads `clarusjs/motion` (1.8 KB) | a block in the template, plus Vue's classes in CSS |
| [View transitions](#page-changes-view-transitions) | the whole page changing on navigation, from the old page to the new | the browser's View Transition API, turned on once with `viewTransitions()` | CSS: `::view-transition-*` |

Use `@starting-style` when only entering needs to animate, and `@transition` when leaving does too. View transitions are separate: they animate one page becoming the next, not an element inside a page. Both can run together.

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

- **It runs on first render too**: an element's first style comes from `@starting-style`, whether `@if` or `@for` inserts it later or the server rendered it, so what the page loads with animates in as well. Scope the rules to a class you add after load if only later insertions should animate.
- **Each element animates on its own**: give rows a `transition-delay` from a custom property (`style="--i: {{ $index }}"`, `transition-delay: calc(var(--i) * 40ms)`) to stagger them.
- **Browsers without `@starting-style`** show the element at once, in its final style: nothing breaks.

### A flip clock

The same technique, taken further: each digit is a row of a `@for` keyed by its place and its value (`track cell.key`, a key like `` `${i}:${ch}` ``). When a digit changes, its key changes, so it's a new row, and a new row animates in. Its two leaves start from where a split-flap card would be: the old top half upright, the new bottom half folded up. Then the browser turns them into place, one after the other (`transition-delay`).

<flipClock />

```css
.fold { rotate: x -90deg; transition: rotate 0.25s ease-in; }       /* the old top, folded away */
.fall { rotate: x 0deg; transition: rotate 0.25s 0.25s ease-out; } /* the new bottom, in place */
@starting-style {
  .fold { rotate: x 0deg; }   /* starts upright */
  .fall { rotate: x 90deg; }  /* starts folded up */
}
```

The whole clock is in `src/components/flip-clock.tscl` on this site: about 30 lines of script and markup, no animation code.

## @transition {since=0.17.0}

To animate what leaves too, wrap an island's `@if` in `@transition`, with a name. It works inside a page; it isn't the browser's view transitions, which animate page changes (below). The branch that's going stays in the page until its transition ends, and the one that's coming in gets classes to start from. These are Vue's classes, with your name as the prefix:

```tscl [src/components/info-panel.tscl]
<script>
  let open = state(true)
</script>

<div>
  <button type="button" (click)="open = !open">Toggle</button>
  @transition ('fade') {
    @if (open) {
      <p class="panel">Hello</p>
    }
  }
</div>
```

```css
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, translate 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; translate: 0 8px; }
```

| Class | On the element |
|---|---|
| `fade-enter-from` | for its first frame in: where it starts |
| `fade-enter-active` | for the whole enter: put the `transition` here |
| `fade-enter-to` | from the second frame until its enter ends |
| `fade-leave-from`, `fade-leave-active`, `fade-leave-to` | the same for leaving; once it ends, the element is removed |

An enter or leave ends when the element's animations do (CSS transitions, CSS animations and the Web Animations API alike), and after 5 seconds at most. `@transition { … }` without a name uses `cl-enter-from` and the rest. A leaving element can't be focused or clicked, and it no longer belongs to the island. If the branch changes again while it's leaving, the branch that's back is a fresh copy.

<transitionDemo />

### Options

`@transition ('fade', { … })` takes options as its second argument:

| Option | Does |
|---|---|
| `mode: 'out-in'` | the new branch comes once the old one has left, as the steps above do. `'in-out'`: the new one enters first, then the old one leaves. By default both run at once |
| `appear: true` | the branch the page loaded with enters too, when the island attaches |
| `duration: 300` or `{ enter, leave }` | wait this long (ms) instead of the animations |
| `css: false` | no classes: only the hooks run |
| `onBeforeEnter(el)`, `onEnter(el, done)`, `onAfterEnter(el)`, `onEnterCancelled(el)` | Vue's hooks. With a `done` parameter, the enter waits until it's called |
| `onBeforeLeave(el)`, `onLeave(el, done)`, `onAfterLeave(el)` | the same for leaving |

In the default mode, the leaving and the entering branch are both in the page for a moment. Take the leaving one out of the flow, for example with `.fade-leave-active { position: absolute }`, so the page doesn't jump. A branch whose top element is a stateful component animates that component's own root element.

`@transition` needs an island (a `<script>` or a `@model` input), and wraps one `@if`. It isn't available for `@for` yet: rows moving into place are next. The transition code (1.8 KB gzip) loads only in islands that use it.

## Page changes: view transitions

View transitions are the browser's, for navigation: they animate the old page turning into the new one, and have nothing to do with `@transition`, which animates an `@if` inside an island. Between pages, turn on [view transitions](/guide/navigation#view-transitions) once, from any island (`viewTransitions()` from `clarusjs/navigation`), or with `viewTransitions: true` in the docs theme. Each page change then cross-fades, and you change the animation with the `::view-transition-*` pseudo-elements. For example, the new page slides in from the right and the old one leaves to the left:

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
  .fade-enter-active, .fade-leave-active { transition: none; } /* @transition: nothing to wait for, so it goes at once */
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none; } /* named parts move in their group */
}
```

The demo above does this.
