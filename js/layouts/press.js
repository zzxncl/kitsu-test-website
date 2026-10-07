/* LAYOUT: PRESS — editorial broadsheet-brutalism.
   Top bar with numbered sections, a split hero where the title overruns the
   column onto the art, then horizontal rails. */
import { esc, attr, imgTag, genPoster, fmtCount } from '../util.js';
import { ICON, svg, displayTitle, railHTML, bindRails, topRowHTML, resumeCardHTML,
         episodeCardHTML, genreChips, demoNotice } from '../components.js';
import { continueWatching } from '../store.js';

const NAV = [['home','INDEX','/'],['browse','SEARCH','/browse'],['schedule','WEEK','/schedule'],['library','SHELF','/library']];

export default {
  id: 'press',
  name: 'Press',
  tagline: 'Editorial brutalism',
  blurb: 'Top bar with numbered sections. A split hero where the headline runs over the artwork. Horizontal rails underneath. Hairlines, no rounding.',
  theme: 'ink',
  thumb: `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#0b0b0c"/><rect x="0" y="0" width="120" height="11" fill="#131315"/><rect x="5" y="4" width="16" height="4" fill="#ff3b18"/><rect x="26" y="4" width="9" height="4" fill="#5a5a5a"/><rect x="38" y="4" width="9" height="4" fill="#5a5a5a"/><rect x="6" y="20" width="48" height="9" fill="#efece3"/><rect x="6" y="32" width="36" height="9" fill="#efece3"/><rect x="6" y="46" width="26" height="3" fill="#6b6961"/><rect x="6" y="53" width="20" height="5" fill="#ff3b18"/><rect x="64" y="11" width="56" height="48" fill="#2a2a2e"/><rect x="6" y="64" width="16" height="12" fill="#1c1c1f"/><rect x="25" y="64" width="16" height="12" fill="#1c1c1f"/><rect x="44" y="64" width="16" height="12" fill="#1c1c1f"/><rect x="63" y="64" width="16" height="12" fill="#1c1c1f"/></svg>`,

  shell() {
    return `
    <header class="pr-bar" data-chrome>
      <div class="pr-bar__in">
        <button class="pr-burger" data-act="menu" aria-label="Menu">
          <svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h18"/></svg></button>
        <a class="pr-brand" href="#/"><span class="pr-brand__mark">
          <svg viewBox="0 0 40 40"><rect x="1.5" y="1.5" width="37" height="37" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 10v20M11 20l11-10M11 20l11 10" fill="none" stroke="currentColor" stroke-width="3.4"/><rect x="26" y="17" width="6" height="6" fill="currentColor"/></svg>
        </span><span class="pr-brand__t">KITSU<i>/</i>LIVE</span></a>
        <nav class="pr-nav">
          ${NAV.map(([k,l,h],i)=>`<a href="#${h}" data-nav="${k}"><i>0${i+1}</i>${l}</a>`).join('')}
        </nav>
        <div class="pr-search" data-searchbox>
          <span class="pr-search__tag">FIND</span>
          <input data-search type="search" placeholder="TITLE, GENRE, YEAR…" aria-label="Search">
          <div class="suggest" data-suggest hidden></div>
        </div>
        <div class="pr-acts">
          <button class="icon-btn" data-act="random" title="Random">${svg(ICON.shuffle)}</button>
          <button class="icon-btn" data-act="layout" title="Change design (D)">${svg('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>')}</button>
          <button class="icon-btn" data-act="theme" title="Invert">${svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none"/>')}</button>
          <a class="icon-btn" href="#/settings" data-nav="settings" title="Settings">${svg('<path d="M4 7h16M4 12h16M4 17h16"/>')}</a>
        </div>
      </div>
      <div class="topbar__progress" id="loadBar" aria-hidden="true"></div>
    </header>
    <nav class="pr-drawer">
      ${NAV.concat([['settings','CONFIG','/settings']]).map(([k,l,h],i)=>`<a href="#${h}" data-nav="${k}" data-act="closemenu"><i>0${i+1}</i>${l}</a>`).join('')}
    </nav>`;
  },

  foot() {
    return `<footer class="pr-foot">
      <div class="pr-foot__in">
        <p class="pr-foot__mark">KITSU<span>/</span>LIVE</p>
        <p>An independent anime index. Metadata from Jikan (MyAnimeList). Not affiliated with any studio or service.</p>
        <p class="lbl" style="margin-top:.7rem"><span data-apistate></span> · NO VIDEO IS HOSTED HERE</p>
      </div>
    </footer>`;
  },

  home(mount, d) {
    const spot = d.spotlight;
    mount.innerHTML = `
      <section class="pr-hero">
        <div class="pr-hero__stage">
          ${spot.map((a, i) => {
            const t = displayTitle(a);
            return `<article class="pr-slide ${i===0?'is-active':''}" data-slide="${i}">
              <div class="pr-slide__bg">${imgTag(a.banner || a.poster || genPoster(t), '', t, { ratio:'16/9', eager:i===0 })}</div>
              <div class="pr-slide__body"><div class="pr-slide__inner">
                <p class="pr-eyebrow">SPOTLIGHT ${String(i+1).padStart(2,'0')}${a.airing?' — ON AIR':''}</p>
                <h1 class="pr-title">${esc(t)}</h1>
                <div class="pr-meta">
                  ${a.score?`<span class="chip chip--score">★ ${a.score.toFixed(2)}</span>`:''}
                  <span class="chip">${esc(a.type)}</span>
                  ${a.episodes?`<span class="chip">${a.episodes} EP</span>`:''}
                  ${a.year?`<span class="chip">${a.year}</span>`:''}
                  ${a.members?`<span class="chip">${fmtCount(a.members)}</span>`:''}
                </div>
                <p class="pr-desc">${esc(a.synopsis||'')}</p>
                <div class="pr-genres">${genreChips(a.genres,4)}</div>
                <div class="pr-cta">
                  <a class="btn btn--primary" href="#/watch/${a.id}?ep=1">${svg(ICON.play)} WATCH</a>
                  <a class="btn btn--ghost" href="#/anime/${a.id}">DETAILS</a>
                </div>
              </div></div>
            </article>`;
          }).join('')}
          <div class="pr-dots">${spot.map((_,i)=>`<button class="pr-dot ${i===0?'is-active':''}" data-dot="${i}">${String(i+1).padStart(2,'0')}</button>`).join('')}</div>
        </div>
      </section>
      <div class="ticker"><span class="ticker__run">${(()=>{const r=d.trending.slice(0,14).map(a=>`<b>${esc(displayTitle(a))}</b>${a.score?` ${a.score.toFixed(2)}`:''}<i>◆</i>`).join('');return r+r;})()}</span></div>
      <div class="pr-chips">${d.genres.slice(0,14).map(g=>`<a href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`).join('')}</div>
      <div class="wrap" id="homeNotice"></div>
      ${d.resume.length ? railHTML('Continue watching', d.resume.map(resumeCardHTML).join(''), { wide:true, idx:0, link:'#/library?tab=watching', linkLabel:'Shelf' }) : ''}
      ${railHTML('Trending now', d.trending.map((a,i)=>this.card(a,{rank:i+1})).join(''), { link:'#/browse?sort=trending', idx:1 })}
      ${d.recent.length ? railHTML('Fresh episodes', d.recent.map(r=>episodeCardHTML(r.anime, r.episodes[0]?.num||1, r.episodes[0]?.title||'')).join(''), { wide:true, idx:2 }) : ''}
      ${railHTML('This season', d.season.map(a=>this.card(a)).join(''), { link:'#/browse?season=now', idx:3 })}
      <section class="section">
        <div class="section__head"><div class="section__title"><span class="section__idx num">04</span><h2>All-time highest rated</h2></div>
        <div class="section__more"><a class="section__link" href="#/browse?orderBy=score">ALL →</a></div></div>
        <div class="toplist">${d.allTime.map((a,i)=>topRowHTML(a,i+1)).join('')}</div>
      </section>
      ${railHTML('Most popular', d.topRated.map(a=>this.card(a)).join(''), { link:'#/browse?orderBy=members', idx:5 })}
      ${railHTML('Films', d.movies.map(a=>this.card(a)).join(''), { link:'#/browse?type=movie', idx:6 })}
      ${railHTML('On the horizon', d.upcoming.map(a=>this.card(a)).join(''), { link:'#/browse?status=upcoming', idx:7 })}`;

    if (d.demo) mount.querySelector('#homeNotice').innerHTML = demoNotice();
    bindRails(mount);

    const slides = [...mount.querySelectorAll('.pr-slide')];
    const dots = [...mount.querySelectorAll('[data-dot]')];
    let i = 0, timer;
    const show = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s,k)=>s.classList.toggle('is-active',k===i));
      dots.forEach((x,k)=>x.classList.toggle('is-active',k===i));
    };
    dots.forEach(x=>x.addEventListener('click',()=>{show(+x.dataset.dot);restart();}));
    const restart=()=>{clearInterval(timer);timer=setInterval(()=>show(i+1),8000);};
    restart();
    return { destroy(){ clearInterval(timer); } };
  },

  card(a, opts = {}) {
    const t = displayTitle(a);
    const bits = [a.type, a.episodes?`${a.episodes} EP`:null, a.year].filter(Boolean);
    return `<a class="pr-card" href="#/anime/${a.id}">
      <span class="pr-card__art">
        ${imgTag(a.poster || genPoster(t), t, t)}
        ${a.score?`<span class="pr-card__score">★ ${a.score.toFixed(2)}</span>`:''}
        ${a.airing?`<span class="pr-card__air">ON AIR</span>`:''}
        ${opts.rank!=null?`<span class="pr-card__rank num">${String(opts.rank).padStart(2,'0')}</span>`:''}
        <span class="pr-card__play">PLAY</span>
      </span>
      <span class="pr-card__body">
        <b>${esc(t)}</b>
        <small>${bits.map(esc).join(' · ')}</small>
      </span>
    </a>`;
  },
};
