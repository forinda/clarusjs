// The Volar language plugin: a .tscl file is a root code with an HTML view (its template syntax blanked) and a CSS
// view per <style>, each mapped to the source, for Volar's HTML, CSS and Emmet services. TypeScript inside templates
// isn't here: TypeScript's own language server gives it through the content mapper.
import type { CodeInformation, CodeMapping, IScriptSnapshot, LanguagePlugin, VirtualCode } from '@volar/language-core'
import type { URI } from 'vscode-uri'
import { blankOut, scan, type Range } from './blank.ts'

const ALL: CodeInformation = { verification: true, completion: true, semantic: true, navigation: true, structure: true, format: true }
const EMBEDDED: CodeInformation = { ...ALL, format: false }

export const snapshotOf = (text: string): IScriptSnapshot => ({
  getText: (start, end) => text.slice(start, end),
  getLength: () => text.length,
  getChangeRange: () => undefined,
})

/** A .tscl document, with its HTML and CSS views as embedded codes. */
export class TsclVirtualCode implements VirtualCode {
  readonly id = 'root'
  readonly languageId = 'tscl'
  readonly snapshot: IScriptSnapshot
  readonly mappings: CodeMapping[]
  readonly embeddedCodes: VirtualCode[]

  constructor(readonly text: string) {
    this.snapshot = snapshotOf(text)
    this.mappings = [{ sourceOffsets: [0], generatedOffsets: [0], lengths: [text.length], data: ALL }]
    const { blank, styles } = scan(text)
    const html = blankOut(text, blank)
    // 1:1 mappings for the kept stretches between blanked ranges.
    const kept: CodeMapping[] = []
    let at = 0
    for (const [a, b] of [...blank].sort((x, y) => x[0] - y[0])) {
      if (a > at) kept.push({ sourceOffsets: [at], generatedOffsets: [at], lengths: [a - at], data: EMBEDDED })
      at = Math.max(at, b)
    }
    if (text.length > at) kept.push({ sourceOffsets: [at], generatedOffsets: [at], lengths: [text.length - at], data: EMBEDDED })
    this.embeddedCodes = [
      { id: 'html', languageId: 'html', snapshot: snapshotOf(html), mappings: kept },
      ...styles.map(([from, to]: Range, n): VirtualCode => ({
        id: `css_${n}`,
        languageId: 'css',
        snapshot: snapshotOf(text.slice(from, to)),
        mappings: [{ sourceOffsets: [from], generatedOffsets: [0], lengths: [to - from], data: EMBEDDED }],
      })),
    ]
  }
}

export const tsclLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId: (uri) => (uri.path.endsWith('.tscl') ? 'tscl' : undefined),
  // By the file name too: not every editor sends the `tscl` language id.
  createVirtualCode(uri, languageId, snapshot) {
    if (languageId !== 'tscl' && !uri.path.endsWith('.tscl')) return undefined
    return new TsclVirtualCode(snapshot.getText(0, snapshot.getLength()))
  },
}
