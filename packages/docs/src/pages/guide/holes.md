---
title: "Holes"
description: "Print values in templates with {{ }} holes; they are always escaped."
---

# Holes

<p class="lead"><code verbatim>{ }</code> holes print the value of a JavaScript expression, always escaped.</p>

```tscl
<p>{{ user.name }} has {{ items.length }} items.</p>
<p>{{ count > 1 ? 'many' : 'one' }}</p>
```

`null` and `undefined` print nothing. HTML in a value is shown as text, never as markup. To show the characters `{` and `}` themselves, see [Verbatim](/guide/verbatim).
