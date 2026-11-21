// Types of the forms engine (clarusjs/forms).

/** A Standard Schema (https://standardschema.dev): Zod, Valibot, ArkType… Declared here, so there's no dependency. */
export type StandardSchema<T = unknown> = {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    validate(value: unknown): StandardResult<T> | Promise<StandardResult<T>>
  }
}
export type StandardIssue = { readonly message: string; readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> }
export type StandardResult<T> = { readonly value: T; readonly issues?: undefined } | { readonly issues: ReadonlyArray<StandardIssue> }

/** The dotted paths of a form's values: `customer.email`, `lines.0.item` (any string for values typed `any`). */
export type Path<T> = 0 extends 1 & T ? string : PathOf<T, 6>
type Prev = [never, 0, 1, 2, 3, 4, 5]
type PathOf<T, D extends number> = [D] extends [never] ? never
  : T extends readonly (infer U)[] ? `${number}` | `${number}.${PathOf<U, Prev[D]>}`
  : T extends object ? { [K in keyof T & string]: K | `${K}.${PathOf<T[K], Prev[D]>}` }[keyof T & string]
  : never

export type FormOptions<T> = {
  /** Validates the whole object; its issues land on their fields by path. Sync or async. */
  schema?: StandardSchema<T>
  /** When a field's error appears: after it's been left once ('blur', the default), on input, or on submit. */
  show?: 'blur' | 'input' | 'submit'
  /** Messages for native constraints, by path (`'customer.email'`) or by constraint (`valueMissing`, `typeMismatch`…). */
  messages?: Record<string, string>
  /** Called with the values once everything is valid; may return server errors by path. */
  submit?(values: T): void | { errors?: Record<string, string> } | Promise<void | { errors?: Record<string, string> }>
}

/** An error being shown, for a summary: its path, message, its message element's id, and its step. */
export type FormError = { path: string; message: string; id: string; step: string | null }

export type Form<T> = {
  /** The message shown for a field now: '' when there is none, or it isn't shown yet. */
  error(path: Path<T>): string
  /** Every error being shown, in document order. */
  readonly errors: FormError[]
  /** Left at least once. */
  touched(path: Path<T>): boolean
  /** Differs from the starting value. */
  changed(path: Path<T>): boolean
  /** No errors at all (shown or not). */
  readonly valid: boolean
  /** An async schema check is running. */
  readonly pending: boolean
  /** Server errors by path (they show until that field's value changes). */
  setErrors(errors: Record<string, string>): void
  /** Focus a field (the checked radio of a group, else the first). */
  focus(path: Path<T>): void
  /** Back to the starting values, with touched and errors cleared. */
  reset(): void
}
