---
title: "Lazy attach"
description: "Load an island's code when the browser is idle, when it is visible or on first use."
---

# Lazy attach

<p class="lead">By default an island's code loads as soon as the page does. Add <code>attach</code> to load it later.</p>

<table>
    <thead><tr><th>Value</th><th>Loads</th></tr></thead>
    <tbody>
      <tr><td><code>attach="load"</code></td><td>as soon as the page loads (the default)</td></tr>
      <tr><td><code>attach="idle"</code></td><td>once the browser has nothing else to do</td></tr>
      <tr><td><code>attach="visible"</code></td><td>when it scrolls into view</td></tr>
      <tr><td><code>attach="interaction"</code></td><td>the first time someone clicks, types or focuses inside it</td></tr>
    </tbody>
  </table>

```tscl
<comments attach="visible" [post]="post.id" />
```

Nothing the visitor does is lost while the code loads: clicks, key presses, input and form submissions inside the island are held and replayed once it attaches (a replayed key press carries its `key` only, not modifiers such as Ctrl), and a form doesn't post in the meantime. The copy buttons on this site use `attach="interaction"`.
