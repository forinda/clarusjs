// Runs on every page's <head> after the title template and site tags (see the head option in vite.config.ts).
// Google Tag Manager: fragment navigation keeps the head, so it loads once per full page load. Left out of the build
// the browser tests run (NO_ANALYTICS): they don't depend on the network or count as visits.
const gtm = `<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-T4LNFLW4"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
</script>`

export function transformHead(head: string): string {
  return `${head}<meta name="generator" content="clarusjs">${process.env.NO_ANALYTICS ? '' : gtm}`
}
