---
title: "Island attributes"
group: "Templates"
order: 2
description: "Attributes you can put on an interactive component tag, and the island element."
---

# Island attributes

## On a component tag

| Attribute | Values | Default |
|---|---|---|
| `[input]="expr"` | any expression |  |
| `attach` | `load`, `idle`, `visible`, `interaction` | `load` |

## On the island element

The server wraps each island in `<cl-island>`. You don't write these; they are listed so the HTML is easy to read.

| Attribute | Meaning |
|---|---|
| `c` | component name |
| `src` | URL of its code |
| `p` | its props |
| `s` | its state when the server rendered it |
| `a` | when to attach, if not on load |
| `data-cl-ready` | set once it has attached |
