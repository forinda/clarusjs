---
'clarusjs': minor
'@clarusjs/language-server': minor
---

Template lint in `clarusjs check`: `unused-input`, `unused-import`, `img-alt`, `label-field` and `accessible-name`, reported as warnings at `file:line:col` (the exit code changes only with `--strict`, or a rule set to `'error'`). Set levels with the plugin's `lint` option, skip one place with `{{-- clarusjs-ignore rule --}}`, and add your own rules with `lintRules` (`lint()`, `lintRules` and `LintRuleDef` are exported from `clarusjs/compiler`). Every diagnostic now has a `severity`, also in `--json`. The language server shows the built-in rules' findings as warnings.
