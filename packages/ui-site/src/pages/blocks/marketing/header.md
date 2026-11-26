---
title: "Header"
group: "Blocks"
order: 57
description: "The bar at the top: logo, links, menus and actions."
layout: "/src/layouts/wide.tscl"
---

# Header

<p class="lead">The bar at the top: logo, links, menus and actions. Copy a version into <code>src/components/sections/header/</code> with its <code>data.ts</code>, and the components it lists into <code>src/components/ui/</code>; put it in a page, then change <code>data.ts</code> to your words.</p>

## With menus

<blockView name="header-menus">

<iframe src="/view/header-menus" title="Header, with menus preview" loading="lazy" style="height: 420px"></iframe>

<<< ../../../registry/sections/header/header-menus.tscl

<<< ../../../registry/sections/header/data.ts

<<< ../../../registry/button.tscl

<<< ../../../registry/navbar.tscl

<<< ../../../registry/menu.css

</blockView>

<needs name="header-menus" />

## Centred

<blockView name="header-centred">

<iframe src="/view/header-centred" title="Header, centred preview" loading="lazy" style="height: 360px"></iframe>

<<< ../../../registry/sections/header/header-centred.tscl

<<< ../../../registry/sections/header/data.ts

<<< ../../../registry/button.tscl

<<< ../../../registry/navbar.tscl

</blockView>

<needs name="header-centred" />
