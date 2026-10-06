/* Kitsu Live — browse / search results with filters. */
import { api, onApiState } from '../api.js';
import { pushHistory } from '../store.js';
import { cardHTML, skeletonGrid, emptyState, demoNotice, ICON, svg } from '../components.js';
import { $, $$, esc, attr, setMeta, scrollTop, debounce } from '../util.js';
import { go, buildQuery } from '../router.js';

const TYPES   = ['', 'tv', 'movie', 'ova', 'ona', 'special'];
const STATUS  = [['', 'Any status'], ['airing', 'Airing'], ['complete', 'Finished'], ['upcoming', 'Upcoming']];
const SORTS   = [
  ['', 'Relevance'], ['score', 'Score'], ['members', 'Popularity'],
  ['start_date', 'Newest'], ['title', 'A–Z'], ['rank', 'Rank'], ['favorites', 'Favorites'],
];
const YEARS = (() => { const y = new Date().getFullYear() + 1; return Array.from({ length: 50 }, (_, i) => y - i); })();

export default async function browse({ mount, query }) {
  const q = { ...query };
  const page = Math.max(1, Number(q.page) || 1);
  const heading = q.q ? `Results for “${q.q}”`
    : q.genreName ? `${q.genreName} anime`
    : q.season === 'now' ? 'Airing this season'
    : q.status === 'upcoming' ? 'Coming soon'
    : q.type ? `${q.type.toUpperCase()} titles`
    : q.sort === 'trending' ? 'Trending now'
    : 'Browse the catalog';
  setMeta(heading);
  if (q.q) pushHistory(q.q);

  const genres = await api.genres();
  const selGenres = new Set(String(q.genre || '').split(',').filter(Boolean));

  mount.innerHTML = `
    <div class="page-head">
      <h1>${esc(heading)}</h1>
      <p id="browseSub">Loading…</p>
    </div>
    <div class="page-body">
      <div id="browseNotice"></div>
      <form class="filters" id="filters">
        <div class="field" style="grid-column:span 2">
          <label for="fq">Title</label>
          <input class="input" id="fq" name="q" type="search" placeholder="Search by name…" value="${attr(q.q || '')}">
        </div>
        <div class="field"><label for="ftype">Format</label>
          <select class="select" id="ftype" name="type">
            ${TYPES.map((t) => `<option value="${t}" ${q.type === t ? 'selected' : ''}>${t ? t.toUpperCase() : 'Any format'}</option>`).join('')}
          </select></div>
        <div class="field"><label for="fstatus">Status</label>
          <select class="select" id="fstatus" name="status">
            ${STATUS.map(([v, l]) => `<option value="${v}" ${q.status === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <div class="field"><label for="forder">Sort by</label>
          <select class="select" id="forder" name="orderBy">
            ${SORTS.map(([v, l]) => `<option value="${v}" ${q.orderBy === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select></div>
        <div class="field"><label for="fyear">From year</label>
          <select class="select" id="fyear" name="startYear">
            <option value="">Any year</option>
            ${YEARS.map((y) => `<option value="${y}" ${String(q.startYear) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
          </select></div>
        <div class="field"><label for="fscore">Min score</label>
          <select class="select" id="fscore" name="minScore">
            <option value="">Any score</option>
            ${[9, 8.5, 8, 7.5, 7, 6].map((s) => `<option value="${s}" ${String(q.minScore) === String(s) ? 'selected' : ''}>${s}+</option>`).join('')}
          </select></div>
        <div class="filters__row" style="flex-direction:column;align-items:stretch;gap:.5rem">
          <label style="font-size:.72rem;font-weight:680;text-transform:uppercase;letter-spacing:.08em;color:var(--fg-3)">Genres</label>
          <div class="genre-cloud" id="genreCloud">
            ${genres.map((g) => `<button type="button" class="genre-chip ${selGenres.has(String(g.id)) ? 'is-on' : ''}"
              data-genre="${g.id}" data-name="${attr(g.name)}">${esc(g.name)}</button>`).join('')}
          </div>
          <button type="button" class="btn btn--quiet btn--sm" id="moreGenres" style="align-self:flex-start;margin:0">Show all genres</button>
        </div>
        <div class="filters__row">
          <button type="button" class="btn btn--quiet btn--sm" id="clearFilters">Clear all</button>
          <button type="submit" class="btn btn--primary btn--sm">${svg(ICON.search)} Apply</button>
        </div>
      </form>

      <div class="results-bar">
        <span class="count" id="resultCount"></span>
      </div>
      <div id="results">${skeletonGrid(18)}</div>
      <div id="pager"></div>
    </div>`;

  const noticeHost = $('#browseNotice', mount);
  const offNotice = onApiState((s) => { noticeHost.innerHTML = s.demo ? demoNotice() : ''; });

  /* ── filter interactions ───────────────────────────── */
  const form = $('#filters', mount);
  const cloud = $('#genreCloud', mount);
  $('#moreGenres', mount).addEventListener('click', (e) => {
    cloud.classList.toggle('is-open');
    e.target.textContent = cloud.classList.contains('is-open') ? 'Show fewer genres' : 'Show all genres';
  });
  cloud.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-genre]');
    if (!chip) return;
    chip.classList.toggle('is-on');
  });
  $('#clearFilters', mount).addEventListener('click', () => go('/browse'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const picked = $$('.genre-chip.is-on', cloud);
    const next = {
      q: fd.get('q')?.trim(), type: fd.get('type'), status: fd.get('status'),
      orderBy: fd.get('orderBy'), startYear: fd.get('startYear'), minScore: fd.get('minScore'),
      genre: picked.map((c) => c.dataset.genre).join(','),
      genreName: picked.length === 1 ? picked[0].dataset.name : '',
    };
    go('/browse' + buildQuery(next));
  });

  /* ── fetch ─────────────────────────────────────────── */
  const params = {
    q: q.q, page, limit: 24,
    type: q.type || (q.sort === 'trending' ? '' : ''),
    status: q.status === 'upcoming' ? 'upcoming' : q.status,
    genres: q.genre, minScore: q.minScore, startYear: q.startYear,
    orderBy: q.orderBy || (q.sort === 'trending' ? 'members' : (q.q ? '' : 'members')),
    sort: q.orderBy === 'title' ? 'asc' : 'desc',
  };

  const res = await api.search(params);
  const resultsHost = $('#results', mount);
  const subEl = $('#browseSub', mount);
  const countEl = $('#resultCount', mount);

  if (!res.items.length) {
    resultsHost.innerHTML = emptyState(
      'Nothing matched',
      q.q ? `No titles for “${q.q}”. Try a looser spelling or drop a filter.` : 'Loosen the filters and try again.',
      '<a class="btn btn--ghost" href="#/browse">Reset filters</a>',
    );
    subEl.textContent = 'No matches';
    return { destroy: offNotice };
  }

  resultsHost.innerHTML = `<div class="grid-posters">${res.items.map((a, i) => cardHTML(a, { eager: i < 6 })).join('')}</div>`;
  const totalTxt = res.total ? `${res.total.toLocaleString()} titles` : `${res.items.length} titles`;
  subEl.textContent = `${totalTxt}${res.last > 1 ? ` · page ${res.page} of ${res.last}` : ''}`;
  countEl.textContent = `Showing ${res.items.length} of ${totalTxt}`;

  /* ── pagination ────────────────────────────────────── */
  if (res.last > 1) {
    const cur = res.page, last = Math.min(res.last, 200);
    const nums = new Set([1, last, cur, cur - 1, cur + 1, cur - 2, cur + 2]);
    const pages = [...nums].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
    let html = `<div class="pager">
      <button data-p="${cur - 1}" ${cur <= 1 ? 'disabled' : ''} aria-label="Previous page">${svg(ICON.chevL)}</button>`;
    let prev = 0;
    for (const n of pages) {
      if (n - prev > 1) html += '<span>…</span>';
      html += `<button data-p="${n}" class="${n === cur ? 'is-active' : ''}">${n}</button>`;
      prev = n;
    }
    html += `<button data-p="${cur + 1}" ${cur >= last ? 'disabled' : ''} aria-label="Next page">${svg(ICON.chevR)}</button></div>`;
    $('#pager', mount).innerHTML = html;
    $('#pager', mount).addEventListener('click', (e) => {
      const b = e.target.closest('[data-p]');
      if (!b || b.disabled) return;
      go('/browse' + buildQuery({ ...q, page: b.dataset.p }));
      scrollTop();
    });
  }

  return { destroy: offNotice };
}
