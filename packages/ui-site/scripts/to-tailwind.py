#!/usr/bin/env python3
"""Writes the Tailwind version of a part stylesheet: the same selectors, each rule's declarations as @apply utilities
(Tailwind v4, idiomatic where a utility exists, an arbitrary property where none does). Run:
  scripts/to-tailwind.py src/registry/switch.tscl src/registry/switch.tw.css
The source is a .css file, or a .tscl whose <style global> holds the rules. Review the output: it is a starting point
kept in the repo, not a build step."""
import re, sys

def arg(v):
    v = v.strip()
    m = re.fullmatch(r'var\((--[\w-]+)\)', v)
    if m: return f'({m.group(1)})'
    return '[' + v.replace(' ', '_') + ']'

def typed(kind, v):  # a var() needs a type hint where a utility takes several kinds
    m = re.fullmatch(r'var\((--[\w-]+)\)', v.strip())
    return f'({kind}:{m.group(1)})' if m else (f'[{kind}:' + v.strip().replace(' ', '_') + ']' if v.strip().startswith('var(') else arg(v))

def size(prefix, v):
    v = v.strip()
    if v == '0': return f'{prefix}-0'
    if v == '100%': return f'{prefix}-full'
    if v == 'auto': return f'{prefix}-auto'
    return f'{prefix}-{arg(v)}'

def split(v):
    """Space-separated values, keeping calc(…) and var(…) whole however deep they nest."""
    out, cur, depth = [], '', 0
    for ch in v.strip():
        depth += ch == '('
        depth -= ch == ')'
        if ch == ' ' and depth == 0:
            if cur: out.append(cur)
            cur = ''
        else: cur += ch
    return out + ([cur] if cur else [])

def box(prefix, v):  # padding / margin shorthand
    parts = split(v)
    s = lambda p, x: f'{prefix}{p}-0' if x == '0' else (f'{prefix}{p}-auto' if x == 'auto' else f'{prefix}{p}-{arg(x)}')
    if len(parts) == 1: return [s('', parts[0])]
    if len(parts) == 2: return [s('y', parts[0]), s('x', parts[1])]
    if len(parts) == 3: return [s('t', parts[0]), s('x', parts[1]), s('b', parts[2])]
    return [s('t', parts[0]), s('r', parts[1]), s('b', parts[2]), s('l', parts[3])]

WEIGHTS = {'400': 'font-normal', '500': 'font-medium', '600': 'font-semibold', '700': 'font-bold'}

def font(v):
    v = v.strip()
    if v == 'inherit': return ['[font:inherit]']
    m = re.fullmatch(r'(?:(\d00)\s+)?(calc\([^/]*?\)|var\((?:[^()]|\([^()]*\))*\)|[\d.]+px)(?:\s*/\s*([\d.]+))?\s+(.+)', v)
    if not m: return [f'[font:{v.replace(" ", "_")}]']
    w, sz, lh, fam = m.groups()
    out = [WEIGHTS.get(w, f'font-[{w}]') if w else 'font-normal', f'text-{typed("length", sz)}', f'leading-[{lh}]' if lh else 'leading-[normal]']  # Tailwind's leading-normal is 1.5, not CSS normal
    fm = re.fullmatch(r'var\((--[\w-]+)\)', fam.strip())
    out.append(f'font-(family-name:{fm.group(1)})' if fm else f'font-[{fam.replace(" ", "_")}]')
    return out

def utils(prop, v):
    v = v.strip()
    imp = v.endswith('!important')
    if imp: v = v[:-len('!important')].strip()
    if prop.startswith('--'): out = [f'[{prop}:{v.replace(" ", "_")}]']
    elif prop == 'display': out = [{'block': 'block', 'inline-flex': 'inline-flex', 'flex': 'flex', 'grid': 'grid', 'none': 'hidden', 'inline-block': 'inline-block', 'contents': 'contents', 'inline-grid': 'inline-grid'}.get(v, f'[display:{v}]')]
    elif prop == 'color': out = ['text-inherit' if v == 'inherit' else f'text-{typed("color", v)}']
    elif prop in ('background', 'background-color'):
        out = ['bg-transparent' if v in ('none', 'transparent') else f'bg-{typed("color", v)}' if v.startswith('var(') else f'[background:{v.replace(" ", "_")}]']
    elif prop == 'border-radius': out = ['rounded-full' if v == '999px' else 'rounded-none' if v == '0' else f'rounded-{arg(v)}']
    elif prop.startswith('border-') and prop.endswith('-radius'):
        c = {'top-left': 'tl', 'top-right': 'tr', 'bottom-left': 'bl', 'bottom-right': 'br'}[prop[7:-7]]
        out = [f'rounded-{c}-{arg(v)}' if v != '0' else f'rounded-{c}-none']
    elif prop == 'padding': out = box('p', v)
    elif prop == 'margin': out = box('m', v)
    elif prop in ('margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'margin-inline-start', 'margin-inline-end'):
        p = {'margin-top': 'mt', 'margin-bottom': 'mb', 'margin-left': 'ml', 'margin-right': 'mr', 'margin-inline-start': 'ms', 'margin-inline-end': 'me'}[prop]
        out = [f'{p}-0' if v == '0' else f'{p}-auto' if v == 'auto' else f'{p}-{arg(v)}']
    elif prop == 'outline':
        m = re.fullmatch(r'(\d+)px\s+(\w+)\s+(.+)', v)
        out = ['outline-none'] if v in ('none', '0') else [f'outline-{m.group(1)}', f'outline-{m.group(2)}', f'outline-{typed("color", m.group(3))}'] if m else [f'[outline:{v.replace(" ", "_")}]']
    elif prop == 'outline-offset': out = [f'outline-offset-{v[:-2]}' if re.fullmatch(r'\d+px', v) else f'outline-offset-{arg(v)}']
    elif prop == 'border':
        m = re.fullmatch(r'(\d+)px\s+(\w+)\s+(.+)', v)
        sc = re.fullmatch(r'(solid|dashed|dotted)\s+(.+)', v)
        out = ['border-0', 'border-none'] if v in ('0', 'none') else [f'border-{sc.group(1)}', f'border-{typed("color", sc.group(2))}'] if sc else ([('border' if m.group(1) == '1' else f'border-{m.group(1)}'), f'border-{m.group(2)}', f'border-{typed("color", m.group(3))}'] if m else [f'[border:{v.replace(" ", "_")}]'])
    elif prop == 'border-color': out = [f'border-{typed("color", v)}']
    elif prop == 'border-width':
        w = split(v)
        w = (w * 4)[:4] if len(w) == 1 else w + w[:4 - len(w)] if len(w) == 2 else w
        out = [f'border-{side}-{x[:-2] if x.endswith("px") else x}' if x != '0' else f'border-{side}-0' for side, x in zip('trbl', w)]
    elif prop == 'cursor': out = [f'cursor-{v}']
    elif prop == 'font': out = font(v)
    elif prop == 'font-size': out = [f'text-{typed("length", v)}']
    elif prop == 'font-weight': out = [WEIGHTS.get(v, f'font-[{v}]')]
    elif prop == 'gap': out = [f'gap-{arg(v)}' if v != '0' else 'gap-0']
    elif prop == 'width': out = [size('w', v)]
    elif prop == 'height': out = [size('h', v)]
    elif prop == 'min-width': out = [size('min-w', v)]
    elif prop == 'max-width': out = ['max-w-none' if v == 'none' else size('max-w', v)]
    elif prop == 'min-height': out = [size('min-h', v)]
    elif prop == 'opacity': out = [f'opacity-{int(float(v) * 100)}' if float(v) * 100 % 5 == 0 else f'opacity-[{v}]']
    elif prop == 'align-items': out = [f'items-{v.replace("flex-", "")}']
    elif prop == 'justify-content': out = [{'space-between': 'justify-between', 'center': 'justify-center', 'flex-end': 'justify-end', 'flex-start': 'justify-start', 'end': 'justify-end', 'start': 'justify-start'}.get(v, f'[justify-content:{v}]')]
    elif prop == 'flex-wrap': out = [f'flex-{v}']
    elif prop == 'flex': out = ['flex-1' if v == '1' else 'flex-none' if v == 'none' else f'[flex:{v.replace(" ", "_")}]']
    elif prop == 'position': out = [v]
    elif prop in ('top', 'left', 'right', 'bottom'): out = [f'{prop}-0' if v == '0' else f'{prop}-{arg(v)}']
    elif prop == 'z-index': out = [f'z-[{v}]']
    elif prop == 'box-shadow': out = ['shadow-none' if v == 'none' else f'shadow-{arg(v)}']
    elif prop == 'transition':
        m = re.fullmatch(r'([\w-]+)\s+(\d+)ms', v)
        out = ['transition-none'] if v == 'none' else [f'transition-[{m.group(1)}]', f'duration-{m.group(2)}'] if m else [f'[transition:{v.replace(" ", "_")}]']
    elif prop == 'transform':
        m = re.fullmatch(r'translateX\(([^)]+)\)', v)
        r = re.fullmatch(r'rotate\((\d+)deg\)', v)
        out = [f'translate-x-[{m.group(1)}]'] if m else [f'rotate-{r.group(1)}'] if r else [f'[transform:{v.replace(" ", "_")}]']
    elif prop == 'content': out = [f"content-[{v}]" if v not in ("''", '""') else "content-['']"]
    elif prop == 'accent-color': out = [f'accent-{typed("color", v)}']
    elif prop == 'appearance': out = [f'appearance-{v}']
    else: out = [f'[{prop}:{v.replace(" ", "_")}]']
    return [u + '!' for u in out] if imp else out

def rule(m):
    head, body = m.group(1), m.group(2)
    decls = [d for d in re.split(r';\s*(?=[\w-]|$)', re.sub(r'/\*.*?\*/', '', body, flags=re.S)) if ':' in d]
    if not decls: return m.group(0)
    us = [u for d in decls for u in utils(d.split(':', 1)[0].strip(), d.split(':', 1)[1].strip().rstrip(';'))]
    indent = re.match(r'\s*', head.split('\n')[-1]).group(0)
    comments = ''.join(f'{indent}  {c}\n' for c in re.findall(r'/\*.*?\*/', body, flags=re.S))
    return f'{head}{{\n{comments}{indent}  @apply {" ".join(us)};\n{indent}}}'

src, out = sys.argv[1], sys.argv[2]
text = open(src).read()
if src.endswith('.tscl'): text = re.sub(r'(?m)^  ', '', re.search(r'<style global>\n([\s\S]*?)</style>', text).group(1))  # dedented
text = re.sub(r'/\* The same rules as @clarusjs/ui.*?\*/\n', '', text)
body = re.sub(r'([^{};]*?)\{([^{}]*)\}', rule, text)
name = re.sub(r'\.(tw\.)?css$', '', out.split('/')[-1])
head = f"""/*
  The Tailwind version of {name}'s styles: the same selectors and look as its CSS, written with Tailwind (v4) utilities.
  Import it where Tailwind runs, e.g. after tailwind.css. The --ui- tokens still set every colour, size and font.
*/
@reference "tailwindcss";
"""
open(out, 'w').write(head + body.lstrip())
