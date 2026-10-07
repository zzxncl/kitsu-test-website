/* LAYOUT: ORBIT — app shell. A fixed icon rail down the left, a floating
   search bar, one wide featured banner, then dense uniform grids. No rails,
   no carousel: everything is visible at once. */
import { esc, attr, imgTag, genPoster, fmtCount, fmtTime } from '../util.js';
import { ICON, svg, displayTitle, genreChips, demoNotice } from '../components.js';

const NAV = [
  ['home','Home','/','<path d="M4 11.5 12 4l8 7.5V20H4z"/>'],
  ['browse','Browse','/browse','<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>'],
  ['schedule','Schedule','/schedule','<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>'],
  ['library','Library','/library','<path d="M6 4h12v17l-6-4-6 4z"/>'],
  ['settings','Settings','/settings','<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87M4.6 9a1.7 1.7 0 0 0-.34-1.87"/><circle cx="12" cy="12" r="8.6"/>'],
];

export default {
  id: 'orbit',
  name: 'Orbit',
  tagline: 'App shell, dense grid',
  blurb: 'A fixed icon rail down the left edge and a floating search bar. One wide featured banner, then uniform dense grids — no carousels, everything visible at once.',
  theme: 'ink',
  thumb: `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#0d1117"/><rect x="0" y="0" width="14" height="80" fill="#151b24"/><circle cx="7" cy="9" r="3.4" fill="#4d8dff"/><rect x="4" y="20" width="6" height="6" rx="1.6" fill="#4d8dff"/><rect x="4" y="31" width="6" height="6" rx="1.6" fill="#3a4454"/><rect x="4" y="42" width="6" height="6" rx="1.6" fill="#3a4454"/><rect x="21" y="5" width="60" height="7" rx="3.5" fill="#1d2530"/><rect x="21" y="17" width="92" height="26" rx="4" fill="#243043"/><rect x="25" y="33" width="26" height="5" rx="2" fill="#e9eef5"/><g fill="#1d2530"><rect x="21" y="50" width="20" height="26" rx="3"/><rect x="45" y="50" width="20" height="26" rx="3"/><rect x="69" y="50" width="20" height="26" rx="3"/><rect x="93" y="50" width="20" height="26" rx="3"/></g></svg>`,

  shell() {
    return `
    <aside class="ob-rail" data-chrome>
      <a class="ob-logo" href="#/" title="Kitsu Live">
        <svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="10" fill="none" stroke="currentColor" stroke-width="3"/><path d="M13 11v18M13 20l10-9M13 20l10 9" fill="none" stroke="currentColor" stroke-width="3.2"/></svg>
      </a>
      <nav class="ob-nav">
        ${NAV.map(([k,l,h,ic])=>`<a href="#${h}" data-nav="${k}" title="${attr(l)}">
          <svg viewBox="0 0 24 24">${ic}</svg><span>${l}</span></a>`).join('')}
      </nav>
      <div class="ob-rail__foot">
        <button class="ob-ico" data-act="layout" title="Change design (D)">${svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>')}</button>
        <button class="ob-ico" data-act="theme" title="Theme">${svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none"/>')}</button>
      </div>
    </aside>
    <div class="ob-top">
      <div class="ob-search" data-searchbox>
        ${svg(ICON.search)}
        <input data-search type="search" placeholder="Search anime, genres, years…" aria-label="Search">
        <div class="suggest" data-suggest hidden></div>
      </div>
      <button class="ob-pill" data-act="random">${svg(ICON.shuffle)} Surprise me</button>
      <span class="ob-state" data-apistate></span>
      <div class="topbar__progress" id="loadBar" aria-hidden="true"></div>
    </div>`;
  },

  foot() {
    return `<footer class="ob-foot"><p>Kitsu Live · metadata from Jikan (MyAnimeList) · no video hosted here</p></footer>`;
  },

  home(mount, d) {
    const hero = d.spotlight[0];
    const ht = hero ? displayTitle(hero) : '';
    const grid = (items, n = 18) => `<div class="ob-grid">${items.slice(0, n).map((a) => this.card(a)).join('')}</div>`;
    const head = (title, link) => `<div class="ob-head"><h2>${esc(title)}</h2>${link?`<a href="${attr(link)}">See all ${svg(ICON.chevR)}</a>`:''}</div>`;

    mount.innerHTML = `
      <div class="ob-page">
        <div id="homeNotice"></div>
        ${hero ? `<section class="ob-feature">
          <div class="ob-feature__bg">${imgTag(hero.banner || hero.poster || genPoster(ht), '', ht, { ratio:'16/9', eager:true })}</div>
          <div class="ob-feature__body">
            <span class="ob-tag">${hero.airing?'Airing now':'Featured'}</span>
            <h1>${esc(ht)}</h1>
            <p>${esc((hero.synopsis||'').slice(0,190))}${(hero.synopsis||'').length>190?'…':''}</p>
            <div class="ob-stats">
              ${hero.score?`<span><b>${hero.score.toFixed(2)}</b>Score</span>`:''}
              ${hero.episodes?`<span><b>${hero.episodes}</b>Episodes</span>`:''}
              ${hero.members?`<span><b>${fmtCount(hero.members)}</b>Members</span>`:''}
              ${hero.year?`<span><b>${hero.year}</b>Year</span>`:''}
            </div>
            <div class="ob-cta">
              <a class="btn btn--primary" href="#/watch/${hero.id}?ep=1">${svg(ICON.play)} Play</a>
              <a class="btn btn--ghost" href="#/anime/${hero.id}">More info</a>
            </div>
          </div>
        </section>` : ''}

        ${d.resume.length ? `<section class="ob-sec">${head('Continue watching','#/library?tab=watching')}
          <div class="ob-rowgrid">${d.resume.slice(0,4).map((r)=>{
            const a = r.anime||{}; const t = displayTitle(a);
            return `<a class="ob-resume" href="#/watch/${a.id}?ep=${r.nextEp}${r.resumeAt?`&t=${Math.floor(r.resumeAt)}`:''}">
              <span class="ob-resume__art">${imgTag(a.poster||genPoster(t),'',t,{ratio:'16/9'})}
                <span class="ob-resume__bar"><i style="width:${(r.pct||0).toFixed(1)}%"></i></span></span>
              <span class="ob-resume__t"><b>${esc(t)}</b><small>${r.done?`Next: EP ${r.nextEp}`:`EP ${r.ep} · ${fmtTime(r.position)}`}</small></span>
            </a>`;}).join('')}</div></section>` : ''}

        <section class="ob-sec">${head('Trending','#/browse?sort=trending')}${grid(d.trending)}</section>
        <section class="ob-sec">${head('This season','#/browse?season=now')}${grid(d.season)}</section>
        <section class="ob-sec">${head('Top rated','#/browse?orderBy=score')}${grid(d.allTime.concat(d.topRated), 18)}</section>
        <section class="ob-sec">${head('Films','#/browse?type=movie')}${grid(d.movies, 12)}</section>
        <section class="ob-sec">${head('Browse by genre')}
          <div class="ob-genres">${d.genres.slice(0,18).map(g=>`<a href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`).join('')}</div>
        </section>
      </div>`;
    if (d.demo) mount.querySelector('#homeNotice').innerHTML = demoNotice();
  },

  card(a) {
    const t = displayTitle(a);
    return `<a class="ob-card" href="#/anime/${a.id}">
      <span class="ob-card__art">
        ${imgTag(a.poster || genPoster(t), t, t)}
        ${a.score?`<span class="ob-card__score">★ ${a.score.toFixed(2)}</span>`:''}
        <span class="ob-card__hover">${svg(ICON.play)}</span>
      </span>
      <b>${esc(t)}</b>
      <small>${esc(a.type||'')}${a.year?` · ${a.year}`:''}</small>
    </a>`;
  },
};
