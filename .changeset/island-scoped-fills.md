---
'clarusjs': patch
---

A fill that receives a slot's data (`@slot('row', { item }) { … }`) can be inside an island when it shows the data: the island renders the component again, fill included, when what they read changes. Handlers and bindings in such a fill are still an error, now at their place.
