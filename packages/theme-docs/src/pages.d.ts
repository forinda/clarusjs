// The pages themeDocs() reads, for the sidebar. Reference it from a .d.ts in your project:
// /// <reference types="@clarusjs/theme-docs/pages.d.ts" />
declare module 'virtual:theme-docs/pages' {
  const pages: import('./nav.ts').PageInfo[]
  export default pages
}
