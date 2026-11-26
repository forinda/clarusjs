---
'clarusjs': minor
---

Event modifiers and `$values` (#444): `(submit.prevent)="send($values)"` keeps a form in the page without `$event.preventDefault()`, and `$values` is the form's fields as an object (a repeated name gives a list; the submitter counts). Also `.stop`, `.self`, `.once`, keys (`(keydown.enter)`, `(keydown.esc)`, a letter) and `.ctrl`, `.shift`, `.alt`, `.meta`. A misspelled modifier, a key on an event without keys, or a modifier on a component's event is a located error; `clarusjs check` types `$event` by the event's name and `$values` as `Record<string, any>`.
