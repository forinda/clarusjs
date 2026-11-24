// The sidebar's collapsed state, on <html data-sidebar="open|collapsed">, remembered in localStorage. SIDEBAR_SCRIPT
// goes inline in the <head> so a remembered collapse applies before the first paint (no jump on load).

export const SIDEBAR_KEY = 'ui-sidebar'

export const SIDEBAR_SCRIPT = `try{var v=localStorage.getItem(${JSON.stringify(SIDEBAR_KEY)});if(v==="collapsed"||v==="open")document.documentElement.setAttribute("data-sidebar",v)}catch(e){}`

/**
 * Collapse or reopen the sidebar on a wide screen, and remember it.
 * @param {HTMLElement | null} nav the sidebar (its data-state follows)
 * @returns {'open' | 'collapsed'} the new state
 */
export function toggleSidebar(nav) {
  const root = document.documentElement
  const current = root.dataset.sidebar ?? nav?.dataset.state ?? 'open'
  const next = current === 'collapsed' ? 'open' : 'collapsed'
  root.dataset.sidebar = next
  if (nav) nav.dataset.state = next
  try { localStorage.setItem(SIDEBAR_KEY, next) } catch {}
  return next
}
