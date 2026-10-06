/* Kitsu Live — catalog client.
 *
 * Talks to Jikan v4 (the free MyAnimeList API). Jikan rate-limits hard, so
 * every request goes through one serialized queue with spacing, retry on 429,
 * and a TTL cache in localStorage. If the API can't be reached at all we fall
 * back to a small bundled demo catalog so the UI still works offline.
 */
import { CONFIG } from './config.js';
import { cacheGet, cacheSet } from './store.js';
import { loading } from './toast.js';

const { base, minGapMs, retries, retryBaseMs, timeoutMs } = CONFIG.api;

export const state = { offline: false, demo: false, lastError: null };
const subs = new Set();
export function onApiState(fn) { subs.add(fn); return () => subs.delete(fn); }
function flagDemo(on, err) {
  const changed = state.demo !== on;
  state.demo = on; state.offline = on; state.lastError = err || null;
  if (changed) subs.forEach((f) => { try { f(state); } catch {} });
}

/* ── request queue ────────────────────────────────────── */
let chain = Promise.resolve();
let lastAt = 0;
const inflight = new Map();

/* Circuit breaker: if the host is simply unreachable (blocked network, no
   DNS, captive portal), stop paying the retry cost on every single call and
   let callers drop straight to the demo catalog. One probe reopens it. */
const breaker = { fails: 0, openUntil: 0, threshold: 2, coolDownMs: 60000 };
const breakerOpen = () => Date.now() < breaker.openUntil;
function breakerTrip() {
  breaker.fails += 1;
  if (breaker.fails >= breaker.threshold) breaker.openUntil = Date.now() + breaker.coolDownMs;
}
function breakerReset() { breaker.fails = 0; breaker.openUntil = 0; }

function enqueue(task) {
  const run = chain.then(async () => {
    const gap = minGapMs - (Date.now() - lastAt);
    if (gap > 0) await new Promise((r) => setTimeout(r, gap));
    lastAt = Date.now();
    return task();
  });
  chain = run.catch(() => {});
  return run;
}

async function fetchJson(path) {
  const url = base + path;
  let lastErr;
  let netFails = 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      clearTimeout(to);
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`Rate limited (${res.status})`);
        await new Promise((r) => setTimeout(r, retryBaseMs * (attempt + 1) ** 2));
        continue;
      }
      if (res.status === 404) { const e = new Error('Not found'); e.code = 404; throw e; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      flagDemo(false);
      breakerReset();
      return json;
    } catch (err) {
      clearTimeout(to);
      if (err.code === 404) throw err;
      lastErr = err;
      /* A network/abort error means we never reached the host. Retrying that
         20 times just stalls the UI — one more go, then give up. */
      netFails += 1;
      if (netFails > 1) break;
      if (attempt < retries) await new Promise((r) => setTimeout(r, retryBaseMs));
    }
  }
  breakerTrip();
  throw lastErr || new Error('Request failed');
}

/** Cached + de-duplicated + queued GET. */
async function get(path, { ttl = true, quiet = false } = {}) {
  const key = 'j:' + path;
  if (ttl) { const hit = cacheGet(key); if (hit) return hit; }
  if (inflight.has(key)) return inflight.get(key);
  if (breakerOpen()) {
    flagDemo(true, new Error('Catalog API unreachable'));
    throw new Error('Catalog API unreachable');
  }

  if (!quiet) loading(true);
  const p = enqueue(() => fetchJson(path))
    .then((json) => { if (ttl) cacheSet(key, json); return json; })
    .finally(() => { inflight.delete(key); if (!quiet) loading(false); });

  inflight.set(key, p);
  return p;
}

/* ── normalizers ──────────────────────────────────────── */
export function normAnime(a = {}) {
  const img = a.images?.webp?.large_image_url || a.images?.jpg?.large_image_url
           || a.images?.webp?.image_url || a.images?.jpg?.image_url || '';
  return {
    id: a.mal_id,
    title: a.title || a.title_english || a.title_japanese || 'Untitled',
    titleEn: a.title_english || '',
    titleJp: a.title_japanese || '',
    poster: img,
    banner: a.trailer?.images?.maximum_image_url || a.trailer?.images?.large_image_url || img,
    trailer: a.trailer?.youtube_id || null,
    score: a.score ?? null,
    scoredBy: a.scored_by ?? null,
    rank: a.rank ?? null,
    popularity: a.popularity ?? null,
    members: a.members ?? null,
    favorites: a.favorites ?? null,
    type: a.type || '—',
    source: a.source || '—',
    episodes: a.episodes ?? null,
    status: a.status || '—',
    airing: !!a.airing,
    aired: a.aired?.string || '',
    airedFrom: a.aired?.from || null,
    season: a.season || '',
    year: a.year || (a.aired?.from ? new Date(a.aired.from).getFullYear() : null),
    duration: a.duration || '',
    rating: a.rating || '',
    synopsis: (a.synopsis || '').replace(/\s*\[Written by MAL Rewrite\]\s*$/i, '').trim(),
    background: a.background || '',
    genres: [...(a.genres || []), ...(a.themes || []), ...(a.demographics || [])]
      .map((g) => ({ id: g.mal_id, name: g.name })),
    studios: (a.studios || []).map((s) => s.name),
    producers: (a.producers || []).map((s) => s.name),
    licensors: (a.licensors || []).map((s) => s.name),
    broadcast: a.broadcast?.string || '',
    relations: (a.relations || []).map((r) => ({
      relation: r.relation,
      entries: (r.entry || []).filter((e) => e.type === 'anime').map((e) => ({ id: e.mal_id, title: e.name })),
    })).filter((r) => r.entries.length),
    external: (a.external || []).map((e) => ({ name: e.name, url: e.url })),
    demo: false,
  };
}
const normList = (d) => (Array.isArray(d) ? d : []).map(normAnime).filter((a) => a.id);
const pageInfo = (p = {}) => ({
  page: p.current_page || 1,
  last: p.last_visible_page || 1,
  hasNext: !!p.has_next_page,
  total: p.items?.total ?? null,
});

/* ── fallback demo catalog ────────────────────────────── */
let demoCache = null;
async function demoCatalog() {
  if (demoCache) return demoCache;
  try {
    const res = await fetch('data/fallback.json');
    const json = await res.json();
    demoCache = json.anime.map((a, i) => ({
      ...a,
      demo: true,
      poster: '', banner: '',
      genres: (a.genres || []).map((g, gi) => ({ id: 900 + gi, name: g })),
      relations: [], external: [], studios: a.studios || [], producers: [], licensors: [],
      rank: i + 1, popularity: i + 1,
    }));
  } catch { demoCache = []; }
  return demoCache;
}
async function demoSlice(n = 20, sort) {
  const all = [...(await demoCatalog())];
  if (sort === 'score') all.sort((a, b) => (b.score || 0) - (a.score || 0));
  if (sort === 'members') all.sort((a, b) => (b.members || 0) - (a.members || 0));
  return all.slice(0, n);
}

/** Run a live call; on hard failure fall back to the demo catalog. */
async function live(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    if (err?.code === 404) throw err;
    flagDemo(true, err);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

/* ── public endpoints ─────────────────────────────────── */
export const api = {
  state,

  async trending(limit = 24) {
    return live(
      async () => normList((await get(`/top/anime?filter=airing&limit=${limit}`)).data),
      () => demoSlice(limit, 'members'),
    );
  },

  async topRated(limit = 24) {
    return live(
      async () => normList((await get(`/top/anime?filter=bypopularity&limit=${limit}`)).data),
      () => demoSlice(limit, 'score'),
    );
  },

  async allTime(limit = 10) {
    return live(
      async () => normList((await get(`/top/anime?limit=${limit}`)).data),
      () => demoSlice(limit, 'score'),
    );
  },

  async seasonNow(limit = 24) {
    return live(
      async () => normList((await get(`/seasons/now?limit=${limit}&sfw=true`)).data),
      () => demoSlice(limit),
    );
  },

  async seasonUpcoming(limit = 24) {
    return live(
      async () => normList((await get(`/seasons/upcoming?limit=${limit}&sfw=true`)).data),
      () => demoSlice(limit),
    );
  },

  async topMovies(limit = 24) {
    return live(
      async () => normList((await get(`/top/anime?type=movie&limit=${limit}`)).data),
      () => demoSlice(limit, 'score'),
    );
  },

  /** Recently released episodes (Jikan's /watch/episodes). */
  async recentEpisodes(limit = 18) {
    return live(
      async () => {
        const d = (await get('/watch/episodes')).data || [];
        return d.slice(0, limit).map((row) => ({
          anime: normAnime(row.entry || {}),
          episodes: (row.episodes || []).map((e) => ({
            num: e.mal_id, title: e.title, premium: !!e.premium, url: e.url,
          })),
          region: row.region_locked,
        })).filter((r) => r.anime.id);
      },
      async () => (await demoSlice(limit)).map((a) => ({
        anime: a,
        episodes: [{ num: a.episodes || 1, title: `Episode ${a.episodes || 1}` }],
      })),
    );
  },

  async search(params = {}) {
    const q = new URLSearchParams({ sfw: 'true', limit: String(params.limit || 24) });
    if (params.q)       q.set('q', params.q);
    if (params.page)    q.set('page', String(params.page));
    if (params.type)    q.set('type', params.type);
    if (params.status)  q.set('status', params.status);
    if (params.rating)  q.set('rating', params.rating);
    if (params.genres)  q.set('genres', params.genres);
    if (params.minScore) q.set('min_score', params.minScore);
    if (params.startYear) q.set('start_date', `${params.startYear}-01-01`);
    if (params.endYear)   q.set('end_date', `${params.endYear}-12-31`);
    if (params.orderBy) { q.set('order_by', params.orderBy); q.set('sort', params.sort || 'desc'); }

    return live(
      async () => {
        const res = await get(`/anime?${q}`);
        return { items: normList(res.data), ...pageInfo(res.pagination) };
      },
      async () => {
        const all = await demoCatalog();
        const needle = (params.q || '').toLowerCase();
        let items = needle
          ? all.filter((a) => (a.title + ' ' + (a.synopsis || '')).toLowerCase().includes(needle))
          : [...all];
        if (params.type) items = items.filter((a) => a.type.toLowerCase() === params.type.toLowerCase());
        return { items: items.slice(0, params.limit || 24), page: 1, last: 1, hasNext: false, total: items.length };
      },
    );
  },

  /** Lightweight typeahead — no cache write, no load bar. */
  async suggest(q, limit = 7) {
    if (!q || q.trim().length < 2) return [];
    return live(
      async () => normList((await get(
        `/anime?q=${encodeURIComponent(q.trim())}&limit=${limit}&sfw=true&order_by=members&sort=desc`,
        { quiet: true },
      )).data),
      async () => {
        const all = await demoCatalog();
        return all.filter((a) => a.title.toLowerCase().includes(q.toLowerCase())).slice(0, limit);
      },
    );
  },

  async anime(id) {
    return live(
      async () => normAnime((await get(`/anime/${id}/full`)).data),
      async () => (await demoCatalog()).find((a) => String(a.id) === String(id)) || null,
    );
  },

  async episodes(id, page = 1) {
    return live(
      async () => {
        const res = await get(`/anime/${id}/episodes?page=${page}`);
        return {
          items: (res.data || []).map((e) => ({
            num: e.mal_id,
            title: e.title || `Episode ${e.mal_id}`,
            titleJp: e.title_japanese || '',
            aired: e.aired || null,
            filler: !!e.filler,
            recap: !!e.recap,
            score: e.score ?? null,
          })),
          ...pageInfo(res.pagination),
        };
      },
      async () => {
        const a = (await demoCatalog()).find((x) => String(x.id) === String(id));
        const n = a?.episodes || 12;
        return {
          items: Array.from({ length: n }, (_, i) => ({
            num: i + 1, title: `Episode ${i + 1}`, filler: false, recap: false, aired: null, score: null,
          })),
          page: 1, last: 1, hasNext: false, total: n,
        };
      },
    );
  },

  async characters(id, limit = 12) {
    return live(
      async () => ((await get(`/anime/${id}/characters`)).data || [])
        .sort((a, b) => (b.favorites || 0) - (a.favorites || 0))
        .slice(0, limit)
        .map((c) => ({
          id: c.character?.mal_id,
          name: c.character?.name || '—',
          img: c.character?.images?.webp?.image_url || c.character?.images?.jpg?.image_url || '',
          role: c.role || '',
          va: c.voice_actors?.find((v) => v.language === 'Japanese')?.person?.name || '',
        })),
      [],
    );
  },

  async recommendations(id, limit = 12) {
    return live(
      async () => ((await get(`/anime/${id}/recommendations`)).data || [])
        .slice(0, limit)
        .map((r) => ({ ...normAnime(r.entry || {}), votes: r.votes })),
      () => demoSlice(limit),
    );
  },

  async schedule(day, limit = 25) {
    return live(
      async () => normList((await get(`/schedules?filter=${day}&limit=${limit}&sfw=true`)).data),
      () => demoSlice(8),
    );
  },

  async genres() {
    return live(
      async () => ((await get('/genres/anime')).data || [])
        .filter((g) => g.count > 40)
        .map((g) => ({ id: g.mal_id, name: g.name, count: g.count }))
        .sort((a, b) => b.count - a.count),
      () => FALLBACK_GENRES,
    );
  },

  async random() {
    return live(
      async () => normAnime((await get('/random/anime', { ttl: false })).data),
      async () => { const all = await demoCatalog(); return all[Math.floor(Math.random() * all.length)] || null; },
    );
  },
};

const FALLBACK_GENRES = [
  { id: 1, name: 'Action' }, { id: 2, name: 'Adventure' }, { id: 4, name: 'Comedy' },
  { id: 8, name: 'Drama' }, { id: 10, name: 'Fantasy' }, { id: 7, name: 'Mystery' },
  { id: 22, name: 'Romance' }, { id: 24, name: 'Sci-Fi' }, { id: 36, name: 'Slice of Life' },
  { id: 30, name: 'Sports' }, { id: 37, name: 'Supernatural' }, { id: 41, name: 'Suspense' },
  { id: 14, name: 'Horror' }, { id: 18, name: 'Mecha' }, { id: 19, name: 'Music' },
  { id: 40, name: 'Psychological' }, { id: 62, name: 'Isekai' }, { id: 17, name: 'Martial Arts' },
];

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
