---
title: "Newsletter"
group: "Blocks"
order: 60
description: "An email field to hear about what comes next."
layout: "/src/layouts/wide.tscl"
---

# Newsletter

<p class="lead">An email field to hear about what comes next. Copy a version into <code>src/components/sections/</code> with its <code>data.ts</code>, and the components it lists into <code>src/components/ui/</code>; put it in a page, then change <code>data.ts</code> to your words.</p>

## Newsletter

<blockView name="newsletter">

<iframe src="/view/newsletter" title="Newsletter, newsletter preview" loading="lazy" style="height: 300px"></iframe>

<<< ../../../registry/sections/newsletter/newsletter.tscl

<<< ../../../registry/sections/newsletter/data.ts

<<< ../../../registry/button.tscl

<<< ../../../registry/field.tscl

</blockView>

<needs name="newsletter" />
