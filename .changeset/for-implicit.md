---
'clarusjs': minor
---

`@for` rows have `$count`, `$first`, `$last`, `$even` and `$odd` besides `$index` (#249). In an island they follow the list: add a row, and the old last row isn't `$last` any more. Type checking knows them (`$count` a number, the others booleans).

Clearer `@for` errors:

- an item named like one of those names;
- a second `track`;
- a second `@empty`.

An island `@for` without `track` now warns: rows are matched by position, so a row's state can move to another item. Matching by position on purpose? Write `track $index`. A script can't declare a variable named like one of the row names.
