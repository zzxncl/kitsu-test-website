/* Kitsu Live — HTML builders shared across pages. */
import { esc, attr, imgTag, fmtCount, genPoster, relTime, fmtTime } from './util.js';
import { getSettings, inList, seenEpisodes, lastWatchedEp } from './store.js';

export const ICON = {
  play:    '<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>',
  pause:   '<path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  star:    '<path d="m12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" fill="currentColor" stroke="none"/>',
  starO:   '<path d="m12 3.6 2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  check:   '<path d="M20 6 9 17l-5-5"/>',
  info:    '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  chevL:   '<path d="m15 18-6-6 6-6"/>',
  chevR:   '<path d="m9 6 6 6-6 6"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  film:    '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 4v16M16 4v16M3 10h18M3 14h18"/>',
  tv:      '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="m8 21 4-3 4 3"/>',
  bolt:    '<path d="M13 3 5 14h5l-1 7 8-11h-5z"/>',
  fire:    '<path d="M12 3c1.5 3 4.5 4.2 4.5 8A4.5 4.5 0 0 1 12 15.5 4.5 4.5 0 0 1 7.5 11C7.5 7.2 10.5 6 12 3Z"/><path d="M12 21a6 6 0 0 0 6-6c0-1-.3-2-.8-2.8"/>',
  heart:   '<path d="M12 20s-7-4.3-7-9.4A4.1 4.1 0 0 1 12 7.6 4.1 4.1 0 0 1 19 10.6c0 5.1-7 9.4-7 9.4Z"/>',
  users:   '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11.2A3.2 3.2 0 1 0 17 5M18.5 20a6 6 0 0 0-3-5.2"/>',
  trash:   '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  shuffle: '<path d="M18 4l3 3-3 3M18 14l3 3-3 3M3 7h5l9 10h4M3 17h5l2-2.2M14.5 9.2 17 7h4"/>',
  external:'<path d="M14 4h6v6M20 4 10 14M19 13v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/>',
  download:'<path d="M12 3v12M7.5 11 12 15.5 16.5 11M4 20h16"/>',
};
export const svg = (p, cls = '') => `<svg viewBox="0 0 24 24" class="${attr(cls)}" aria-hidden="true">${p}</svg>`;

/** Respect the user's title-language preference. */
export function displayTitle(a) {
  if (!a) return '';
  return getSettings().titleLang === 'english' ? (a.titleEn || a.title) : (a.title || a.titleEn);
}

const TYPE_ICON = { Movie: ICON.film, TV: ICON.tv, ONA: ICON.tv, OVA: ICON.film, Special: ICON.film };

/* ── poster card ──────────────────────────────────────── */
export function cardHTML(a, opts = {}) {
  if (!a?.id) return '';
  const { rank = null, showProgress = false, eager = false } = opts;
  const title = displayTitle(a);
  const poster = a.poster || genPoster(title);
  const seen = showProgress ? lastWatchedEp(a.id) : null;
  const pct = seen?.duration > 0 ? Math.min(100, (seen.position / seen.duration) * 100) : 0;
  const metaBits = [a.type, a.episodes ? `${a.episodes} ep` : null, a.year].filter(Boolean);

  return `
  <a class="card" href="#/anime/${a.id}" aria-label="${attr(title)}">
    <div class="card__art">
      ${imgTag(poster, title, title, { eager })}
      <div class="card__tl">
        ${a.score ? `<span class="card__badge card__badge--score">${svg(ICON.star)}${a.score.toFixed(2)}</span>` : ''}
      </div>
      <div class="card__tr">
        ${a.airing ? `<span class="card__badge" style="color:#ff8a6b">● Airing</span>` : ''}
        ${inList(a.id) ? `<span class="card__badge">${svg(ICON.check)}</span>` : ''}
      </div>
      ${rank != null ? `<span class="card__badge card__badge--rank" style="position:absolute;left:.45rem;bottom:.45rem;z-index:2">#${rank}</span>` : ''}
      <div class="card__scrim"><p>${esc((a.synopsis || '').slice(0, 170))}${(a.synopsis || '').length > 170 ? '…' : ''}</p></div>
      <span class="card__play">${svg(ICON.play)}</span>
      ${pct > 1 ? `<div class="progress card__progress"><span style="width:${pct.toFixed(1)}%"></span></div>` : ''}
    </div>
    <div class="card__body">
      <h3 class="card__title">${esc(title)}</h3>
      <p class="card__meta">${metaBits.map((b, i) => (i ? `<i>•</i>${esc(b)}` : esc(b))).join('')}</p>
      ${seen && showProgress ? `<p class="card__meta" style="color:var(--ember)">${seen.done ? `Ep ${seen.ep} done` : `Ep ${seen.ep} · ${fmtTime(seen.position)}`}</p>` : ''}
    </div>
  </a>`;
}

/* ── wide / episode card ──────────────────────────────── */
export function episodeCardHTML(a, ep, sub = '') {
  const title = displayTitle(a);
  return `
  <a class="ecard" href="#/watch/${a.id}?ep=${ep || 1}" aria-label="${attr(title)} episode ${ep}">
    <div class="ecard__art">
      ${imgTag(a.poster || genPoster(title), title, title, { ratio: '16/9' })}
      <span class="ecard__pill">EP ${esc(ep || 1)}</span>
      <span class="card__play">${svg(ICON.play)}</span>
    </div>
    <div class="ecard__body">
      <h3 class="ecard__title">${esc(title)}</h3>
      <p class="ecard__sub">${esc(sub || `Episode ${ep || 1}`)}</p>
    </div>
  </a>`;
}

/** Continue-watching card: resumes at the saved position. */
export function resumeCardHTML(row) {
  const a = row.anime || {};
  const title = displayTitle(a);
  const label = row.done ? `Up next: Episode ${row.nextEp}` : `Episode ${row.ep} · ${fmtTime(row.position)} / ${fmtTime(row.duration)}`;
  return `
  <a class="ecard" href="#/watch/${a.id}?ep=${row.nextEp}${row.resumeAt ? `&t=${Math.floor(row.resumeAt)}` : ''}">
    <div class="ecard__art">
      ${imgTag(a.poster || genPoster(title), title, title, { ratio: '16/9' })}
      <span class="ecard__pill">${row.done ? `NEXT · EP ${row.nextEp}` : `EP ${row.ep}`}</span>
      <span class="card__play">${svg(ICON.play)}</span>
      <div class="progress card__progress"><span style="width:${(row.pct || 0).toFixed(1)}%"></span></div>
    </div>
    <div class="ecard__body">
      <h3 class="ecard__title">${esc(title)}</h3>
      <p class="ecard__sub">${esc(label)} · ${esc(relTime(row.updatedAt))}</p>
    </div>
  </a>`;
}

/* ── compact ranked row ───────────────────────────────── */
export function topRowHTML(a, n) {
  const title = displayTitle(a);
  return `
  <a class="toprow" href="#/anime/${a.id}">
    <span class="toprow__n">${n}</span>
    <span class="toprow__art">${imgTag(a.poster || genPoster(title), title, title)}</span>
    <span class="toprow__info">
      <b>${esc(title)}</b>
      <small>
        ${a.score ? `<span class="chip chip--score" style="padding:.05rem .32rem">${a.score.toFixed(2)}</span>` : ''}
        ${esc(a.type || '')}${a.episodes ? ` · ${a.episodes} ep` : ''}
        ${a.members ? ` · ${fmtCount(a.members)} ${svg(ICON.users, '')}`.replace(/<svg[^>]*>.*<\/svg>/, 'members') : ''}
      </small>
    </span>
  </a>`;
}

/* ── rails ────────────────────────────────────────────── */
let railSeq = 0;
export function railHTML(title, inner, opts = {}) {
  const { link = null, linkLabel = 'See all', wide = false, icon = null, id = `rail-${++railSeq}` } = opts;
  return `
  <section class="section">
    <div class="section__head">
      <div class="section__title">${icon ? svg(icon, 'section-icon') : ''}<h2>${esc(title)}</h2></div>
      <div class="section__more">
        ${link ? `<a class="section__link" href="${attr(link)}">${esc(linkLabel)} →</a>` : ''}
      </div>
    </div>
    <div class="rail" data-rail>
      <button class="rail__nav rail__nav--prev" data-rail-prev aria-label="Scroll left">${svg(ICON.chevL)}</button>
      <div class="rail__track ${wide ? 'rail__track--wide' : ''}" id="${attr(id)}">${inner}</div>
      <button class="rail__nav rail__nav--next" data-rail-next aria-label="Scroll right">${svg(ICON.chevR)}</button>
    </div>
  </section>`;
}

export function skeletonRail(title, n = 8, wide = false) {
  const one = wide
    ? '<div><div class="sk sk--wide"></div><div class="sk sk--line w80"></div><div class="sk sk--line w40"></div></div>'
    : '<div><div class="sk sk--poster"></div><div class="sk sk--line w80"></div><div class="sk sk--line w40"></div></div>';
  return railHTML(title, one.repeat(n), { wide });
}
export function skeletonGrid(n = 12) {
  return `<div class="grid-posters">${
    '<div><div class="sk sk--poster"></div><div class="sk sk--line w80"></div><div class="sk sk--line w40"></div></div>'.repeat(n)
  }</div>`;
}

/* ── states ───────────────────────────────────────────── */
export function emptyState(title, msg, action = '') {
  return `<div class="state">
    <div class="state__icon">${svg(ICON.search)}</div>
    <h3>${esc(title)}</h3><p>${esc(msg)}</p>${action}
  </div>`;
}
export function errorState(msg, retryAttr = 'data-retry') {
  return `<div class="state">
    <div class="state__icon" style="color:var(--bad)">${svg(ICON.info)}</div>
    <h3>That didn't load</h3><p>${esc(msg)}</p>
    <button class="btn btn--ghost" ${retryAttr}>Try again</button>
  </div>`;
}

export function demoNotice() {
  return `<div class="notice" style="margin:1rem 0">
    ${svg(ICON.info)}
    <div><b>Demo catalog.</b> The live metadata API (api.jikan.moe) isn't reachable from this browser right now,
    so Kitsu Live is showing its bundled sample library. Everything else — search, filters, watchlist,
    progress, the player — works exactly the same.</div>
  </div>`;
}

export function starsHTML(score) {
  if (!score) return '';
  const filled = Math.round(score / 2);
  return `<span class="stars" aria-label="${score} out of 10">${
    Array.from({ length: 5 }, (_, i) => `<svg viewBox="0 0 24 24" class="${i < filled ? '' : 'is-off'}">${ICON.star}</svg>`).join('')
  }</span>`;
}

export function genreChips(genres = [], limit = 6) {
  return genres.slice(0, limit).map((g) =>
    `<a class="chip chip--link" href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`,
  ).join('');
}

/** Wire the arrow buttons + state for every rail inside a root node. */
export function bindRails(root) {
  root.querySelectorAll('[data-rail]').forEach((rail) => {
    const track = rail.querySelector('.rail__track');
    const prev = rail.querySelector('[data-rail-prev]');
    const next = rail.querySelector('[data-rail-next]');
    if (!track) return;
    const step = () => Math.max(240, track.clientWidth * 0.82);
    const sync = () => {
      const max = track.scrollWidth - track.clientWidth - 4;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max;
    };
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    new ResizeObserver(sync).observe(track);
    sync();
  });
}

/** Episode grid used on the info page. */
export function epGridHTML(animeId, episodes, activeEp = null) {
  const seen = seenEpisodes(animeId);
  return `<div class="epgrid">${episodes.map((e) => `
    <a class="epbtn ${activeEp === e.num ? 'is-active' : ''} ${seen.has(e.num) ? 'is-seen' : ''} ${e.filler ? 'is-filler' : ''}"
       href="#/watch/${animeId}?ep=${e.num}" title="${attr(e.title || `Episode ${e.num}`)}${e.filler ? ' (filler)' : ''}">
       ${e.num}
    </a>`).join('')}</div>`;
}
