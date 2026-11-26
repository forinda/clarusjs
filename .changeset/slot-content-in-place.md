---
'clarusjs': patch
---

Content an island puts in a script-less component's slot is wired in place (#523): state it reads no longer renders the whole component again, so a field being typed in there keeps its focus and caret, and an open picker stays open. Only the component's own props changing render it again.
