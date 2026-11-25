---
title: "Data table"
group: "Data"
order: 3
description: "Sort (by several columns), search, filter, page and count rows, and keep it all in the URL: plain functions."
---

# Data table

<p class="lead">Sort (by several columns), search, filter, page and count rows, and keep it all in the URL: plain functions.</p>

<dataTableDemo />

## Usage

`data-table.ts` is a handful of pure functions over plain rows (after [TanStack Table](https://tanstack.com/table)'s sorting, filtering, pagination and faceting, without its table object). Put them behind a [Table](/components/table): the rows are yours, the markup is yours, and they run the same in an island or on the server.

- **`sortRows(rows, sort)`:** a sorted copy by each `{ id, desc }` in turn. Text in natural order (`item 2` before `item 10`), numbers by value, missing values last; rows that tie keep their order.
- **`nextSort(sort, id, { multi, descFirst })`:** the sort after a header click: ascending, descending, then off. With `multi` (Shift-click) the column is added to the others.
- **`filterRows(rows, { query, columns, filters })`:** the rows with every word of `query` in one of `columns`, and, for each filter (`{ team: ['Sales'] }`), one of its values. Empty filters are ignored.
- **`paginate(rows, page, size)`:** a page (from 0), kept within the pages there are, with `from`, `to`, `total`, `canPrev` and `canNext` for the pager.
- **`facets(rows, id)`:** how many rows have each value: the counts on the team buttons.
- **`parseTable(params, filterIds)`, `serializeTable(state)`:** the state to and from the URL (`?sort=joined.desc,name&q=…&team=Sales&page=2`), leaving defaults out. Replace the URL as it changes and the address is a link to that view; read it on load to open there.

Pass a third argument, `(row, id) => value`, to `sortRows`, `filterRows` or `facets` when a column isn't a property of the row. Sort a column by Shift-clicking its header after another's.

<<< ../../registry/data-table-demo.tscl

On a server-rendered page, the same functions make a table that works without JavaScript: read the state with `parseTable(url.searchParams, …)`, render the page of rows, and make the headers links (`serializeTable` with `nextSort`'s sort), the search and filters a `<form method="get">`, and the pager links.

## Source

Copy it into `src/components/ui/` as `data-table.ts`.

<<< ../../registry/data-table.ts

## Styling

- **On the root:** it has no markup of its own: the `class`, `style` and look are your table's (the [Table](/components/table) here) and your own.
- **Selectors:** none of its own; the demo puts `aria-sort` on the sorted column's `th` and `aria-pressed` on the filter buttons, which are good hooks for yours.
- **Your rules win:** no CSS ships with it.

## Needs

<needs name="data-table" />
