---
"clarusjs": minor
---

**Breaking:** component files use the `.tscl` extension instead of `.clarus` ("TypeScript + clarus"). Rename your files (`for f in $(git ls-files '*.clarus'); do git mv "$f" "${f%.clarus}.tscl"; done`) and the imports that name them. The Vite plugin, `clarusjs check` and error locations (`file.tscl:line:col`) all use the new extension.
