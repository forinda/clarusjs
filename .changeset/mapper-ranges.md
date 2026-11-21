---
'clarusjs': patch
---

Content mapper: an error on a whole construct underlines all of it (a missing prop underlines `<card`, a two-way binding check `[(open)]`), not one character; and generated stand-ins (`__cl_p`) take no part in hover, completion or rename.
