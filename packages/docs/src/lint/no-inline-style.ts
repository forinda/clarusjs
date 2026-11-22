// This site's own lint rule (the recipe in the Lint guide): styles live in each component's <style> block, where
// they are scoped and minified, not in style="…" attributes. Bound styles ([style]) change at run time: left alone.
import type { LintRuleDef } from 'clarusjs/compiler'

export const noInlineStyle: LintRuleDef = {
  name: 'no-inline-style',
  check({ elements, report }) {
    for (const el of elements) {
      const style = el.attrs.find((a) => a.name === 'style' && (a.kind === 'static' || a.kind === 'interp'))
      if (style) report(style.start, `style="…" on <${el.tag}>: put it in the component's <style> block`)
    }
  },
}
