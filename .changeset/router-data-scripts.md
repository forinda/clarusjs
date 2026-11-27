---
'clarusjs': patch
---

When a client route swapped in, its page's JSON-LD or JSON `<script>` in the head ran as JavaScript and threw ("Unexpected token ':'"), and on those pages islands could fail to attach. Now only real scripts run (no type, `module`, or a JavaScript type), and a module script stays a module.
