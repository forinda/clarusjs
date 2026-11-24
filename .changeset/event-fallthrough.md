---
"clarusjs": minor
---

`(name)` on a component that doesn't declare `@event name` is the DOM event on what it renders, as in Vue: `<likeButton (click)="likes++">` hears the click on its `<button>`, with the DOM event as `$event`. A declared `@event` still wins (the DOM event of the same name doesn't also fire). `clarusjs check` types `$event` as the DOM event and still reports a name that is neither an `@event` nor a DOM event.
