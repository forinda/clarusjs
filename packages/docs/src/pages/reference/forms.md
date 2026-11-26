---
title: "clarusjs/forms"
group: "APIs"
order: 4
description: "form() and its types: the exact contract of the forms engine, with parameters, the engine's members, caveats and usage."
---

# clarusjs/forms

<p class="lead">A headless forms engine. For the how-to with live forms, see <a href="/guide/form-validation">Form validation</a>.</p>

```ts
import { form } from 'clarusjs/forms'
```

## form()

```ts
form<T>(values: Signal<T> | T, options?: FormOptions<T>): Form<T>
```

The engine for a form. Connect it to a `<form>` with `[engine]="f"`. It validates the fields bound to `values`, using native constraints, a Standard Schema, and errors from the server. It shows each error on its field, and runs `submit` once everything is valid.

### Parameters

- **`values`**: the form's state: a component's `state()`, or a store's. Fields bind to it with `[(value)]` and `[(checked)]`.
- **`options`** (optional):
  - **`schema`**: a [Standard Schema](#standardschema) for the whole object. Its issues land on their fields by path. It can be sync or async.
  - **`show`** (default `'blur'`): when a field's error appears: after the field is left once (`'blur'`), as you type (`'input'`), or on submit (`'submit'`).
  - **`messages`**: messages for native constraints, by path (`'customer.email'`) or by constraint (`valueMissing`, `typeMismatch`, …).
  - **`submit(values)`**: called with the values once everything is valid. It may return `{ errors }` from the server, by path; they show on their fields.

### Returns

A `Form<T>`:

- **Errors:**
  - **`error(path)`**: the message shown for a field now, or `''`.
  - **`errors`**: every error being shown, in document order (see [FormError](#formerror)), for a summary.
  - **`valid`**: no errors at all, shown or not.
  - **`pending`**: an async schema check is running.
  - **`setErrors(errors)`**: server errors by path. Each shows until that field's value changes.
- **Fields:**
  - **`touched(path)`**: the field has been left at least once.
  - **`changed(path)`**: the field differs from its starting value.
  - **`dirty`** (since 0.17.0): any value differs from the start, compared by value through objects and arrays.
  - **`shown(path)`** (since 0.17.0): the field's error shows now, by `show` (or a step check, or after a submit).
  - **`focus(path)`**: focuses a field (the checked radio of a group, else the first).
  - **`reset(values?)`**: back to the starting values, with touched and errors cleared. With `values`, those become the values and the new starting point.
- **Steps** (multi-step forms):
  - **`step`**: the current step's id.
  - **`steps`**: every step, with `current`, `done` and its number of `errors`.
  - **`next()`**: checks the current step, then moves on (`true`), or stays and focuses the first error (`false`).
  - **`back()`**: the previous step, without checks.
  - **`go(id)`**: goes to a step by id.
- **Submitting:**
  - **`submit()`**: checks everything, then calls `options.submit`. It resolves `true` when it went through, or `false` and goes to the first error.
  - **`submitting`**: `submit` is running.

### Caveats

- **A field needs a binding** (`[(value)]` or `[(checked)]`) for the engine to find it. Its error shows in a `[data-cl-message]` element next to it, and the engine sets `aria-invalid` and `aria-describedby`.
- **Use `novalidate` on the `<form>`.** The engine runs the native constraints itself and shows their messages on the fields.
- **On the server** the engine only renders: nothing is checked there.
- **One submit at a time.** A second `submit()` while one runs resolves `false`.

### Usage

**A form with server errors:**

```tscl
<script>
  import { form } from 'clarusjs/forms'
  let signup = state({ name: '', email: '' })
  const f = form(signup, {
    submit: async (values) => {
      const res = await fetch('/api/signup', { method: 'POST', body: JSON.stringify(values) })
      if (!res.ok) return { errors: await res.json() } // { "email": "Already registered" }
    },
  })
</script>

<form [engine]="f" novalidate>
  <label>Name <input required [(value)]="signup.name"> <small data-cl-message></small></label>
  <label>Email <input type="email" required [(value)]="signup.email"> <small data-cl-message></small></label>
  <button [disabled]="f.submitting">Sign up</button>
</form>
```

**With a schema:**

```ts
import { z } from 'zod'
const f = form(signup, { schema: z.object({ name: z.string().min(2), email: z.string().email() }) })
```

## Types

### FormError

```ts
type FormError<T> = { path: Path<T>; message: string; id: string; step: string | null }
```

An error being shown: its field's path, the message, the id of its message element (to link a summary to it) and its step.

```tscl
<ul>@for (e of f.errors; track e.path) { <li><a href="#{{ e.id }}">{{ e.message }}</a></li> }</ul>
```

### Path

```ts
type Path<T>
```

The dotted paths of a form's values, typed from `T`: `'customer.email'`, `'lines.0.item'`. For values typed `any`, any string.

### StandardSchema

```ts
type StandardSchema<T>
```

A [Standard Schema](https://standardschema.dev): Zod, Valibot, ArkType and others implement it. clarusjs declares the type itself, so it doesn't depend on any of them.
