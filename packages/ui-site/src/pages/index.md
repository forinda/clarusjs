---
title: "clarusjs ui"
description: "Accessible, server-rendered components for clarusjs: copy a file, own it, and theme it with --ui- tokens."
---

<landingHero />

<landingPlayground />

## Copy it, use it

<div class="landing-pair">

```tscl [src/pages/index.tscl]
@import uiButton from '~/components/ui/button.tscl'
@import uiBadge from '~/components/ui/badge.tscl'

<uiButton>Save</uiButton>
<uiButton variant="outline">Preview</uiButton>
<uiBadge variant="success">Live</uiBadge>
```

<div class="landing-result"><buttonDemo /></div>

</div>

<landingFeatures />

## Start

<p class="landing-start">Copy <a href="/components"><code>theme.css</code> and a component</a>, or a whole page from <a href="/blocks">the blocks</a>.</p>
