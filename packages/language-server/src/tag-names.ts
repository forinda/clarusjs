// A component's tag: its import name, or that name in kebab case when it has a hyphen (uiButton or UiButton →
// <ui-button>), as the compiler reads it (kebabOf in clarusjs's compiler/parse.ts).
export const kebabOf = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()

/** Does this tag name the import? */
export const namesImport = (tag: string, importName: string) => tag === importName || (tag.includes('-') && tag === kebabOf(importName))
