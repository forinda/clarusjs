---
'clarusjs': patch
---

The client router and fragment navigation decide which navigations to take over in one shared place. Behaviour is unchanged; each script carries its own copy, so pages load no extra file.
