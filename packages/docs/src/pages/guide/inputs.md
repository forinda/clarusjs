---
title: "Inputs"
description: "Typed inputs with @input, defaults, and types imported with @import type."
---

# Inputs

<p class="lead"><code>@input</code> declares what a component receives, with a TypeScript type and an optional default.</p>

```tscl
@import type { User } from '../domain/user'
@input user: User
@input size: 'sm' | 'lg' = 'sm'

<p class="{{ size }}">{{ user.name }}</p>
```

An input with a default is optional. `@import type` brings in types for inputs; it is erased from the compiled output. `clarusjs check` verifies every use of a component against its inputs.
