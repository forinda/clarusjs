---
title: "Forms"
group: "Interactivity"
order: 7
description: "Bind form fields two ways with [(value)] and @model, keep one state object, and reset or undo without cloning."
---

# Forms

<p class="lead">A form is one piece of state, written back as people type. <code>[(value)]</code> binds a field two ways; field components declare the input they may write with <code>@model</code>.</p>

## Native fields

`[(value)]` on an `<input>`, `<textarea>` or `<select>`, and `[(checked)]` on a checkbox, show a value and write it back. On radios, `[(value)]` binds the group to one value: a radio is checked when the value equals its own, and picking it writes its own:

```tscl
<script>
  let form = state({ name: '', plan: 'free', updates: false })
</script>
<input [(value)]="form.name">
<label><input type="radio" name="plan" value="free" [(value)]="form.plan"> Free</label>
<label><input type="radio" name="plan" value="pro" [(value)]="form.plan"> Pro</label>
<input type="checkbox" [(checked)]="form.updates">
```

More kinds of fields:

- **A group of checkboxes** binds an array with `[(value)]` on each: a checkbox is checked when the array includes its value, and toggling adds or removes it (`<input type="checkbox" value="news" [(value)]="form.topics">`). A single checkbox is a boolean, with `[(checked)]`.
- **`<select multiple>`** with `[(value)]` binds an array of the selected values. For a long list, the [combobox](#a-combobox) below searches as you type; the demo's Languages uses it.
- **Number and range inputs** write numbers. A field that isn't a number, such as an empty one, stays a string.
- **While an input method composes text** (Japanese, Chinese, Korean…), nothing is written; the composed text is, when it's done.
- **A bound `<select>`'s options** render `selected` on the server, so the choice shows before any JavaScript.
- **Radios, checkboxes and number fields need a static `type`** to bind this way; a field whose `[type]` is bound (text or email) binds as text.

The target is a state variable or a property path of one. A write replaces the state, copy-on-write: typing in the first field runs `form = { ...form, name: value }`. Nothing is changed in place.

## Field components

Inputs are read-only: a component never writes what its parent gives it. The one exception is a `@model` input, which a parent binds with `[(…)]`:

```tscl
{{-- text-field.tscl --}}
@input label: string
@model value: string = ''
<label>{{ label }} <input [(value)]="value"></label>

{{-- the form --}}
<textField [label]="'Name'" [(value)]="form.name" />
```

When the field writes `value`, the write goes to the form, which updates its state, and the new value comes back to the field as an input, in place. The form stays the one owner of the data. A field with no parent binding it (an island on its own) keeps the value itself.

`clarusjs check` makes sure `[(x)]` names a `@model` of that component, and that the target can be written: binding to a read-only input is an error.

## A combobox

A text field that filters a list as you type, for one pick or several. It's a part of [`@clarusjs/ui-primitives`](/guide/ui-primitives#parts) (`@import combobox from '@clarusjs/ui-primitives/combobox.tscl'`), headless, and one `.tscl` file you can copy instead: [`combobox.tscl`](https://github.com/forinda/clarusjs/blob/main/packages/ui-primitives/src/combobox.tscl), also in the [playground](/repl) as *Combobox*. Bind one pick with `[(value)]`, or several with `[multiple]="true"` and `[(values)]`:

```tscl
<combobox [id]="'country'" [label]="'Country'" [options]="countries" [(value)]="form.country" />
<combobox [id]="'languages'" [label]="'Languages'" [options]="languages" [multiple]="true" [(values)]="form.languages" />
<combobox [id]="'city'" [label]="'City'" [src]="'/api/cities'" [(value)]="form.city" />
```

<comboboxDemo />

- **Keyboard:** ↑ and ↓ move through the options, Home and End jump, Enter picks, Esc closes, and Backspace in an empty search removes the last pick.
- **Accessible:** the input is a `role="combobox"` that points to its `role="listbox"`; the highlighted option is its `aria-activedescendant`, picked ones are `aria-selected`, and "No match" is announced.
- **Two `@model`s:** `value` (a string) and `values` (a list). Each binds two ways with its own type, so `clarusjs check` knows a single pick is a string.
- **Options from the server:** give `[src]` a URL instead of `[options]`. Typing asks `src?q=<search>` for a JSON list of `{ value, label }`, 200 ms after the last key; each search is cached, and an older one in flight is cancelled when a newer one starts (it's a [`resource()`](/guide/fetching)). "Searching…" and errors show in its status line. The demo's City searches [an endpoint](https://github.com/forinda/clarusjs/blob/main/packages/docs/src/pages/api/demo-cities.ts) of this site.
- **Give each one its own `id`:** its listbox and options are named after it.

## Reset and undo

State is replaced, never changed in place, so a previous state is simply the old value. Nothing needs cloning:

```tscl
<script>
  let form = state({ name: '', email: '' })
  const initial = form                              // the starting value
  const changed = derived(() => form !== initial)
  let past = state([])

  function reset() { form = initial }
  function remember() { past = [...past, form] }    // before a change you may want to undo
  function undo() { form = past.at(-1) ?? initial; past = past.slice(0, -1) }
</script>
```

Take the starting value from the state (`const initial = form`), not from the object you passed to `state()`. In the browser, an island's state is restored from what the server rendered, so it's a copy.

Try it: fill in the form, then reset it.

<signupForm />

## Large forms

The same pieces scale: one state object for the whole form, sections as nested objects, and paths for everything.

```tscl
<script>
  let order = state({
    customer: { name: '', email: '' },
    lines: [{ item: 'Notebook', qty: '1', price: '4' }],
  })
  const initial = order
  const total = derived(() => order.lines.reduce((sum, line) => sum + Number(line.qty) * Number(line.price), 0))
  const errors = derived(() => ({ name: order.customer.name.trim() ? '' : 'Enter a name.' }))
  function addLine() { order = { ...order, lines: [...order.lines, { item: '', qty: '1', price: '0' }] } }
  function removeLine(index) { order = { ...order, lines: order.lines.filter((_, i) => i !== index) } }
</script>

<textField [label]="'Name'" [(value)]="order.customer.name" />
@for (line of order.lines; track $index) {
  <input [(value)]="order.lines[$index].item">
  <button (click)="removeLine($index)">×</button>
}
```

- **Repeating groups.** Bind a row's field through the list and its index: `[(value)]="order.lines[$index].item"`. A write replaces that one line and the list around it, copy-on-write. Binding the row variable itself (`line.item`) is an error, because it would only change the row's copy.
- **Adding and removing** replaces the list: `[...lines, next]`, `lines.filter(…)`.
- **Derived values** such as totals, errors or "has anything changed" are `derived()`. They recompute when the parts they read change, and nothing else does. Keep validation in a `.ts` module so the server can run the same rules.
- **Text in, numbers out.** `[(value)]` writes the field's text, as the browser gives it. Convert where you compute (`Number(line.qty)`), or keep a number in state with `(input)="qty = $event.target.valueAsNumber"`.
- **Sections as components.** A section with many fields can be its own component with an object `@model`: `<addressFields [(value)]="order.shipping" />`, where its fields bind `[(value)]="value.street"`. Each write replaces the section, which writes it back to the order.
- **Submitting.** `(submit)="$event.preventDefault(); send(order)"` posts the one object as JSON. Server validation can return errors by field path, to show next to each field.

A copy per keystroke is cheap: only the changed path is new, and the rest is shared. Even a form with hundreds of fields stays quick.

Try it: add lines, change quantities, remove one, send, reset.

<orderForm />
