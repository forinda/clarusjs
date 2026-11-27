---
title: "View transitions demo"
description: "A card that moves and grows between two pages: one view-transition-name, no JavaScript of its own."
---

# View transitions demo

<p class="lead">This site turns view transitions on. Follow the link below: the page cross-fades, and the card, named the same on both pages, moves and grows into its place on the next one.</p>

<vtCard size="small" />

[Next page: the same card, wide](/demos/view-transitions/two)

The card's style holds `view-transition-name: vt-demo-card`. The browser pairs elements with the same name on the old and new page, and animates one into the other. See [Page changes: view transitions](/guide/animations#page-changes-view-transitions).
