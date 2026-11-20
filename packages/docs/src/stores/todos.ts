// A store: module-level state shared by every island that uses it (the to-do list and the summary on the home page).
import { state } from 'clarusjs/runtime'

export type Todo = { id: number; text: string }

export const todos = state<Todo[]>([{ id: 1, text: 'Read the islands guide' }])
