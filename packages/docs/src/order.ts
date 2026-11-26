// The Forms guide's order form: its rules as a Standard Schema written by hand (a schema library would do the same in a
// few lines; the docs site keeps no dependency for it). The engine puts each issue on the field with its path.
import type { StandardSchema } from 'clarusjs/forms'

export type Order = { customer: { name: string; email: string }; lines: { item: string; qty: string; price: string }[] }

export const orderSchema: StandardSchema<Order> = {
  '~standard': {
    version: 1,
    vendor: 'clarusjs-docs',
    validate(value) {
      const v = value as Order
      const issues: { message: string; path: string[] }[] = []
      if (!v.customer.name.trim()) issues.push({ message: 'Enter a name.', path: ['customer', 'name'] })
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.customer.email)) issues.push({ message: 'Enter an email like ada@example.com.', path: ['customer', 'email'] })
      if (v.lines.some((line) => !line.item.trim())) issues.push({ message: 'Every line needs an item.', path: ['lines'] })
      return issues.length ? { issues } : { value: v }
    },
  },
}
