/* LAYOUT: TERMINAL — a console. No nav bar: a prompt line is the navigation,
   and the catalogue is a dense monospace table rather than a wall of posters.
   Thumbnails are 1:1 and tiny. Built for scanning, not browsing. */
import { esc, attr, imgTag, genPoster, fmtCount, fmtTime } from '../util.js';
import { ICON, svg, displayTitle, demoNotice } from '../components.js';

const CMDS = [['home','~','/'],['browse','search','/browse'],['schedule','week','/schedule'],['library','shelf','/library'],['settings','config','/settings']];

export default {
  id: 'terminal',
  name: 'Terminal',
  tagline: 'Console, dense table',
  blurb: 'No navigation bar — a prompt line is the navigation. The catalogue is a dense monospace table with tiny square thumbs. Built for scanning a hundred titles, not admiring twelve.',
  theme: 'ink',
  thumb: `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#05070a"/><rect x="0" y="0" width="120" height="10" fill="#0a0f14"/><text x="4" y="7.5" font-family="monospace" font-size="6" fill="#3ddc84">kitsu://_</text><g font-family="monospace" font-size="4.6" fill="#3ddc84"><text x="4" y="20">## TRENDING</text></g><g fill="#1a2630"><rect x="4" y="25" width="5" height="5"/><rect x="4" y="33" width="5" height="5"/><rect x="4" y="41" width="5" height="5"/><rect x="4" y="49" width="5" height="5"/><rect x="4" y="57" width="5" height="5"/><rect x="4" y="65" width="5" height="5"/></g><g fill="#7d8c99"><rect x="12" y="27" width="46" height="2"/><rect x="12" y="35" width="38" height="2"/><rect x="12" y="43" width="52" height="2"/><rect x="12" y="51" width="34" height="2"/><rect x="12" y="59" width="44" height="2"/><rect x="12" y="67" width="40" height="2"/></g><g fill="#3ddc84"><rect x="98" y="27" width="16" height="2"/><rect x="98" y="35" width="16" height="2"/><rect x="98" y="43" width="16" height="2"/><rect x="98" y="51" width="16" height="2"/><rect x="98" y="59" width="16" height="2"/><rect x="98" y="67" width="16" height="2"/></g></svg>`,

  shell() {
    return `
    <header class="tm-bar" data-chrome>
      <div class="tm-prompt" data-searchbox>
        <span class="tm-host">kitsu</span><span class="tm-sep">://</span>
        <input data-search type="search" placeholder="type to search — or pick a route below" aria-label="Search" spellcheck="false">
        <span class="tm-caret">▋</span>
        <div class="suggest" data-suggest hidden></div>
      </div>
      <div class="tm-routes">
        ${CMDS.map(([k,l,h])=>`<a href="#${h}" data-nav="${k}"><span>cd</span> ${l}</a>`).join('')}
        <button data-act="random"><span>run</span> random</button>
        <button data-act="layout"><span>set</span> design</button>
        <button data-act="theme"><span>set</span> theme</button>
        <span class="tm-state" data-apistate></span>
      </div>
      <div class="topbar__progress" id="loadBar" aria-hidden="true"></div>
    </header>`;
  },

  foot() {
    return `<footer class="tm-foot"><span>EOF</span> — metadata: jikan/mal · video: none hosted · storage: localStorage</footer>`;
  },

  home(mount, d) {
    const table = (items, start = 1) => `
      <div class="tm-table">
        <div class="tm-row tm-row--head">
          <span class="tm-c-n">#</span><span class="tm-c-art"></span><span class="tm-c-t">title</span>
          <span class="tm-c-s">score</span><span class="tm-c-ty">type</span>
          <span class="tm-c-e">eps</span><span class="tm-c-y">year</span><span class="tm-c-st">status</span>
        </div>
        ${items.map((a, i) => {
          const t = displayTitle(a);
          return `<a class="tm-row" href="#/anime/${a.id}">
            <span class="tm-c-n">${String(start + i).padStart(3,'0')}</span>
            <span class="tm-c-art">${imgTag(a.poster||genPoster(t),'',t)}</span>
            <span class="tm-c-t">${esc(t)}</span>
            <span class="tm-c-s">${a.score?a.score.toFixed(2):'  --'}</span>
            <span class="tm-c-ty">${esc((a.type||'?').toLowerCase())}</span>
            <span class="tm-c-e">${a.episodes??'--'}</span>
            <span class="tm-c-y">${a.year??'----'}</span>
            <span class="tm-c-st ${a.airing?'is-air':''}">${a.airing?'airing':esc((a.status||'').toLowerCase().split(' ')[0]||'--')}</span>
          </a>`;
        }).join('')}
      </div>`;
    const heading = (txt, note) => `<h2 class="tm-h"><span>##</span> ${esc(txt)}${note?`<em>// ${esc(note)}</em>`:''}</h2>`;

    mount.innerHTML = `
      <div class="tm-page">
        <div id="homeNotice"></div>
        <pre class="tm-banner">  _  _____ _____ ____  _   _
 | |/ /_ _|_   _/ ___|| | | |   kitsu/live
 | ' / | |  | | \\___ \\| | | |   an anime index
 | . \\ | |  | |  ___) | |_| |   ${d.trending.length + d.season.length} records loaded
 |_|\\_\\___| |_| |____/ \\___/    type / to search</pre>

        ${d.resume.length ? `${heading('resume','unfinished episodes')}
          <div class="tm-table">${d.resume.slice(0,6).map((r)=>{
            const a=r.anime||{};const t=displayTitle(a);
            return `<a class="tm-row" href="#/watch/${a.id}?ep=${r.nextEp}${r.resumeAt?`&t=${Math.floor(r.resumeAt)}`:''}">
              <span class="tm-c-n">ep${String(r.nextEp).padStart(2,'0')}</span>
              <span class="tm-c-art">${imgTag(a.poster||genPoster(t),'',t)}</span>
              <span class="tm-c-t">${esc(t)}</span>
              <span class="tm-c-s">${(r.pct||0).toFixed(0)}%</span>
              <span class="tm-c-ty">${r.done?'done':'partial'}</span>
              <span class="tm-c-e">${fmtTime(r.position)}</span>
              <span class="tm-c-y"></span><span class="tm-c-st is-air">resume</span></a>`;
          }).join('')}</div>` : ''}

        ${heading('trending', 'sorted by members, desc')}
        ${table(d.trending, 1)}
        ${heading('season', 'currently airing')}
        ${table(d.season.slice(0,16), 1)}
        ${heading('top', 'highest rated, all time')}
        ${table(d.allTime, 1)}
        ${heading('films')}
        ${table(d.movies.slice(0,12), 1)}
        ${heading('genres', `${d.genres.length} tags`)}
        <p class="tm-tags">${d.genres.slice(0,24).map(g=>`<a href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name.toLowerCase())}</a>`).join(' ')}</p>
      </div>`;
    if (d.demo) mount.querySelector('#homeNotice').innerHTML = demoNotice();
  },

  card(a) {
    const t = displayTitle(a);
    return `<a class="tm-card" href="#/anime/${a.id}">
      <span class="tm-card__art">${imgTag(a.poster||genPoster(t),t,t)}</span>
      <span class="tm-card__t">${esc(t)}</span>
      <span class="tm-card__m">${a.score?a.score.toFixed(2):'--'} · ${esc((a.type||'?').toLowerCase())}${a.year?` · ${a.year}`:''}</span>
    </a>`;
  },
};
