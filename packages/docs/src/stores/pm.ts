// The reader's package manager: shared by every command tab group on the page, remembered across pages.
import { state } from 'clarusjs/runtime'
import type { Manager } from '../pm.ts'

export const pm = state<Manager>('pnpm')
