---
'@clarusjs/theme-docs': minor
---

Replace a part of the docs layout with a file of your own: `themeDocs({ components: { footer: '/src/theme/footer.tscl' } })` (`header`, `sidebar`, `contents`, `pageFooter`, `footer`). The layout uses your file in dev and build, in the browser too; it is checked against the part it replaces (no required input the layout doesn't pass, every slot the layout fills), and a mistake is a build error that says what to fix.
