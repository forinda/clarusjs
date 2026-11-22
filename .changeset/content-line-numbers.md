---
'@clarusjs/content': minor
---

`markdown({ lineNumbers: true })` numbers the lines of every code block except shell commands (`sh`, `bash`, `shell`, `zsh`, `console`, `powershell`, `ps1`). A shell script is numbered: a block with a file title (`[deploy.sh]`) or a `#!` first line. `:no-line-numbers` after the language turns one block off; `:line-numbers` still turns one on.
