/* Kitsu Live — local persistence: settings, watchlist, watch progress.
 * Everything lives in localStorage; nothing leaves the browser.
 */
import { CONFIG, STORAGE_PREFIX } from './config.js';

const K = {
  settings: STORAGE_PREFIX + 'settings',
  list:     STORAGE_PREFIX + 'list',
  progress: STORAGE_PREFIX + 'progress',
  history:  STORAGE_PREFIX + 'history',
  cache:    STORAGE_PREFIX + 'cache',
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch { return false; }   // private mode / quota — degrade quietly
}

const listeners = new Set();
export function onStoreChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) { listeners.forEach((fn) => { try { fn(what); } catch {} }); }

/* ── settings ─────────────────────────────────────────── */
let settings = { ...CONFIG.defaults, ...read(K.settings, {}) };
export const getSettings = () => ({ ...settings });
export function setSetting(key, val) {
  settings = { ...settings, [key]: val };
  write(K.settings, settings);
  emit('settings');
  return settings;
}
export function resetSettings() {
  settings = { ...CONFIG.defaults };
  write(K.settings, settings);
  emit('settings');
}

/* ── watchlist ────────────────────────────────────────── */
export const LIST_STATUS = [
  { id: 'watching',  label: 'Watching' },
  { id: 'planned',   label: 'Plan to watch' },
  { id: 'completed', label: 'Completed' },
  { id: 'paused',    label: 'On hold' },
  { id: 'dropped',   label: 'Dropped' },
];

let list = read(K.list, {});
export const getList = () => ({ ...list });
export const getListArray = () =>
  Object.values(list).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
export const inList = (id) => Boolean(list[id]);
export const listStatus = (id) => list[id]?.status || null;

export function addToList(anime, status = 'planned') {
  if (!anime?.id) return;
  list = {
    ...list,
    [anime.id]: {
      id: anime.id,
      status,
      anime: slim(anime),
      addedAt: list[anime.id]?.addedAt || Date.now(),
      updatedAt: Date.now(),
    },
  };
  write(K.list, list); emit('list');
}
export function removeFromList(id) {
  if (!list[id]) return;
  const next = { ...list }; delete next[id];
  list = next; write(K.list, list); emit('list');
}
export function toggleList(anime) {
  if (inList(anime.id)) { removeFromList(anime.id); return false; }
  addToList(anime, 'planned'); return true;
}
function slim(a) {
  return {
    id: a.id, title: a.title, titleEn: a.titleEn, poster: a.poster,
    type: a.type, year: a.year, score: a.score, episodes: a.episodes,
    status: a.status, genres: (a.genres || []).slice(0, 3), demo: !!a.demo,
  };
}

/* ── watch progress ───────────────────────────────────── */
let progress = read(K.progress, {});
const pk = (id, ep) => `${id}:${ep}`;

export const getProgress = (id, ep) => progress[pk(id, ep)] || null;
export function saveProgress(id, ep, position, duration, anime) {
  if (!id || !ep || !Number.isFinite(position)) return;
  const done = duration > 0 && position / duration > 0.92;
  progress = {
    ...progress,
    [pk(id, ep)]: {
      id, ep, position, duration: duration || 0,
      done, updatedAt: Date.now(),
      anime: anime ? slim(anime) : progress[pk(id, ep)]?.anime,
    },
  };
  write(K.progress, progress); emit('progress');
}
export function markEpisode(id, ep, done = true, anime) {
  const cur = progress[pk(id, ep)] || {};
  progress = {
    ...progress,
    [pk(id, ep)]: {
      ...cur, id, ep, done,
      position: done ? (cur.duration || 0) : 0,
      duration: cur.duration || 0,
      updatedAt: Date.now(),
      anime: anime ? slim(anime) : cur.anime,
    },
  };
  write(K.progress, progress); emit('progress');
}
export function clearProgress(id) {
  const next = {};
  for (const [k, v] of Object.entries(progress)) if (v.id !== id) next[k] = v;
  progress = next; write(K.progress, progress); emit('progress');
}
export function seenEpisodes(id) {
  const set = new Set();
  for (const v of Object.values(progress)) if (v.id === id && v.done) set.add(v.ep);
  return set;
}
export function lastWatchedEp(id) {
  let best = null;
  for (const v of Object.values(progress)) {
    if (v.id !== id) continue;
    if (!best || (v.updatedAt || 0) > (best.updatedAt || 0)) best = v;
  }
  return best;
}

/** Newest-first list of shows with an unfinished or recently finished episode. */
export function continueWatching(limit = 20) {
  const byShow = new Map();
  for (const v of Object.values(progress)) {
    if (!v.anime) continue;
    const prev = byShow.get(v.id);
    if (!prev || (v.updatedAt || 0) > (prev.updatedAt || 0)) byShow.set(v.id, v);
  }
  return [...byShow.values()]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, limit)
    .map((v) => {
      const pct = v.duration > 0 ? Math.min(100, (v.position / v.duration) * 100) : 0;
      return { ...v, pct, nextEp: v.done ? v.ep + 1 : v.ep, resumeAt: v.done ? 0 : v.position };
    });
}

/* ── search history ───────────────────────────────────── */
let history = read(K.history, []);
export const getHistory = () => [...history];
export function pushHistory(q) {
  q = String(q || '').trim();
  if (q.length < 2) return;
  history = [q, ...history.filter((h) => h.toLowerCase() !== q.toLowerCase())].slice(0, 8);
  write(K.history, history); emit('history');
}
export function clearHistory() { history = []; write(K.history, history); emit('history'); }

/* ── api response cache (ttl'd) ───────────────────────── */
export function cacheGet(key) {
  const all = read(K.cache, {});
  const hit = all[key];
  if (!hit) return null;
  if (Date.now() - hit.t > CONFIG.api.cacheTtlMs) return null;
  return hit.v;
}
export function cacheSet(key, val) {
  const all = read(K.cache, {});
  all[key] = { t: Date.now(), v: val };
  const keys = Object.keys(all);
  if (keys.length > CONFIG.api.cacheMax) {
    keys.sort((a, b) => all[a].t - all[b].t)
        .slice(0, keys.length - CONFIG.api.cacheMax)
        .forEach((k) => delete all[k]);
  }
  if (!write(K.cache, all)) { try { localStorage.removeItem(K.cache); } catch {} }
}
export function cacheClear() { try { localStorage.removeItem(K.cache); } catch {} }

export function exportAll() {
  return JSON.stringify({ v: 1, exportedAt: new Date().toISOString(), settings, list, progress, history }, null, 2);
}
export function importAll(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  if (!d || typeof d !== 'object') throw new Error('Not a Kitsu Live backup');
  if (d.settings) { settings = { ...CONFIG.defaults, ...d.settings }; write(K.settings, settings); }
  if (d.list)     { list = d.list;         write(K.list, list); }
  if (d.progress) { progress = d.progress; write(K.progress, progress); }
  if (d.history)  { history = d.history;   write(K.history, history); }
  emit('all');
}
export function wipeAll() {
  Object.values(K).forEach((k) => { try { localStorage.removeItem(k); } catch {} });
  settings = { ...CONFIG.defaults }; list = {}; progress = {}; history = [];
  emit('all');
}
