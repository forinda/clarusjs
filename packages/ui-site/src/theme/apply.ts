// A theme saved by /theme, applied to component demos (and the builder's preview) before the first paint, from an
// inline script in every page's <head> (vite.config.ts). Storage holds the CSS text toCss(theme, SCOPE) wrote.
export const STORAGE_KEY = 'ui-theme'
/** What a saved theme styles: demos and the builder's preview, never the site around them. */
export const SCOPE = '.demo, [data-ui-preview]'
/** The builder's own copy of the theme (encode()), so /theme reopens what was saved. */
export const SOURCE_KEY = 'ui-theme-source'
/** Google Fonts the builder offers: loaded when a theme names them. */
export const GOOGLE_FONTS = ['Inter', 'Geist', 'Lora', 'JetBrains Mono']

const FONT_LOADER = `function(t){${JSON.stringify(GOOGLE_FONTS)}.forEach(function(f){if(t.indexOf("'"+f+"'")>=0&&!document.querySelector('link[data-font="'+f+'"]')){var l=document.createElement("link");l.rel="stylesheet";l.setAttribute("data-font",f);l.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(f)+":wght@400;600;700&display=swap";document.head.appendChild(l)}})}`

/** Adds a stylesheet link for each offered Google Font that `text` (CSS or token values) names in quotes. */
export const loadFonts: (text: string) => void = new Function(`return ${FONT_LOADER}`)()

export const APPLY_SCRIPT = `try{var c=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(typeof c=="string"&&c.length<=20000&&c.indexOf("<")<0){var s=document.createElement("style");s.id="ui-theme";s.textContent=c;document.head.appendChild(s);(${FONT_LOADER})(c)}}catch(e){}`
