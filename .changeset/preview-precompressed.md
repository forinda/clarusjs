---
'clarusjs': patch
---

`vite preview` serves the precompressed copies that `compress` writes: the `.br` copy, else the `.gz` one, that the browser's `Accept-Encoding` accepts (not `q=0`), with `Content-Encoding`, the original's type and `Vary: Accept-Encoding`. A byte range, or a browser that accepts neither, gets the original. What preview sends now matches nginx `gzip_static` / Caddy `precompressed` with the same build.
