---
'clarusjs': minor
---

Radio groups bind two ways (#267). `[(value)]` on `<input type="radio" value="pro">` is checked when the bound value equals the radio's value, and picking it writes that value: `plan: 'free' | 'pro'` binds to a group of radios, as Vue's `v-model` does. The value can be static or `[value]`. A bound radio without a value is a compile error. Type checking checks each radio's static value against the bound type.
