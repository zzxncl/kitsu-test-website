/* LAYOUT: BROADSHEET — a newspaper. Centred masthead with a dateline, rules
   above and below, then multi-column text-forward listings: a lead story,
   column briefs with small thumbs, and a stacked sidebar. Images are small
   and serve the words, not the other way round. */
import { esc, attr, imgTag, genPoster, fmtCount, fmtDate } from '../util.js';
import { ICON, svg, displayTitle, demoNotice } from '../components.js';

const NAV = [['home','Front Page','/'],['browse','Archive','/browse'],['schedule','This Week','/schedule'],['library','My Clippings','/library'],['settings','Settings','/settings']];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default {
  id: 'broadsheet',
  name: 'Broadsheet',
  tagline: 'Newspaper, text-forward',
  blurb: 'A centred masthead with a dateline, then multi-column briefs with small thumbs and a stacked sidebar. Serif throughout. The writing leads; the pictures serve it.',
  theme: 'paper',
  thumb: `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#f6f2e9"/><rect x="0" y="12" width="120" height="1" fill="#2a251e"/><rect x="0" y="22" width="120" height="1" fill="#2a251e"/><rect x="30" y="3" width="60" height="7" fill="#1a1510"/><rect x="8" y="16" width="14" height="3" fill="#6b6155"/><rect x="30" y="16" width="14" height="3" fill="#6b6155"/><rect x="52" y="16" width="14" height="3" fill="#6b6155"/><rect x="6" y="28" width="52" height="5" fill="#1a1510"/><rect x="6" y="36" width="44" height="5" fill="#1a1510"/><g fill="#8c8273"><rect x="6" y="46" width="52" height="2"/><rect x="6" y="51" width="52" height="2"/><rect x="6" y="56" width="48" height="2"/><rect x="6" y="61" width="52" height="2"/><rect x="6" y="66" width="30" height="2"/></g><rect x="63" y="28" width="1" height="46" fill="#cfc6b6"/><g fill="#8c8273"><rect x="69" y="28" width="30" height="2"/><rect x="69" y="33" width="30" height="2"/><rect x="69" y="38" width="22" height="2"/></g><rect x="103" y="28" width="12" height="16" fill="#d9d0bf"/><g fill="#8c8273"><rect x="69" y="48" width="46" height="2"/><rect x="69" y="53" width="46" height="2"/><rect x="69" y="58" width="36" height="2"/><rect x="69" y="63" width="46" height="2"/></g></svg>`,

  shell() {
    const d = new Date();
    const line = `${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
    return `
    <header class="bs-mast" data-chrome>
      <div class="bs-mast__rule"><span>Vol. I</span><span data-apistate></span><span>No. ${String(d.getDate()).padStart(2,'0')}</span></div>
      <a class="bs-mast__name" href="#/">The Kitsu Review</a>
      <p class="bs-mast__line">${esc(line)} — an independent register of animation</p>
      <nav class="bs-nav">
        ${NAV.map(([k,l,h])=>`<a href="#${h}" data-nav="${k}">${l}</a>`).join('')}
        <span class="bs-nav__sp"></span>
        <button data-act="layout">Change design</button>
        <button data-act="theme">Invert</button>
      </nav>
      <div class="bs-search" data-searchbox>
        <input data-search type="search" placeholder="Search the archive…" aria-label="Search">
        <div class="suggest" data-suggest hidden></div>
      </div>
      <div class="topbar__progress" id="loadBar" aria-hidden="true"></div>
    </header>`;
  },

  foot() {
    return `<footer class="bs-foot">
      <p>THE KITSU REVIEW · Printed on demand, in your browser.</p>
      <p>Metadata from Jikan (MyAnimeList). No video is hosted here. Not affiliated with any studio or service.</p>
    </footer>`;
  },

  home(mount, d) {
    const lead = d.spotlight[0];
    const seconds = d.spotlight.slice(1, 4);
    const lt = lead ? displayTitle(lead) : '';
    const brief = (a) => {
      const t = displayTitle(a);
      return `<a class="bs-brief" href="#/anime/${a.id}">
        <span class="bs-brief__thumb">${imgTag(a.poster||genPoster(t),'',t)}</span>
        <span class="bs-brief__txt">
          <b>${esc(t)}</b>
          <small>${esc(a.type||'')}${a.episodes?` · ${a.episodes} ep`:''}${a.year?` · ${a.year}`:''}${a.score?` · ★${a.score.toFixed(2)}`:''}</small>
          <em>${esc((a.synopsis||'').slice(0,110))}${(a.synopsis||'').length>110?'…':''}</em>
        </span></a>`;
    };

    mount.innerHTML = `
      <div class="bs-page">
        <div id="homeNotice"></div>
        <div class="bs-cols">
          <article class="bs-lead">
            ${lead ? `
              <p class="bs-kicker">${lead.airing?'Now Broadcasting':'Of Note'}</p>
              <h1>${esc(lt)}</h1>
              <p class="bs-standfirst">${esc((lead.synopsis||'').slice(0,240))}${(lead.synopsis||'').length>240?'…':''}</p>
              <div class="bs-lead__art">${imgTag(lead.banner||lead.poster||genPoster(lt),'',lt,{ratio:'16/9',eager:true})}
                <span class="bs-caption">${esc(lt)}${lead.studios?.length?` — ${esc(lead.studios[0])}`:''}</span></div>
              <p class="bs-body">${esc((lead.synopsis||'').slice(240,620))}</p>
              <p class="bs-byline">
                ${lead.score?`Rated <b>${lead.score.toFixed(2)}</b> by ${fmtCount(lead.scoredBy)} readers. `:''}
                ${lead.episodes?`${lead.episodes} episodes. `:''}${lead.aired?esc(lead.aired):''}
              </p>
              <div class="bs-cta">
                <a class="btn btn--primary" href="#/watch/${lead.id}?ep=1">Read on — watch</a>
                <a class="btn btn--ghost" href="#/anime/${lead.id}">Full entry</a>
              </div>
            ` : ''}
            <hr class="bs-hr">
            <h3 class="bs-subhead">Also in this issue</h3>
            <div class="bs-twocol">${seconds.map(brief).join('')}</div>
          </article>

          <aside class="bs-side">
            <section><h3 class="bs-subhead">The Standings</h3>
              <ol class="bs-rank">${d.allTime.slice(0,10).map((a,i)=>`
                <li><a href="#/anime/${a.id}"><i>${i+1}</i><span>${esc(displayTitle(a))}</span><b>${a.score?a.score.toFixed(2):'—'}</b></a></li>`).join('')}
              </ol></section>
            <section><h3 class="bs-subhead">Latest Despatches</h3>
              <div class="bs-briefs">${d.recent.slice(0,6).map(r=>brief(r.anime)).join('')}</div></section>
            ${d.resume.length?`<section><h3 class="bs-subhead">Where You Left Off</h3>
              <div class="bs-briefs">${d.resume.slice(0,4).map(r=>{
                const a=r.anime||{};const t=displayTitle(a);
                return `<a class="bs-brief" href="#/watch/${a.id}?ep=${r.nextEp}">
                  <span class="bs-brief__thumb">${imgTag(a.poster||genPoster(t),'',t)}</span>
                  <span class="bs-brief__txt"><b>${esc(t)}</b><small>Episode ${r.nextEp}</small></span></a>`;}).join('')}
              </div></section>`:''}
          </aside>
        </div>

        <hr class="bs-hr">
        <h3 class="bs-subhead bs-subhead--wide">The Season in Full</h3>
        <div class="bs-fourcol">${d.season.slice(0,12).map(brief).join('')}</div>

        <hr class="bs-hr">
        <h3 class="bs-subhead bs-subhead--wide">Popular This Week</h3>
        <div class="bs-fourcol">${d.topRated.slice(0,12).map(brief).join('')}</div>

        <hr class="bs-hr">
        <h3 class="bs-subhead bs-subhead--wide">Classified — by subject</h3>
        <p class="bs-tags">${d.genres.slice(0,22).map(g=>`<a href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`).join(' · ')}</p>
      </div>`;
    if (d.demo) mount.querySelector('#homeNotice').innerHTML = demoNotice();
  },

  card(a) {
    const t = displayTitle(a);
    return `<a class="bs-card" href="#/anime/${a.id}">
      <span class="bs-card__art">${imgTag(a.poster||genPoster(t),t,t)}</span>
      <b>${esc(t)}</b>
      <small>${esc(a.type||'')}${a.year?` · ${a.year}`:''}${a.score?` · ★${a.score.toFixed(2)}`:''}</small>
    </a>`;
  },
};
