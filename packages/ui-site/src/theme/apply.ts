// A theme saved by /theme, applied to component demos (and the builder's preview) before the first paint, from an
// inline script in every page's <head> (vite.config.ts). Storage holds the CSS text toCss(theme, SCOPE) wrote.
export const STORAGE_KEY = 'ui-theme'
/** What a saved theme styles: demos and the builder's preview, never the site around them. */
export const SCOPE = '.demo, [data-ui-preview]'

export const APPLY_SCRIPT = `try{var c=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(typeof c=="string"&&c.length<=20000&&c.indexOf("<")<0){var s=document.createElement("style");s.id="ui-theme";s.textContent=c;document.head.appendChild(s)}}catch(e){}`
