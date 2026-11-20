---
title: "Shared stores"
description: "Share state between islands with stores and shared()."
---

# Shared stores

<p class="lead">Put state that several islands use in a store: a module that exports <code>state()</code> values. Each island takes a local name for it with <code>shared()</code> and reads and writes it like its own state.</p>

```tscl
// stores/cart.ts
import { state } from 'clarusjs/runtime'
export const cart = state([])

// components/cart-count.tscl
<script>
  import { cart } from '../stores/cart.ts'
  let items = shared(cart)
</script>
<span>{{ items.length }} in cart</span>
```

On the server, a shared value is rendered from the store's initial value, never its current one, and each render gets its own copy: a server keeps modules alive across requests, so anything else could show one visitor's data to another. Store values must therefore be plain data that can be copied.
