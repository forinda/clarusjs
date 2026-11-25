// data-table.ts: sort, filter, page and count rows, and keep a table's state in the URL. Pure functions.
import { expect, test } from 'vitest'
import {
  facets,
  filterRows,
  nextSort,
  paginate,
  parseTable,
  serializeTable,
  sortRows,
} from '../src/registry/data-table.ts'

type R = { id: string; name: string; size: number | undefined; status: string }
const rows: R[] = [
  { id: 'a', name: 'item 10', size: 2, status: 'Done' },
  { id: 'b', name: 'item 9', size: 1, status: 'Open' },
  { id: 'c', name: 'Item 2', size: 2, status: 'Done' },
  { id: 'd', name: 'item 1', size: undefined, status: 'Open' },
]
const ids = (list: R[]) => list.map((r) => r.id)

test('sortRows: natural text order (2 before 10, any case), numbers by value, missing values last either way', () => {
  expect(ids(sortRows(rows, [{ id: 'name', desc: false }]))).toEqual(['d', 'c', 'b', 'a'])
  expect(ids(sortRows(rows, [{ id: 'size', desc: false }]))).toEqual(['b', 'a', 'c', 'd'])
  expect(ids(sortRows(rows, [{ id: 'size', desc: true }]))).toEqual(['a', 'c', 'b', 'd'])
})

test('sortRows: stable on ties, by several columns in turn, and a copy (the input stays as it was)', () => {
  expect(ids(sortRows(rows, [{ id: 'status', desc: false }]))).toEqual(['a', 'c', 'b', 'd'])
  expect(
    ids(
      sortRows(rows, [
        { id: 'status', desc: false },
        { id: 'name', desc: true },
      ]),
    ),
  ).toEqual(['a', 'c', 'b', 'd'])
  expect(
    ids(
      sortRows(rows, [
        { id: 'size', desc: true },
        { id: 'name', desc: false },
      ]),
    ),
  ).toEqual(['c', 'a', 'b', 'd'])
  expect(ids(sortRows(rows, []))).toEqual(['a', 'b', 'c', 'd'])
  expect(ids(rows)).toEqual(['a', 'b', 'c', 'd'])
})

test('nextSort: ascending, descending, off; multi adds a column; descFirst starts descending', () => {
  expect(nextSort([], 'name')).toEqual([{ id: 'name', desc: false }])
  expect(nextSort([{ id: 'name', desc: false }], 'name')).toEqual([{ id: 'name', desc: true }])
  expect(nextSort([{ id: 'name', desc: true }], 'name')).toEqual([])
  expect(nextSort([{ id: 'name', desc: false }], 'size')).toEqual([{ id: 'size', desc: false }])
  expect(nextSort([{ id: 'name', desc: false }], 'size', { multi: true })).toEqual([
    { id: 'name', desc: false },
    { id: 'size', desc: false },
  ])
  expect(
    nextSort(
      [
        { id: 'name', desc: false },
        { id: 'size', desc: true },
      ],
      'size',
      { multi: true },
    ),
  ).toEqual([{ id: 'name', desc: false }])
  expect(nextSort([], 'size', { descFirst: true })).toEqual([{ id: 'size', desc: true }])
})

test('filterRows: every word of the query in one of the columns; filters keep rows whose value is one of theirs; empty ones are ignored', () => {
  expect(ids(filterRows(rows, { query: 'ITEM 1', columns: ['name'] }))).toEqual(['a', 'd'])
  expect(ids(filterRows(rows, { filters: { status: ['Open'] } }))).toEqual(['b', 'd'])
  expect(ids(filterRows(rows, { query: 'item', columns: ['name'], filters: { status: ['Done'], size: [] } }))).toEqual([
    'a',
    'c',
  ])
  expect(ids(filterRows(rows, { query: '  ' }))).toEqual(['a', 'b', 'c', 'd'])
})

test('paginate: a page (from 0) kept within the pages there are, with what a pager needs', () => {
  expect(paginate(rows, 1, 3)).toEqual({
    page: 1,
    pages: 2,
    rows: [rows[3]],
    from: 4,
    to: 4,
    total: 4,
    canPrev: true,
    canNext: false,
  })
  expect(paginate(rows, 9, 3).page).toBe(1)
  expect(paginate([], 0, 3)).toEqual({
    page: 0,
    pages: 1,
    rows: [],
    from: 0,
    to: 0,
    total: 0,
    canPrev: false,
    canNext: false,
  })
})

test('facets: how many rows have each value, for filter buttons', () => {
  expect(facets(rows, 'status')).toEqual(
    new Map([
      ['Done', 2],
      ['Open', 2],
    ]),
  )
})

test('the URL: sort, query, filters and page (from 1 in the URL), defaults left out, and back', () => {
  const state = {
    sort: [
      { id: 'size', desc: true },
      { id: 'name', desc: false },
    ],
    query: 'item 1',
    filters: { status: ['Done', 'Open'] },
    page: 2,
  }
  const query = serializeTable(state)
  expect(query).toBe('sort=size.desc,name&q=item+1&status=Done&status=Open&page=3')
  expect(parseTable(new URLSearchParams(query), ['status'])).toEqual(state)
  expect(serializeTable({ sort: [], query: '', filters: { status: [] }, page: 0 })).toBe('')
  expect(parseTable(new URLSearchParams('page=nope&sort=,x.up'), ['status'])).toEqual({
    sort: [{ id: 'x', desc: false }],
    query: '',
    filters: { status: [] },
    page: 0,
  })
})
