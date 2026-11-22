### Common mistakes

These fail to compile, with `file.tscl:line:col` and a message that says what to do:

```tscl wrong
@if loggedIn {<p>Hi</p>}
```

```tscl right
@input loggedIn: boolean = false
@if (loggedIn) {
  <p>Hi</p>
}
```

An `@input` belongs to the parent: it is read-only. Copy it into state to change it.

```tscl wrong
@input count: number = 0
<script>
  function add() {
    count++
  }
</script>
<button type="button" (click)="add()">{{ count }}</button>
```

```tscl right
@input count: number = 0
<script>
  let n = state(count)
  function add() {
    n++
  }
</script>
<button type="button" (click)="add()">{{ n }}</button>
```

An event needs a `<script>`: a component without one is static HTML and ships no JavaScript.

```tscl wrong
<button type="button" (click)="open = !open">Toggle</button>
```

```tscl right
<script>
  let open = state(false)
</script>
<button type="button" (click)="open = !open">{{ open ? 'Hide' : 'Show' }}</button>
```

`[(value)]` binds form fields only (`<input>`, `<select>`, `<textarea>`; `[(checked)]` on a checkbox).

```tscl wrong
<script>
  let text = state('')
</script>
<div [(value)]="text"></div>
```

```tscl right
<script>
  let text = state('')
</script>
<label>Note <input [(value)]="text" /></label>
```

These compile, but are wrong:

- **Changing state in place.** In a script or an event handler, `items.push(x)` or `form.name = 'a'` changes the
  value without telling anyone, so the page doesn't update; the compiler warns. Assign a new value:
  `items = [...items, x]`, `form = { ...form, name: 'a' }`. (Two-way bindings such as `[(value)]="form.name"` do this
  for you.)
- **`@for` without `track`.** Rows are matched by position, so a row's state moves to another item when the list
  changes order. `clarusjs check` warns; use `track item.id` (or another unique key).
- **Other frameworks' habits.** There is no `useState`, `ref()`, `this` or `className`: use `state()`, plain
  variables and `class`. `clarusjs check` reports names that don't exist.
- **Images, labels and buttons without names.** `clarusjs check` lints them: give every `<img>` an `alt` (`alt=""`
  for decoration), every `<label>` a field, every button and link text or `aria-label`.
