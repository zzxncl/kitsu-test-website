/* Kitsu Live — home: spotlight + rails. */
import { api, onApiState } from '../api.js';
import { continueWatching, onStoreChange } from '../store.js';
import {
  cardHTML, railHTML, skeletonRail, bindRails, resumeCardHTML, topRowHTML,
  episodeCardHTML, demoNotice, ICON, svg, displayTitle, genreChips,
} from '../components.js';
import { $, $$, imgTag, esc, attr, genPoster, setMeta, fmtCount } from '../util.js';
import { CONFIG } from '../config.js';

export default async function home({ mount }) {
  setMeta('', CONFIG.tagline);
  mount.innerHTML = `
    <section class="hero" id="hero">
      <div class="hero__stage">
        <div class="hero__slide is-active">
          <div class="hero__bg"><div class="sk sk--block" style="height:100%"></div></div>
          <div class="hero__content"><div class="hero__inner"></div></div>
          <div class="hero__content"><div class="hero__inner" style="width:min(640px,100%)">
            <div class="sk sk--line w40" style="height:1rem"></div>
            <div class="sk sk--line w80" style="height:2.6rem"></div>
            <div class="sk sk--line w60"></div><div class="sk sk--line w80"></div>
          </div></div>
        </div>
      </div>
    </section>
    <div class="ticker" id="ticker"></div>
    <div class="quickchips" id="quickchips"></div>
    <div id="homeNotice" class="wrap"></div>
    <div id="homeRails">
      ${skeletonRail('Continue watching', 5, true)}
      ${skeletonRail('Trending now', 8)}
      ${skeletonRail('This season', 8)}
    </div>`;

  const noticeHost = $('#homeNotice', mount);
  const offNotice = onApiState((s) => {
    noticeHost.innerHTML = s.demo ? demoNotice() : '';
  });

  /* quick chips — fetched alongside the hero, never blocking it */
  api.genres().then((genres) => {
    const host = $('#quickchips', mount);
    if (!host) return;
    host.innerHTML = [
    `<a href="#/browse?sort=trending">${'🔥'} Trending</a>`,
    `<a href="#/browse?season=now">This season</a>`,
    `<a href="#/browse?status=upcoming">Upcoming</a>`,
    `<a href="#/browse?type=movie">Movies</a>`,
    `<a href="#/browse?orderBy=score">Top rated</a>`,
      ...genres.slice(0, 12).map((g) =>
        `<a href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`),
    ].join('');
  });

  /* ── spotlight ─────────────────────────────────────── */
  const trending = await api.trending(24);
  const spotlight = trending.filter((a) => a.synopsis).slice(0, 10);
  const heroEl = $('#hero', mount);
  let heroIdx = 0, heroTimer = null;

  function renderHero() {
    if (!spotlight.length) { heroEl.remove(); return; }
    heroEl.innerHTML = `
      <div class="hero__stage">
        ${spotlight.map((a, i) => {
          const t = displayTitle(a);
          return `
          <article class="hero__slide ${i === 0 ? 'is-active' : ''}" data-slide="${i}">
            <div class="hero__bg ${i === 0 ? 'is-zoom' : ''}">${imgTag(a.banner || a.poster || genPoster(t), '', t, { ratio: '16/9', eager: i === 0 })}</div>
            <div class="hero__content"><div class="hero__inner">
              <p class="hero__eyebrow">SPOTLIGHT ${String(i + 1).padStart(2, '0')}${a.airing ? ' — ON AIR' : ''}</p>
              <h1 class="hero__title">${esc(t)}${a.titleEn && a.titleEn !== t ? `<small>${esc(a.titleEn)}</small>` : ''}</h1>
              <div class="hero__meta">
                ${a.score ? `<span class="chip chip--score">${svg(ICON.star)}${a.score.toFixed(2)}</span>` : ''}
                <span class="chip chip--ghost">${esc(a.type)}</span>
                ${a.episodes ? `<span class="chip chip--ghost">${a.episodes} episodes</span>` : ''}
                ${a.year ? `<span class="chip chip--ghost">${a.year}</span>` : ''}
                ${a.rating ? `<span class="chip chip--ghost">${esc(a.rating.split(' ')[0])}</span>` : ''}
                ${a.members ? `<span class="chip chip--ghost">${svg(ICON.users)}${fmtCount(a.members)}</span>` : ''}
              </div>
              <p class="hero__desc">${esc(a.synopsis)}</p>
              <div class="hero__genres">${genreChips(a.genres, 4)}</div>
              <div class="hero__cta">
                <a class="btn btn--primary" href="#/watch/${a.id}?ep=1">${svg(ICON.play)} Watch now</a>
                <a class="btn btn--ghost" href="#/anime/${a.id}">${svg(ICON.info)} Details</a>
              </div>
            </div></div>
          </article>`;
        }).join('')}
        <div class="hero__thumbs">
          ${spotlight.map((a, i) => `<button class="hero__thumb num ${i === 0 ? 'is-active' : ''}" data-dot="${i}"
            aria-label="${attr(displayTitle(a))}">${String(i + 1).padStart(2, '0')}</button>`).join('')}
        </div>
      </div>`;

    const slides = $$('.hero__slide', heroEl);
    const dots = $$('[data-dot]', heroEl);
    const show = (i) => {
      heroIdx = (i + slides.length) % slides.length;
      slides.forEach((s, k) => {
        s.classList.toggle('is-active', k === heroIdx);
        s.querySelector('.hero__bg')?.classList.toggle('is-zoom', k === heroIdx);
      });
      dots.forEach((d, k) => d.classList.toggle('is-active', k === heroIdx));
    };
    dots.forEach((d) => d.addEventListener('click', () => { show(Number(d.dataset.dot)); restart(); }));
    const restart = () => {
      clearInterval(heroTimer);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        heroTimer = setInterval(() => show(heroIdx + 1), 8000);
      }
    };
    restart();
    heroEl.addEventListener('pointerenter', () => clearInterval(heroTimer));
    heroEl.addEventListener('pointerleave', restart);
  }
  renderHero();

  /* ── rails ─────────────────────────────────────────── */
  const tickerEl = $('#ticker', mount);
  if (tickerEl && trending.length) {
    const run = trending.slice(0, 14).map((a) =>
      `<b>${esc(displayTitle(a))}</b>${a.score ? ` ${a.score.toFixed(2)}` : ''}<i>◆</i>`).join('');
    tickerEl.innerHTML = `<span class="ticker__run">${run}${run}</span>`;
  }

  const railHost = $('#homeRails', mount);

  function renderResume() {
    const rows = continueWatching(12);
    const host = $('#railResume', mount);
    if (!rows.length) { if (host) host.closest('.section').hidden = true; return; }
    if (host) {
      host.closest('.section').hidden = false;
      host.innerHTML = rows.map(resumeCardHTML).join('');
    }
  }

  const [season, topRated, movies, upcoming, allTime, recent] = await Promise.all([
    api.seasonNow(24), api.topRated(24), api.topMovies(20),
    api.seasonUpcoming(20), api.allTime(10), api.recentEpisodes(14),
  ]);

  railHost.innerHTML = `
    ${railHTML('Continue watching', '', { id: 'railResume', wide: true, icon: ICON.clock, link: '#/library?tab=watching', linkLabel: 'Shelf', idx: 0 })}
    ${railHTML('Trending now', trending.map((a, i) => cardHTML(a, { rank: i + 1 })).join(''),
      { link: '#/browse?sort=trending', icon: ICON.fire, idx: 1 })}
    ${recent.length ? railHTML('Fresh episodes',
      recent.map((r) => episodeCardHTML(r.anime, r.episodes[0]?.num || 1,
        r.episodes[0]?.title || `Episode ${r.episodes[0]?.num || 1}`)).join(''),
      { wide: true, icon: ICON.bolt, idx: 2 }) : ''}
    ${railHTML('This season', season.map((a) => cardHTML(a)).join(''), { link: '#/browse?season=now', icon: ICON.calendar, idx: 3 })}
    <section class="section">
      <div class="section__head">
        <div class="section__title"><span class="section__idx num">04</span>${svg(ICON.star)}<h2>All-time highest rated</h2></div>
        <div class="section__more"><a class="section__link" href="#/browse?orderBy=score">See all →</a></div>
      </div>
      <div class="toplist">${allTime.map((a, i) => topRowHTML(a, i + 1)).join('')}</div>
    </section>
    ${railHTML('Most popular', topRated.map((a) => cardHTML(a)).join(''), { link: '#/browse?orderBy=members', icon: ICON.users, idx: 5 })}
    ${railHTML('Films worth the evening', movies.map((a) => cardHTML(a)).join(''), { link: '#/browse?type=movie', icon: ICON.film, idx: 6 })}
    ${railHTML('On the horizon', upcoming.map((a) => cardHTML(a)).join(''), { link: '#/browse?status=upcoming', icon: ICON.calendar, idx: 7 })}`;

  renderResume();
  bindRails(mount);
  const offStore = onStoreChange((what) => { if (what === 'progress' || what === 'all') renderResume(); });

  return {
    destroy() { clearInterval(heroTimer); offNotice(); offStore(); },
  };
}
