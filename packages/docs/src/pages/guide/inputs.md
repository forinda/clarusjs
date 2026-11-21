---
title: "Inputs"
group: "Templates"
order: 2
description: "Typed inputs with @input, defaults, types imported with @import type, and local types with @type and @interface."
---

# Inputs

<p class="lead"><code>@input</code> declares what a component receives, with a TypeScript type and an optional default.</p>

```tscl
@import type { User } from '../domain/user'
@input user: User
@input size: 'sm' | 'lg' = 'sm'

<p class="{{ size }}">{{ user.name }}</p>
```

An input's type and default can span lines while a bracket is open, and function types keep their `=>`:

```tscl
@input options: {
  size: 'sm' | 'lg'
  label?: string
} = { size: 'sm' }
@input onPick: (id: string) => void
@input format: (n: number) => string = (n) => n.toFixed(2)
```

An input with a default is optional. `@import type` brings in types for inputs; it is erased from the compiled output. `clarusjs check` verifies every use of a component, in `.tscl` and Markdown pages, against its inputs.

## Types in the file

A type only this component's inputs need can live in the file, with `@type` and `@interface`, as in TypeScript:

```tscl
@interface User<Role = string> {
  name: string
  role: Role
}
@type Size = 'sm' | 'lg'
@type Flags<K extends string> = { [P in K]: boolean }
@input user: User<'admin' | 'guest'>
@input size: Size = 'sm'
```

Any TypeScript type works: unions, generics, mapped and conditional types, `infer`. A declaration continues onto the next lines while a bracket is open. Both are erased from the compiled output and checked by `clarusjs check`, with errors at their line.

They are local to the file. Other files see them only through the component's inputs, so they never leak into anyone else's names. A type several files share belongs in a `.ts` file, brought in with `@import type`.
