/* KITSU/LIVE — bootstrap.
 * The active layout owns the chrome and the home page; this file wires the
 * shared behaviour (routing, search, theme, keyboard) to whatever markup the
 * layout produced, via data-attributes rather than fixed IDs. */
import { CONFIG } from './config.js';
import { $, $$, debounce, esc, attr, imgTag, genPoster } from './util.js';
import { getSettings, setSetting, pushHistory, getHistory, onStoreChange } from './store.js';
import { api, onApiState } from './api.js';
import { route, startRouter, go, parseHash, buildQuery, resolve } from './router.js';
import { ICON, svg, displayTitle } from './components.js';
import { LAYOUTS, LAYOUT_IDS, getLayout, setActive, current } from './layouts/index.js';
import { toast } from './toast.js';

/* ── routes ───────────────────────────────────────────── */
route('/',          (c) => import('./pages/home.js').then((m) => m.default(c)));
route('/browse',    (c) => import('./pages/browse.js').then((m) => m.default(c)));
route('/anime/:id', (c) => import('./pages/info.js').then((m) => m.default(c)));
route('/watch/:id', (c) => import('./pages/watch.js').then((m) => m.default(c)));
route('/library',   (c) => import('./pages/library.js').then((m) => m.default(c)));
route('/schedule',  (c) => import('./pages/schedule.js').then((m) => m.default(c)));
route('/settings',  (c) => import('./pages/settings.js').then((m) => m.default(c)));

/* ── theme ────────────────────────────────────────────── */
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
const THEME_ALIAS = { dark: 'ink', light: 'paper' };
function applyTheme() {
  const raw = getSettings().theme;
  const t = THEME_ALIAS[raw] || raw;
  const resolved = t === 'system' ? (prefersDark.matches ? 'ink' : 'paper') : t;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'ink' ? '#0b0b0c' : '#efece3';
}
prefersDark.addEventListener('change', () => { if (getSettings().theme === 'system') applyTheme(); });

/* ── layout ───────────────────────────────────────────── */
function mountLayout(id, { rerender = false } = {}) {
  const l = setActive(LAYOUT_IDS.includes(id) ? id : LAYOUT_IDS[0]);
  document.documentElement.dataset.layout = l.id;
  $('#shell').innerHTML = l.shell();
  $('#shellFoot').innerHTML = l.foot ? l.foot() : '';
  l.afterMount?.($('#shell'));
  syncNav();
  syncSearchBox();
  if (rerender) resolve();
  return l;
}
function switchLayout(id) {
  setSetting('layout', id);
  const l = getLayout(id);
  if (l.theme) setSetting('theme', l.theme);
  applyTheme();
  mountLayout(id, { rerender: true });
  renderDesigns();
  toast(`Design: ${l.name}`, 'ok', 1700);
}
function cycleLayout() {
  const cur = document.documentElement.dataset.layout;
  switchLayout(LAYOUT_IDS[(LAYOUT_IDS.indexOf(cur) + 1) % LAYOUT_IDS.length]);
}

/* ── design picker ────────────────────────────────────── */
const layoutModal = $('#layoutModal');
function renderDesigns() {
  const cur = document.documentElement.dataset.layout;
  $('#designGrid').innerHTML = LAYOUTS.map((l) => `
    <button class="design-card ${l.id === cur ? 'is-on' : ''}" data-pick-layout="${attr(l.id)}">
      <span class="design-card__shot">${l.thumb || ''}</span>
      <span class="design-card__text">
        <b>${esc(l.name)}</b>
        <em>${esc(l.tagline || '')}</em>
        <small>${esc(l.blurb || '')}</small>
        ${l.id === cur ? '<span class="design-card__tag">Current</span>' : ''}
      </span>
    </button>`).join('');
}
function setLayoutModal(open) {
  if (open) renderDesigns();
  layoutModal.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
}
layoutModal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-layout]')) return setLayoutModal(false);
  const pick = e.target.closest('[data-pick-layout]');
  if (pick) { switchLayout(pick.dataset.pickLayout); setLayoutModal(false); }
});

const keysModal = $('#keysModal');
function setKeys(open) {
  keysModal.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
}
keysModal.addEventListener('click', (e) => { if (e.target.closest('[data-close-modal]')) setKeys(false); });

/* ── delegated chrome actions ─────────────────────────── */
document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  if (act === 'theme')  { setSetting('theme', document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink'); applyTheme(); }
  if (act === 'layout') setLayoutModal(layoutModal.hidden);
  if (act === 'keys')   setKeys(keysModal.hidden);
  if (act === 'random') surprise();
  if (act === 'menu')   document.documentElement.classList.toggle('nav-open');
  if (act === 'closemenu') document.documentElement.classList.remove('nav-open');
});

async function surprise() {
  toast('Rolling…', 'info', 1200);
  const a = await api.random();
  if (a?.id) go(`/anime/${a.id}`);
  else toast('Could not pick one — try again.', 'bad');
}

/* ── nav state ────────────────────────────────────────── */
function syncNav() {
  const { path } = parseHash();
  const key = path === '/' ? 'home'
    : path.startsWith('/browse') ? 'browse'
    : path.startsWith('/schedule') ? 'schedule'
    : path.startsWith('/library') ? 'library'
    : path.startsWith('/settings') ? 'settings' : '';
  $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === key));
}
document.addEventListener('route:after', () => {
  syncNav(); syncSearchBox();
  document.documentElement.classList.remove('nav-open');
});

function syncSearchBox() {
  const { path, query } = parseHash();
  const input = $('[data-search]');
  if (input) input.value = path.startsWith('/browse') && query.q ? query.q : '';
}

/* ── search + typeahead (delegated: survives layout swaps) ── */
let suggestions = [], selIdx = -1;
const suggestBox = () => $('[data-suggest]');

function closeSuggest() {
  const box = suggestBox();
  if (!box) return;
  box.hidden = true; box.innerHTML = '';
  selIdx = -1; suggestions = [];
}
function openSuggest(html) {
  const box = suggestBox();
  if (!box) return;
  box.innerHTML = html; box.hidden = false;
}
function historyPanel() {
  const hist = getHistory();
  if (!hist.length) return closeSuggest();
  openSuggest(`<div class="suggest__head"><span>Recent</span></div>` +
    hist.map((h) => `<button class="suggest__row" data-q="${attr(h)}">
      <span class="suggest__meta"><b>${esc(h)}</b></span></button>`).join(''));
}
const runSuggest = debounce(async (q) => {
  if (q.trim().length < 2) return historyPanel();
  openSuggest(`<div class="suggest__head"><span>Searching…</span></div>`);
  const res = await api.suggest(q, 7);
  const input = $('[data-search]');
  if (!input || input.value.trim() !== q.trim()) return;
  suggestions = res;
  if (!res.length) return openSuggest(`<p class="suggest__empty">Nothing for “${esc(q)}”.</p>`);
  openSuggest(`<div class="suggest__head"><span>Top matches</span><span>↵ open</span></div>` +
    res.map((a) => {
      const t = displayTitle(a);
      return `<button class="suggest__row" data-id="${a.id}">
        ${imgTag(a.poster || genPoster(t), '', t)}
        <span class="suggest__meta"><b>${esc(t)}</b>
          <small>${a.score ? `★ ${a.score.toFixed(2)} · ` : ''}${esc(a.type)}${a.year ? ` · ${a.year}` : ''}</small>
        </span></button>`;
    }).join('') +
    `<button class="suggest__row" data-all="1"><span class="suggest__meta">
      <b>All results for “${esc(q)}”</b></span></button>`);
}, 320);

document.addEventListener('input', (e) => {
  if (e.target.matches('[data-search]')) runSuggest(e.target.value);
});
document.addEventListener('focusin', (e) => {
  if (!e.target.matches('[data-search]')) return;
  e.target.value.trim() ? runSuggest(e.target.value) : historyPanel();
});
document.addEventListener('keydown', (e) => {
  if (!e.target.matches?.('[data-search]')) return;
  const rows = $$('.suggest__row', suggestBox() || document);
  if (e.key === 'Escape') { closeSuggest(); e.target.blur(); return; }
  if (e.key === 'Enter' && selIdx >= 0 && rows[selIdx]) { e.preventDefault(); rows[selIdx].click(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = e.target.value.trim();
    if (!q) return;
    pushHistory(q); closeSuggest(); e.target.blur();
    go('/browse' + buildQuery({ q }));
    return;
  }
  if (!rows.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    selIdx = (selIdx + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
    rows.forEach((r, i) => r.classList.toggle('is-sel', i === selIdx));
    rows[selIdx].scrollIntoView({ block: 'nearest' });
  }
});
document.addEventListener('click', (e) => {
  const row = e.target.closest('.suggest__row');
  if (row) {
    const input = $('[data-search]');
    if (row.dataset.id) { pushHistory(input?.value || ''); closeSuggest(); input?.blur(); go(`/anime/${row.dataset.id}`); }
    else if (row.dataset.q) { if (input) input.value = row.dataset.q; pushHistory(row.dataset.q); closeSuggest(); go('/browse' + buildQuery({ q: row.dataset.q })); }
    else if (row.dataset.all && input) { pushHistory(input.value); closeSuggest(); go('/browse' + buildQuery({ q: input.value.trim() })); }
    return;
  }
  if (!e.target.closest('[data-searchbox]')) closeSuggest();
});

/* ── api state chip ───────────────────────────────────── */
onApiState((s) => {
  $$('[data-apistate]').forEach((el) => { el.textContent = s.demo ? 'DEMO CATALOG' : 'LIVE'; el.classList.toggle('is-demo', s.demo); });
});

/* ── global keys ──────────────────────────────────────── */
let gPending = false, gTimer = null;
window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const onWatch = parseHash().path.startsWith('/watch');

  if (e.key === 'Escape') {
    closeSuggest(); setKeys(false); setLayoutModal(false);
    document.documentElement.classList.remove('nav-open');
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === '/') { e.preventDefault(); $('[data-search]')?.focus(); return; }
  if (e.key === '?') { e.preventDefault(); setKeys(keysModal.hidden); return; }

  if (gPending) {
    gPending = false; clearTimeout(gTimer);
    const dest = { h: '/', b: '/browse', l: '/library', s: '/schedule', c: '/settings' }[e.key.toLowerCase()];
    if (dest) { e.preventDefault(); go(dest); }
    return;
  }
  if (e.key.toLowerCase() === 'g') { gPending = true; gTimer = setTimeout(() => { gPending = false; }, 900); return; }

  if (onWatch) return;          // the player owns these
  const k = e.key.toLowerCase();
  if (k === 'r') { e.preventDefault(); surprise(); }
  if (k === 't') { e.preventDefault(); setSetting('theme', document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink'); applyTheme(); }
  if (k === 'd') { e.preventDefault(); setLayoutModal(layoutModal.hidden); }
  if (k === 'x') { e.preventDefault(); cycleLayout(); }
});

onStoreChange((w) => { if (w === 'settings' || w === 'all') applyTheme(); });

/* ── go ───────────────────────────────────────────────── */
applyTheme();
mountLayout(getSettings().layout);
startRouter();

console.info('%c KITSU/LIVE %c press D to change design · ? for keys',
  'background:#ff3b18;color:#efece3;padding:3px 8px;font-weight:700;letter-spacing:.14em',
  'color:#6b6961;padding-left:8px');
