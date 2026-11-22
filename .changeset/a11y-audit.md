---
'@clarusjs/theme-docs': patch
'@clarusjs/content': patch
---

Accessibility fixes from a full audit of clarusjs.com. Theme: on phones the header's search button keeps its "Search" name for screen readers (the label is hidden visually, not removed), and a lesson's step segments are 24px tap targets (the bars still draw 8px high). Content: Markdown tables take focus (`tabindex="0"`), so one that scrolls sideways on a small screen can be scrolled from the keyboard.
