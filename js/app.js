/* Kitsu Live — bootstrap: theme, nav, search, global keys, routes. */
import { CONFIG } from './config.js';
import { $, $$, debounce, esc, attr, imgTag, genPoster, on } from './util.js';
import { getSettings, setSetting, pushHistory, getHistory, onStoreChange } from './store.js';
import { api, onApiState } from './api.js';
import { route, startRouter, go, parseHash, buildQuery } from './router.js';
import { ICON, svg, displayTitle } from './components.js';
import { toast } from './toast.js';

/* ── routes ───────────────────────────────────────────── */
route('/',            (c) => import('./pages/home.js').then((m) => m.default(c)));
route('/browse',      (c) => import('./pages/browse.js').then((m) => m.default(c)));
route('/anime/:id',   (c) => import('./pages/info.js').then((m) => m.default(c)));
route('/watch/:id',   (c) => import('./pages/watch.js').then((m) => m.default(c)));
route('/library',     (c) => import('./pages/library.js').then((m) => m.default(c)));
route('/schedule',    (c) => import('./pages/schedule.js').then((m) => m.default(c)));
route('/settings',    (c) => import('./pages/settings.js').then((m) => m.default(c)));

/* ── theme ────────────────────────────────────────────── */
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
/* older saves used dark/light — fold them onto the current names */
const THEME_ALIAS = { dark: 'ink', light: 'paper' };
function applyTheme() {
  const raw = getSettings().theme;
  const t = THEME_ALIAS[raw] || raw;
  const resolved = t === 'system' ? (prefersDark.matches ? 'ink' : 'paper') : t;
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = resolved === 'ink' ? '#0b0b0c' : '#efece3';
  document.documentElement.classList.toggle('reduce-motion', !!getSettings().reduceMotion);
}
applyTheme();
prefersDark.addEventListener('change', () => { if (getSettings().theme === 'system') applyTheme(); });
document.addEventListener('theme:apply', applyTheme);

$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'ink' ? 'paper' : 'ink';
  setSetting('theme', next);
  applyTheme();
});

/* ── sticky topbar ────────────────────────────────────── */
const topbar = $('#topbar');
const onScroll = () => topbar.classList.toggle('is-stuck', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ── drawer ───────────────────────────────────────────── */
const drawer = $('#drawer');
const navToggle = $('#navToggle');
function setDrawer(open) {
  drawer.hidden = !open;
  navToggle.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}
navToggle.addEventListener('click', () => setDrawer(drawer.hidden));
drawer.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-drawer]') || e.target.closest('a')) setDrawer(false);
});

/* ── nav active state ─────────────────────────────────── */
function syncNav() {
  const { path } = parseHash();
  const key = path === '/' ? 'home'
    : path.startsWith('/browse') ? 'browse'
    : path.startsWith('/schedule') ? 'schedule'
    : path.startsWith('/library') ? 'library'
    : path.startsWith('/settings') ? 'settings' : '';
  $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.dataset.nav === key));
}
document.addEventListener('route:after', syncNav);

/* ── demo-mode chip in the drawer ─────────────────────── */
onApiState((s) => {
  const chip = $('#drawerMode');
  if (chip) chip.textContent = s.demo ? 'Demo catalog (API offline)' : 'Live catalog';
});

/* ── search + typeahead ───────────────────────────────── */
const form = $('#searchForm');
const input = $('#searchInput');
const list = $('#suggestList');
let suggestions = [];
let selIdx = -1;

function closeSuggest() {
  list.hidden = true; list.innerHTML = '';
  input.setAttribute('aria-expanded', 'false');
  selIdx = -1; suggestions = [];
}
function openSuggest(html) {
  list.innerHTML = html; list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

function historyPanel() {
  const hist = getHistory();
  if (!hist.length) return;
  openSuggest(`
    <div class="suggest__head"><span>Recent searches</span></div>
    ${hist.map((h) => `<button class="suggest__row" data-q="${attr(h)}">
      <span class="suggest__ph" style="display:grid;place-items:center;background:var(--bg-3);color:var(--ink-3)">${svg(ICON.clock)}</span>
      <span class="suggest__meta"><b>${esc(h)}</b><small>search again</small></span></button>`).join('')}`);
}

const runSuggest = debounce(async (q) => {
  if (q.trim().length < 2) { historyPanel(); return; }
  openSuggest(`<div class="suggest__head"><span>Searching…</span></div>
    ${'<div class="suggest__row"><span class="sk" style="width:38px;height:52px"></span><span class="suggest__meta" style="flex:1"><span class="sk sk--line w80"></span><span class="sk sk--line w40"></span></span></div>'.repeat(3)}`);
  const res = await api.suggest(q, 7);
  if (input.value.trim() !== q.trim()) return;
  suggestions = res;
  if (!res.length) { openSuggest(`<p class="suggest__empty">Nothing found for “${esc(q)}”.</p>`); return; }
  openSuggest(`
    <div class="suggest__head"><span>Top matches</span><span>↵ to open</span></div>
    ${res.map((a, i) => {
      const t = displayTitle(a);
      return `<button class="suggest__row" data-id="${a.id}" data-i="${i}">
        ${imgTag(a.poster || genPoster(t), '', t)}
        <span class="suggest__meta"><b>${esc(t)}</b>
          <small>${a.score ? `★ ${a.score.toFixed(2)} · ` : ''}${esc(a.type)}${a.year ? ` · ${a.year}` : ''}${a.episodes ? ` · ${a.episodes} ep` : ''}</small>
        </span></button>`;
    }).join('')}
    <button class="suggest__row" data-all="1">
      <span class="suggest__ph" style="display:grid;place-items:center;background:var(--bg-3);color:var(--ember)">${svg(ICON.search)}</span>
      <span class="suggest__meta"><b>See all results for “${esc(q)}”</b><small>full search with filters</small></span>
    </button>`);
}, 320);

input.addEventListener('input', () => runSuggest(input.value));
input.addEventListener('focus', () => { if (!input.value.trim()) historyPanel(); else runSuggest(input.value); });

input.addEventListener('keydown', (e) => {
  const rows = $$('.suggest__row', list);
  if (e.key === 'Escape') { closeSuggest(); input.blur(); return; }
  if (!rows.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    selIdx = (selIdx + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
    rows.forEach((r, i) => r.classList.toggle('is-sel', i === selIdx));
    rows[selIdx].scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'Enter' && selIdx >= 0) { e.preventDefault(); rows[selIdx].click(); }
});

on(list, 'click', '.suggest__row', (e, row) => {
  if (row.dataset.id) {
    pushHistory(input.value);
    closeSuggest(); input.blur();
    go(`/anime/${row.dataset.id}`);
  } else if (row.dataset.q) {
    input.value = row.dataset.q;
    form.requestSubmit();
  } else if (row.dataset.all) {
    form.requestSubmit();
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  pushHistory(q);
  closeSuggest(); input.blur();
  go('/browse' + buildQuery({ q }));
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#searchForm')) closeSuggest();
});

/* keep the box in sync with the URL */
document.addEventListener('route:after', () => {
  const { path, query } = parseHash();
  input.value = path.startsWith('/browse') && query.q ? query.q : '';
});

/* ── random ───────────────────────────────────────────── */
async function surprise() {
  toast('Rolling the dice…', 'info', 1400);
  const a = await api.random();
  if (a?.id) go(`/anime/${a.id}`);
  else toast('Could not pick one — try again.', 'bad');
}
$('#randomBtn')?.addEventListener('click', surprise);

/* ── shortcuts modal ──────────────────────────────────── */
const keysModal = $('#keysModal');
function setModal(open) {
  keysModal.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
}
keysModal.addEventListener('click', (e) => { if (e.target.closest('[data-close-modal]')) setModal(false); });

/* ── global keys ──────────────────────────────────────── */
let gPending = false, gTimer = null;
window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const onWatch = parseHash().path.startsWith('/watch');

  if (e.key === 'Escape') { closeSuggest(); setModal(false); setDrawer(false); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

  if (e.key === '/') { e.preventDefault(); input.focus(); input.select(); return; }
  if (e.key === '?') { e.preventDefault(); setModal(keysModal.hidden); return; }

  if (gPending) {
    gPending = false; clearTimeout(gTimer);
    const dest = { h: '/', b: '/browse', l: '/library', s: '/schedule', c: '/settings' }[e.key.toLowerCase()];
    if (dest) { e.preventDefault(); go(dest); }
    return;
  }
  if (e.key.toLowerCase() === 'g') {
    gPending = true;
    gTimer = setTimeout(() => { gPending = false; }, 900);
    return;
  }

  /* these would fight the player's own bindings */
  if (onWatch) return;
  if (e.key.toLowerCase() === 'r') { e.preventDefault(); surprise(); }
  if (e.key.toLowerCase() === 't') { e.preventDefault(); $('#themeBtn').click(); }
});

/* ── re-render cards when the library changes elsewhere ── */
onStoreChange((what) => { if (what === 'settings') applyTheme(); });

/* ── go ───────────────────────────────────────────────── */
startRouter();
syncNav();

console.info(`%c KITSU/LIVE %c press ? for shortcuts`,
  'background:#ff3b18;color:#efece3;padding:3px 8px;font-weight:700;letter-spacing:.14em',
  'color:#6b6961;padding-left:8px');
