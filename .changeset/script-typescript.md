---
'clarusjs': patch
---

A `<script>` is JavaScript, and TypeScript-only syntax in it is now an error at its place, named, in the build and in `clarusjs check` alike: `TypeScript syntax in a <script> (scripts are JavaScript): a type argument, request<string>(…)`. A type argument used to pass `check` and then run as two comparisons (`request < string > (…)`); annotations, `as`, `satisfies`, `!` and type declarations got acorn's "Unexpected token".
