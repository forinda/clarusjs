---
'@clarusjs/ai': minor
---

`--out` for `agents` and `skill`: write the AGENTS.md section into another file (`--out CLAUDE.md`), and the skill to another folder or file (`--out .agents/skills/clarusjs`, `--out .cursor/rules/clarusjs.mdc`). `--out -` prints instead of writing. The command line now runs on commander: `--help` for each command, and clear errors for unknown options and a missing folder.
