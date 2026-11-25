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

/**
 * Sets the saved theme as <style id="ui-theme"> before the first paint, and again (or removes it) whenever another tab,
 * or the page around a block's frame, saves or resets one.
 */
export const APPLY_SCRIPT = `(function(){var k=${JSON.stringify(STORAGE_KEY)};function a(){try{var c=localStorage.getItem(k),s=document.getElementById("ui-theme");if(typeof c=="string"&&c.length<=20000&&c.indexOf("<")<0){if(!s){s=document.createElement("style");s.id="ui-theme";document.head.appendChild(s)}s.textContent=c;(${FONT_LOADER})(c)}else if(s)s.remove()}catch(e){}}a();addEventListener("storage",function(e){if(!e.key||e.key===k)a()})})()`

/**
 * Every page, the block views in frames too: the light/dark choice the header's switch saved (theme-docs keeps it in
 * localStorage as clarusjs-theme), applied before the first paint and again whenever another page or the page
 * around a frame changes it.
 */
export const SCHEME_SCRIPT = `(function(){function a(){try{var t=localStorage.getItem("clarusjs-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);else document.documentElement.removeAttribute("data-theme")}catch(e){}}a();addEventListener("storage",function(e){if(!e.key||e.key==="clarusjs-theme")a()})})()`

/** Which styles the component pages show: 'css' (the default) or 'tailwind', remembered. */
export const FLAVOR_KEY = 'ui-flavor'
/** Sets <html data-flavor> from the saved choice before the first paint, so the right code shows at once. */
export const FLAVOR_SCRIPT = `try{var f=localStorage.getItem(${JSON.stringify(FLAVOR_KEY)});if(f==="tailwind")document.documentElement.setAttribute("data-flavor","tailwind")}catch(e){}`
