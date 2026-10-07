/* LAYOUT: HUB — dense dark streaming hub.
   Slim top bar with a centred command-style search, one wide 16:9 hero with
   a paged spotlight, a scrollable genre rail, and 16:9 continue-watching
   cards. Violet for active state, cyan for the headline. */
import { esc, attr, imgTag, genPoster, fmtCount, fmtTime, relTime } from '../util.js';
import { ICON, svg, displayTitle } from '../components.js';
import { continueWatching, removeFromList, clearProgress } from '../store.js';

const NAV = [
  ['home','Home','/'],['browse','Browse','/browse'],
  ['schedule','Schedule','/schedule'],['library','Library','/library'],
  ['settings','Settings','/settings'],
];

export default {
  id: 'hub',
  name: 'Hub',
  tagline: 'Dense streaming hub',
  blurb: 'Slim top bar with a command-style search, one wide 16:9 spotlight you page through, a scrollable genre rail and continue-watching cards. Violet accents, heavy on metadata badges.',
  theme: 'ink',
  thumb: `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#0a0a0c"/><rect x="0" y="0" width="120" height="9" fill="#121216"/><rect x="4" y="3" width="3" height="3" fill="#6a6a78"/><rect x="10" y="3" width="16" height="3" fill="#e8e8ee"/><rect x="42" y="2.5" width="30" height="4" rx="2" fill="#1c1c22"/><circle cx="114" cy="4.5" r="2.6" fill="#2a2a33"/><rect x="6" y="13" width="108" height="36" rx="3" fill="#241b2e"/><rect x="9" y="16" width="16" height="5" rx="2" fill="#000" opacity=".55"/><rect x="100" y="16" width="11" height="5" rx="2" fill="#000" opacity=".55"/><rect x="34" y="31" width="52" height="6" fill="#67d3e8"/><rect x="38" y="40" width="44" height="2" fill="#6a6a78"/><rect x="86" y="42" width="24" height="5" rx="2" fill="#e8e8ee"/><g fill="#1c1c22"><rect x="6" y="53" width="15" height="5" rx="2.5"/><rect x="24" y="53" width="15" height="5" rx="2.5"/><rect x="42" y="53" width="15" height="5" rx="2.5"/><rect x="60" y="53" width="15" height="5" rx="2.5"/><rect x="78" y="53" width="15" height="5" rx="2.5"/></g><g fill="#16161a"><rect x="6" y="63" width="25" height="14" rx="2"/><rect x="34" y="63" width="25" height="14" rx="2"/><rect x="62" y="63" width="25" height="14" rx="2"/><rect x="90" y="63" width="25" height="14" rx="2"/></g></svg>`,

  shell() {
    return `
    <header class="hb-bar" data-chrome>
      <button class="hb-ico hb-burger" data-act="menu" aria-label="Menu">${svg('<path d="M3 7h18M3 12h18M3 17h18"/>')}</button>
      <a class="hb-mark" href="#/">KITSU<span>LIVE</span><i>.tv</i></a>
      <div class="hb-mid">
        <div class="hb-search" data-searchbox>
          ${svg(ICON.search)}
          <input data-search type="search" placeholder="Search Anime" aria-label="Search anime">
          <kbd>⌘</kbd>
          <div class="suggest" data-suggest hidden></div>
        </div>
        <button class="hb-sq" data-act="focussearch" aria-label="Search">${svg(ICON.search)}</button>
        <button class="hb-sq" data-act="random" aria-label="Random anime" title="Random">${svg(ICON.shuffle)}</button>
      </div>
      <div class="hb-right">
        <button class="hb-ico" data-act="layout" aria-label="Change design" title="Change design (D)">
          ${svg('<rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M3 9h18"/>')}</button>
        <button class="hb-ico" data-act="theme" aria-label="Theme" title="Invert">
          ${svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none"/>')}</button>
        <a class="hb-avatar" href="#/settings" data-nav="settings" aria-label="Settings">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg></a>
      </div>
      <div class="topbar__progress" id="loadBar" aria-hidden="true"></div>
    </header>
    <nav class="hb-drawer">
      ${NAV.map(([k,l,h])=>`<a href="#${h}" data-nav="${k}" data-act="closemenu">${l}</a>`).join('')}
    </nav>
    <div class="hb-notice" data-hbnotice>
      <span class="hb-notice__i">${svg('<path d="M12 3 2.5 20h19Z"/><path d="M12 10v4M12 17h.01"/>')}</span>
      <span data-apistate></span>
      <span class="hb-notice__t">Catalogue data from Jikan · no video is hosted here</span>
      <button class="hb-notice__x" data-hbclose aria-label="Dismiss">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
    </div>`;
  },

  afterMount(root) {
    root.querySelector('[data-hbclose]')?.addEventListener('click', () => {
      root.querySelector('[data-hbnotice]')?.remove();
    });
    root.querySelector('[data-act="focussearch"]')?.addEventListener('click', () => {
      root.querySelector('[data-search]')?.focus();
    });
  },

  foot() {
    return `<footer class="hb-foot">
      <span>KITSU<b>LIVE</b></span>
      <span>An independent anime index · metadata from Jikan (MyAnimeList) · not affiliated with any studio or service</span>
    </footer>`;
  },

  home(mount, d) {
    const spot = d.spotlight.length ? d.spotlight : d.trending.slice(0, 7);
    const nav = (title, link) => `<div class="hb-h"><span class="hb-h__k">${esc(title.k)}</span><h2>${esc(title.t)}</h2>
      ${link?`<a href="${attr(link)}">View all ${svg(ICON.chevR)}</a>`:''}</div>`;

    mount.innerHTML = `
      <div class="hb-page">
        <section class="hb-hero">
          ${spot.map((a, i) => {
            const t = displayTitle(a);
            return `<article class="hb-slide ${i===0?'is-active':''}">
              <div class="hb-slide__bg">${imgTag(a.banner||a.poster||genPoster(t),'',t,{ratio:'16/9',eager:i===0})}</div>
              <div class="hb-slide__top">
                <span class="hb-pill">${svg(ICON.clock)} ${a.episodes?`EP ${a.episodes}`:'EP —'}${a.airing?' · AIRING':''}</span>
              </div>
              <div class="hb-slide__in">
                <div class="hb-chips">
                  <span>${esc(a.type||'TV')}</span>
                  ${a.episodes?`<span>${svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 11h3M7 14h6"/>')} ${a.episodes}</span>`:''}
                  ${a.score?`<span>☆ ${Math.round(a.score*10)}</span>`:''}
                </div>
                <h1>${esc(t)}</h1>
                <p>${esc(a.synopsis||'')}</p>
              </div>
              <div class="hb-slide__cta">
                <a class="hb-btn" href="#/anime/${a.id}">${svg(ICON.info)} DETAILS</a>
                <a class="hb-btn hb-btn--go" href="#/watch/${a.id}?ep=1">${svg(ICON.play)} WATCH NOW</a>
              </div>
            </article>`;
          }).join('')}
          <div class="hb-pager">
            <button data-step="-1" aria-label="Previous">${svg(ICON.chevL)}</button>
            <span><b data-cur>1</b> / <i>${spot.length}</i></span>
            <button data-step="1" aria-label="Next">${svg(ICON.chevR)}</button>
          </div>
        </section>

        <div class="hb-rail" data-rail>
          <button class="hb-rail__a hb-rail__a--l" data-scroll="-1" aria-label="Scroll left">${svg(ICON.chevL)}</button>
          <div class="hb-rail__t">
            ${d.genres.slice(0,20).map(g=>`<a href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`).join('')}
          </div>
          <button class="hb-rail__a hb-rail__a--r" data-scroll="1" aria-label="Scroll right">${svg(ICON.chevR)}</button>
        </div>

        <section class="hb-sec" id="hbResume" ${d.resume.length?'':'hidden'}>
          ${nav({k:'Your Watchlist',t:'Watch History'},'#/library?tab=watching')}
          <div class="hb-wide" id="hbResumeRow"></div>
        </section>

        <section class="hb-sec">${nav({k:'Right now',t:'Trending'},'#/browse?sort=trending')}
          <div class="hb-grid">${d.trending.slice(0,14).map(a=>this.card(a)).join('')}</div></section>

        ${d.recent.length?`<section class="hb-sec">${nav({k:'Just dropped',t:'New Episodes'})}
          <div class="hb-wide">${d.recent.slice(0,8).map(r=>{
            const a=r.anime;const t=displayTitle(a);const n=r.episodes[0]?.num||1;
            return `<a class="hb-ep" href="#/watch/${a.id}?ep=${n}">
              <span class="hb-ep__art">${imgTag(a.poster||genPoster(t),'',t,{ratio:'16/9'})}
                <span class="hb-ep__n">EP ${n}</span></span>
              <b>${esc(t)}</b></a>`;}).join('')}</div></section>`:''}

        <section class="hb-sec">${nav({k:'This season',t:'Airing Now'},'#/browse?season=now')}
          <div class="hb-grid">${d.season.slice(0,14).map(a=>this.card(a)).join('')}</div></section>

        <section class="hb-sec">${nav({k:'All time',t:'Highest Rated'},'#/browse?orderBy=score')}
          <div class="hb-grid">${d.allTime.concat(d.topRated).slice(0,14).map(a=>this.card(a)).join('')}</div></section>

        <section class="hb-sec">${nav({k:'Feature length',t:'Films'},'#/browse?type=movie')}
          <div class="hb-grid">${d.movies.slice(0,14).map(a=>this.card(a)).join('')}</div></section>
      </div>`;


    /* hero paging */
    const slides = [...mount.querySelectorAll('.hb-slide')];
    const curEl = mount.querySelector('[data-cur]');
    let i = 0, timer;
    const show = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s,k)=>s.classList.toggle('is-active',k===i));
      if (curEl) curEl.textContent = i + 1;
    };
    mount.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{show(i + +b.dataset.step);restart();}));
    const restart = () => { clearInterval(timer); timer = setInterval(()=>show(i+1), 9000); };
    restart();

    /* genre rail arrows */
    const rail = mount.querySelector('.hb-rail__t');
    mount.querySelectorAll('[data-scroll]').forEach(b=>b.addEventListener('click',()=>
      rail.scrollBy({ left: +b.dataset.scroll * rail.clientWidth * 0.7, behavior:'smooth' })));

    /* continue watching, with remove buttons */
    const renderResume = () => {
      const rows = continueWatching(12);
      const sec = mount.querySelector('#hbResume');
      if (!sec) return;
      sec.hidden = !rows.length;
      mount.querySelector('#hbResumeRow').innerHTML = rows.map((r) => {
        const a = r.anime || {}; const t = displayTitle(a);
        return `<div class="hb-hist">
          <a href="#/watch/${a.id}?ep=${r.nextEp}${r.resumeAt?`&t=${Math.floor(r.resumeAt)}`:''}">
            <span class="hb-hist__art">${imgTag(a.poster||genPoster(t),'',t,{ratio:'16/9'})}
              <span class="hb-hist__n">EP ${r.ep}</span>
              <span class="hb-hist__t">${fmtTime(r.position)}/${fmtTime(r.duration)}</span>
              <span class="hb-hist__bar"><i style="width:${(r.pct||0).toFixed(1)}%"></i></span>
            </span>
            <b>${esc(t)}</b>
          </a>
          <button class="hb-hist__x" data-drop="${attr(a.id)}" aria-label="Remove">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
        </div>`;
      }).join('');
      mount.querySelectorAll('[data-drop]').forEach(b=>b.addEventListener('click',()=>{
        clearProgress(Number(b.dataset.drop)||b.dataset.drop); renderResume();
      }));
    };
    renderResume();

    return { destroy() { clearInterval(timer); } };
  },

  card(a) {
    const t = displayTitle(a);
    return `<a class="hb-card" href="#/anime/${a.id}">
      <span class="hb-card__art">
        ${imgTag(a.poster||genPoster(t),t,t)}
        <span class="hb-card__badges">
          ${a.score?`<i class="is-score">☆ ${a.score.toFixed(1)}</i>`:''}
          ${a.airing?`<i class="is-air">●</i>`:''}
        </span>
        <span class="hb-card__ov">${svg(ICON.play)}</span>
      </span>
      <b>${esc(t)}</b>
      <small>${esc(a.type||'')}${a.episodes?` · ${a.episodes} ep`:''}${a.year?` · ${a.year}`:''}</small>
    </a>`;
  },
};
