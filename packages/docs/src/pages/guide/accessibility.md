---
title: Accessibility
description: What this site's layout does for keyboard and screen reader users, and how to do the same in yours.
---

# Accessibility

<p class="lead">clarusjs sends plain HTML, so most of accessibility is the markup you write. This site's layout is a working example: these are the patterns it uses, each checked by its Playwright tests (with axe).</p>

## Skip link

The first thing in the body is a link to the main content. It stays off screen until it has keyboard focus, so a keyboard user can skip the header and the page list with one key press:

```tscl
<a class="skip-link" href="#content">Skip to content</a>
…
<main id="content" tabindex="-1"><slot /></main>
```

`tabindex="-1"` lets the link move focus to `<main>` without making it a tab stop.

## Landmarks

One `<header>`, one `<main>`, one site `<footer>`, and a `<nav>` with an `aria-label` for each list of links ("Main", "Pages", "Previous and next"). Screen reader users move between them directly. A callout is a note inside the content, not a landmark: it is an `<aside role="note">`.

## The current page

The page's own link in the sidebar has `aria-current="page"`, and the section in the top bar `aria-current="true"`, so the position is announced, not only shown:

```tscl
<a [href]="item.href" [aria-current]="item.href === path ? 'page' : false">{{ item.title }}</a>
```

A `false` attribute value leaves the attribute out.

## Controls

Every control is a native one: the theme toggle and copy buttons are `<button>` elements with a name, the mobile page list is a checkbox (it works without JavaScript), and code-group tabs are radio buttons. Code blocks that can scroll sideways have `tabindex="0"`, so they can be scrolled from the keyboard.
