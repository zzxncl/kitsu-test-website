/* Kitsu Live — tiny DOM + formatting helpers (no framework, on purpose). */

/** Tagged-template HTML escaper. Interpolations are escaped unless wrapped in raw(). */
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) {
    out += stringify(vals[i]) + strings[i + 1];
  }
  return out;
}
const RAW = Symbol('raw');
export function raw(s) { return { [RAW]: String(s ?? '') }; }
function stringify(v) {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(stringify).join('');
  if (typeof v === 'object' && RAW in v) return v[RAW];
  return esc(v);
}
export function esc(v) {
  return String(v)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function attr(v) { return esc(v ?? ''); }

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
}

export function on(root, evt, sel, fn) {
  root.addEventListener(evt, (e) => {
    const t = e.target.closest(sel);
    if (t && root.contains(t)) fn(e, t);
  });
}

export const debounce = (fn, ms = 250) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
export const throttle = (fn, ms = 100) => {
  let last = 0, timer;
  return (...a) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...a); }
    else { clearTimeout(timer); timer = setTimeout(() => { last = Date.now(); fn(...a); }, ms - (now - last)); }
  };
};
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ── formatting ───────────────────────────────────────── */
export function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec % 60), m = Math.floor(sec / 60) % 60, h = Math.floor(sec / 3600);
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? `${h}:` : '') + `${mm}:${String(s).padStart(2, '0')}`;
}
export function fmtCount(n) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return String(n);
}
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
export function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts, min = 60e3, hr = 36e5, day = 864e5;
  if (diff < min) return 'just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return fmtDate(new Date(ts).toISOString());
}
export function titleCase(s = '') {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Deterministic hue from a string — used for generated poster placeholders. */
export function hueOf(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
}
export function initialsOf(str = '') {
  return str.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
/** Inline SVG data-URI poster, so demo/offline mode never shows broken images. */
export function genPoster(seed, ratio = '2/3') {
  const h = hueOf(seed), [w, hh] = ratio === '16/9' ? [320, 180] : [300, 450];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${hh}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${h},62%,26%)"/><stop offset="1" stop-color="hsl(${(h + 48) % 360},58%,11%)"/>
</linearGradient></defs>
<rect width="${w}" height="${hh}" fill="url(#g)"/>
<circle cx="${w * 0.78}" cy="${hh * 0.2}" r="${w * 0.3}" fill="hsl(${(h + 20) % 360},70%,55%)" opacity=".14"/>
<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
 font-family="Inter,system-ui,sans-serif" font-size="${w * 0.22}" font-weight="800"
 fill="hsl(${h},40%,82%)" opacity=".5">${esc(initialsOf(seed))}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** <img> that degrades to a generated gradient instead of a broken icon. */
export function imgTag(src, alt, seed, { ratio = '2/3', cls = '', eager = false } = {}) {
  const fb = genPoster(seed || alt || 'kitsu', ratio);
  return `<img src="${attr(src || fb)}" alt="${attr(alt)}" class="${attr(cls)}"
    loading="${eager ? 'eager' : 'lazy'}" decoding="async"
    onerror="this.onerror=null;this.src='${fb}'">`;
}

export function scrollTop(smooth = true) {
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
}

export function setMeta(title, desc) {
  document.title = title ? `${title} — Kitsu Live` : 'Kitsu Live — Watch Anime';
  if (desc) {
    const m = document.querySelector('meta[name="description"]');
    if (m) m.content = desc.slice(0, 300);
  }
}

/** Wrap a promise so a rejection becomes [err, null] instead of a throw. */
export async function tryCatch(p) {
  try { return [null, await p]; } catch (e) { return [e, null]; }
}
