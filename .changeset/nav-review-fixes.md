---
'clarusjs': patch
---

Navigation fixes from review:
- a navigation cancelled before it starts (a `beforeNavigate` hook) no longer leaves `data-cl-navigating` set or sends a later history change to the cancelled URL;
- a failure before the URL changed is reported with the error itself, and the normal page load starts after that;
- `afterSwap` and `afterNavigate` run once the new page's islands that attach right away are attached;
- `onNavigateError` gets the page it was going to;
- a hook whose island was released by an earlier hook is skipped;
- the 500 page keeps `status` when it has its own `load()`;
- a redirect whose file would replace a generated page or data file, or land outside the site, fails the build;
- the browser runtime typechecks from source without an `ImportMeta.env` declaration.
