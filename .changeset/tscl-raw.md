---
'clarusjs': patch
---

A `.tscl` file imported with `?raw`, `?url` or `?inline` (a code sample, a playground example) is left to Vite instead of being compiled as a component, which failed the build.
