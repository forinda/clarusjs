---
title: "Form validation"
group: "Interactivity"
order: 8
description: "clarusjs/forms: errors on their fields from native constraints, a Standard Schema and the server; multi-step forms in the URL hash; submit takes you to the errors."
---
@import signupSteps from '~/components/signup-steps.tscl'

# Form validation

<p class="lead">The forms engine, <code>clarusjs/forms</code>, validates a form and puts each error on its field, with nothing to wire per field. Multi-step forms keep their step in the URL, and a failed submit takes the user to the first error.</p>

It's headless: the engine finds fields, decides errors and moves focus; how fields, messages and steps look is your template and your CSS.

## A form with the engine

```tscl
<script>
  import { form } from 'clarusjs/forms'
  let signup = state({ name: '', email: '' })
  const f = form(signup)
</script>

<form [engine]="f">
  <div data-cl-field><label for="name">Name</label> <input id="name" name="name" required [(value)]="signup.name"> <small data-cl-message></small></div>
  <div data-cl-field><label for="email">Email</label> <input id="email" name="email" type="email" required [(value)]="signup.email"> <small data-cl-message></small></div>
  <button>Send</button>
</form>
```

- **`form(values)`** takes the form's state: a component's `state()`, or a store's (see [Shared stores](./stores.md)).
- **`[engine]="f"`** connects it to the `<form>` around that element (the element itself here).
- **Each field finds its own error** by the path it's bound to (`signup.email` is `email`): no path is written twice. Its message goes into the `[data-cl-message]` element of the nearest container around the field that has one (an element marked `data-cl-field`, a `label`, a `fieldset`), and the field gets `aria-invalid` and `aria-describedby` pointing at it. Put the message beside the label rather than inside it: inside, it would be read as part of the field's name.
- **Without JavaScript** it's a plain form: the browser checks `required` and `type="email"` itself, and it submits the fields that have a `name` (give each one, as above: the binding doesn't add it).

## Where errors come from

1. **The fields' own constraints:** `required`, `type`, `min`/`max`, `minlength`, `pattern`. The message is the browser's own, in the visitor's language, unless you give one: `form(values, { messages: { valueMissing: 'Required.', 'email': 'Enter your email.' } })` (by constraint, or by path).
2. **A [Standard Schema](https://standardschema.dev)** (Zod, Valibot, ArkType…) for the whole object: `form(values, { schema })`. Its issues land on their fields by path. It may be async (a username check against a server): the latest check wins, and `f.pending` is true meanwhile.
3. **The server:** errors returned from `submit`, or set with `f.setErrors({ email: 'Already registered.' })`. They show until that field's value changes.

When several apply to a field, the server's wins, then the schema's, then the constraint's.

Give the message element its space even when it's empty, so a message appearing as a field is left doesn't move the buttons under the pointer: `[data-cl-message] { display: block; min-height: 1.4em } [data-cl-message][hidden] { visibility: hidden }`.

## When errors show

By default a field's error appears once the field has been left (`show: 'blur'`), and then updates as it's typed in, not on the first keystroke. `show: 'input'` shows them while typing; `show: 'submit'` waits for the first submit. "Next" and submit show the errors they check regardless.

`f.touched(path)` (left once) and `f.changed(path)` (differs from the starting value) are there for your own styling.

## Steps

Mark each step with `data-cl-step` and an `id`, and move with `f.next()` and `f.back()`:

```tscl
<form [engine]="f">
  <fieldset id="details" data-cl-step> …fields… <button type="button" (click)="f.next()">Next</button></fieldset>
  <fieldset id="plan" data-cl-step> …fields… <button type="button" (click)="f.back()">Back</button> <button>Send</button></fieldset>
</form>
```

- **One step shows at a time,** and the current one is in the URL hash (`#plan`): Back and Forward move between steps, and a reload stays on one. Other hashes, like a heading's, leave the form alone.
- **"Next" checks only the current step.** With an error it stays and focuses it; "Back" never checks.
- **`f.steps`** lists `{ id, current, done, errors }` for a step list, as in the demo below.
- **Steps can be separate islands** inside one `<form>`, with the form in a store: each step puts `[engine]` on its section, and they all share the one form.
- **Without JavaScript** every step shows, as one long form. Before the island attaches every step shows briefly too; to avoid that, hide the other steps with CSS: `[data-cl-steps] [data-cl-step]:not([data-cl-current]) { display: none; }`.

## Submit

Submit checks everything. With errors it goes to the step holding the first one and focuses that field; `f.errors` lists every error (`{ path, message, id, step }`) for a summary, where each link can call `f.focus(path)`:

```tscl
@if (f.errors.length) {
  <div role="alert">
    @for (e of f.errors; track e.path) {
      <a [href]="'#' + e.id" (click)="$event.preventDefault(); f.focus(e.path)">{{ e.message }}</a>
    }
  </div>
}
```

Show the summary after a submit attempt (`(submit)="tried = true"` on the form, then `@if (tried && f.errors.length)`), not as fields are left: a summary appearing above the form moves the buttons under the pointer.

Without errors it calls your `submit(values)`. Server errors it returns, `{ errors: { email: '…' } }`, land on their fields the same way. One submit runs at a time (`f.submitting`).

## Editing existing data

To edit a record, start the form from it. From a page's `.load.ts`, the island gets the record as an input; start the state from a copy (inputs are read-only):

```tscl
@input user: { name: string; email: string }
<script>
  import { form } from 'clarusjs/forms'
  let edit = state({ ...user })
  const f = form(edit)
</script>
```

`f.changed(path)` then compares with the record, and `f.reset()` goes back to it. When the record arrives later (fetched in the browser) or is saved and reloaded, `f.reset(record)` sets it as the values and the new starting point, with touched and errors cleared.

## Type checking

`clarusjs check` (and the editor) checks the paths you give the form: `f.error('customer.emial')` is an error that lists the paths there are. `[engine]` must be given a form.

## Try it

Try "Next" with empty fields, the username `admin` (taken), the email `taken@example.com` (the pretend server says it's registered), and "Create account" from the last step with something missing.

<signupSteps />
