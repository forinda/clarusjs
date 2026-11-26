// The grid's reaction to a pointer (mouse, pen or finger) over its section, for grid-effect.tscl's [use]:
//   spotlight: a soft circle of stronger lines follows the pointer (CSS mask at --ui-grid-x/y);
//   trail: each cell it crosses fills faintly, then fades (CSS transition on [data-on]);
//   lean: lines near it bow toward it and crossings swell into dots (SVG, redrawn at most once per frame).
// It listens on the section (the layer ignores the pointer, so text and links on top still work), does nothing until
// the pointer enters, and nothing at all under prefers-reduced-motion: the static grid stays.

export type GridEffect = 'spotlight' | 'trail' | 'lean'

const NS = 'http://www.w3.org/2000/svg'
const REACH = 120 // px: lines this close bow toward the pointer
const BOW = 7 // px: how far, at most
const DOTS = 130 // px: crossings this close become dots

export function gridEffect(el: HTMLElement, { effect }: { effect: GridEffect }): () => void {
  // The section: the nearest ancestor that's a box (an island's <cl-island> wrapper is display: contents).
  let host = el.parentElement
  while (host?.localName === 'cl-island') host = host.parentElement
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}
  host.style.touchAction ||= 'pan-y pinch-zoom' // a finger's drag moves it, and still scrolls and zooms the page
  const cell = () => parseFloat(getComputedStyle(el).getPropertyValue('--ui-grid-cell')) || 48
  let at: [number, number] | null = null
  let frame = 0
  let cols = 0
  let rows = 0
  let last = -1

  const draw = () => {
    frame = 0
    el.textContent = ''
    host.toggleAttribute('data-grid-lean', !!at)
    if (!at) return
    const [px, py] = at
    const w = el.clientWidth, h = el.clientHeight, step = cell()
    const svg = document.createElementNS(NS, 'svg')
    const bow = (d: number) => Math.max(0, 1 - d / REACH) * BOW
    const line = (vertical: boolean, c: number) => {
      let d = ''
      for (let t = 0; t <= (vertical ? h : w); t += 8) {
        const [x, y] = vertical ? [c, t] : [t, c]
        const k = bow(Math.hypot(px - x, py - y))
        d += `${d ? 'L' : 'M'}${vertical ? x + Math.sign(px - x) * k : x} ${vertical ? y : y + Math.sign(py - y) * k}`
      }
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', d)
      svg.append(path)
    }
    for (let x = step; x < w; x += step) line(true, x)
    for (let y = step; y < h; y += step) line(false, y)
    for (let x = step; x < w; x += step) {
      for (let y = step; y < h; y += step) {
        const d = Math.hypot(px - x, py - y)
        if (d > DOTS) continue
        const dot = document.createElementNS(NS, 'circle')
        dot.setAttribute('cx', String(x))
        dot.setAttribute('cy', String(y))
        dot.setAttribute('r', String(1 + (1 - d / DOTS) * 2.5))
        svg.append(dot)
      }
    }
    el.append(svg)
  }
  const soon = () => { frame ||= requestAnimationFrame(draw) }

  const mark = (x: number, y: number) => {
    const step = cell()
    const n = Math.ceil(el.clientWidth / step)
    const m = Math.ceil(el.clientHeight / step)
    if (n !== cols || m !== rows) {
      // (Re)lay the cells for this size: one per square, in rows of n, the columns set here so the layout and the
      // count agree at any width (the last column is cut off).
      cols = n
      rows = m
      last = -1
      el.textContent = ''
      el.style.gridTemplateColumns = `repeat(${n}, ${step}px)`
      for (let i = 0; i < n * m; i++) {
        const c = document.createElement('i')
        c.setAttribute('data-cell', '')
        el.append(c)
      }
    }
    const i = Math.floor(y / step) * cols + Math.floor(x / step)
    if (i === last) return
    last = i
    const c = el.children[i]
    if (!c) return
    c.setAttribute('data-on', '')
    requestAnimationFrame(() => requestAnimationFrame(() => c.removeAttribute('data-on')))
  }

  const move = (e: PointerEvent) => {
    const r = host.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    if (effect === 'spotlight') {
      el.style.setProperty('--ui-grid-x', `${x}px`)
      el.style.setProperty('--ui-grid-y', `${y}px`)
    } else if (effect === 'trail') mark(x, y)
    else {
      at = [x, y]
      soon()
    }
  }
  const enter = () => el.setAttribute('data-active', '')
  const leave = () => {
    el.removeAttribute('data-active')
    last = -1
    if (effect === 'lean') {
      at = null
      soon()
    }
  }
  const events = [['pointerenter', enter], ['pointermove', move], ['pointerleave', leave]] as const
  for (const [type, fn] of events) host.addEventListener(type, fn as EventListener)
  return () => {
    for (const [type, fn] of events) host.removeEventListener(type, fn as EventListener)
    cancelAnimationFrame(frame)
    host.removeAttribute('data-grid-lean')
  }
}
