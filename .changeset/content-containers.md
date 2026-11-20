---
"@clarusjs/content": minor
---

Containers and alerts: `::: tip|info|warning|danger [title]` and `::: details [title]` (a native `<details>`), plus GitHub alerts (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`). Plain HTML by default (`<div class="custom-block tip">`); with `container: { tag, from }` they render through your own component, a custom title filling its `title` slot. Titles can be localized with `titles`.
