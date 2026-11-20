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

## After navigation

With [fragment navigation](./fragment-navigation.md) or [client routes](./client-routes.md), the page changes without a reload, so a screen reader hears nothing and focus would stay on the link that was clicked. clarusjs handles it: after each swap or client render, focus moves to the new content (the `#hash` target if the URL has one, else the page's `<h1>`, else `<main>`), and the new page title is announced in a polite live region. A heading or `<main>` that gets focus this way gets `tabindex="-1"`, so it doesn't become a tab stop; hide its focus ring with `[tabindex="-1"]:focus { outline: none; }` if you like. Full page loads need none of this: the browser already does it.

## Motion, menus and contrast

- **Reduced motion.** Visitors who set "reduce motion" get no transitions or animations; this site's stylesheet ends with a `prefers-reduced-motion` reset you can copy.
- **Menus.** This site's page list opens *in place* on phones (it pushes the page down, covering nothing), so the rest of the page stays usable. A menu that *overlays* the page should make everything behind it `inert` while open, so focus and screen readers stay in the menu.
- **Contrast.** Text and highlighted code meet WCAG AA (4.5:1) in light and dark, checked with axe on every build of this site. `@clarusjs/content` uses GitHub's `*-default` themes, whose colours were made for contrast, with darker comments in the light theme. If you style code blocks yourself, keep their background close to the theme's own (white in light) and line highlights faint: every token has to stay readable on them.
