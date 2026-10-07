/* LAYOUT: STAGE — a television. Almost no chrome: one title at a time,
   full-bleed, with a filmstrip along the bottom and arrow-key navigation.
   Browsing is a sequence, not a grid. */
import { esc, attr, imgTag, genPoster, fmtCount } from '../util.js';
import { ICON, svg, displayTitle, genreChips, demoNotice } from '../components.js';

const NAV = [['home','Home','/'],['browse','Browse','/browse'],['schedule','Schedule','/schedule'],['library','Library','/library'],['settings','Settings','/settings']];

export default {
  id: 'stage',
  name: 'Stage',
  tagline: 'Cinematic, one at a time',
  blurb: 'Almost no interface. One title fills the screen, a filmstrip runs along the bottom, and arrow keys move through the catalogue. Browsing as a sequence rather than a grid.',
  theme: 'ink',
  thumb: `<svg viewBox="0 0 120 80"><rect width="120" height="80" fill="#07070a"/><rect x="0" y="0" width="120" height="62" fill="#1a1020"/><circle cx="92" cy="18" r="26" fill="#2d1b3d"/><rect x="8" y="26" width="46" height="9" fill="#f5f5f5"/><rect x="8" y="39" width="30" height="9" fill="#f5f5f5"/><rect x="8" y="53" width="18" height="4" fill="#e8b84b"/><rect x="100" y="4" width="7" height="4" rx="2" fill="#3a3a44"/><rect x="110" y="4" width="7" height="4" rx="2" fill="#3a3a44"/><g fill="#23232a"><rect x="6" y="66" width="14" height="10" rx="1"/><rect x="23" y="66" width="14" height="10" rx="1"/><rect x="40" y="65" width="16" height="12" rx="1" fill="#e8b84b"/><rect x="59" y="66" width="14" height="10" rx="1"/><rect x="76" y="66" width="14" height="10" rx="1"/><rect x="93" y="66" width="14" height="10" rx="1"/></g></svg>`,

  shell() {
    return `
    <div class="st-chrome" data-chrome>
      <a class="st-mark" href="#/">KITSU<i>/</i>LIVE</a>
      <div class="st-acts">
        <div class="st-search" data-searchbox>
          ${svg(ICON.search)}
          <input data-search type="search" placeholder="Search" aria-label="Search">
          <div class="suggest" data-suggest hidden></div>
        </div>
        <button class="st-ico" data-act="layout" title="Change design (D)">${svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>')}</button>
        <button class="st-ico" data-act="theme" title="Theme">${svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17Z" fill="currentColor" stroke="none"/>')}</button>
        <button class="st-ico" data-act="menu" title="Menu">${svg('<path d="M3 7h18M3 12h18M3 17h18"/>')}</button>
      </div>
    </div>
    <nav class="st-menu">
      <button class="st-menu__x" data-act="closemenu" aria-label="Close">${svg('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
      ${NAV.map(([k,l,h])=>`<a href="#${h}" data-nav="${k}" data-act="closemenu">${l}</a>`).join('')}
      <span class="st-menu__state" data-apistate></span>
    </nav>`;
  },

  foot() { return ''; },

  home(mount, d) {
    const reel = d.spotlight.concat(d.trending).filter((a, i, arr) => arr.findIndex((x) => x.id === a.id) === i).slice(0, 16);
    mount.innerHTML = `
      <div class="st-wrap">
        <div id="homeNotice" class="st-notice"></div>
        <div class="st-deck">
          ${reel.map((a, i) => {
            const t = displayTitle(a);
            return `<section class="st-slide ${i===0?'is-active':''}" data-i="${i}">
              <div class="st-slide__bg">${imgTag(a.banner||a.poster||genPoster(t),'',t,{ratio:'16/9',eager:i===0})}</div>
              <div class="st-slide__in">
                <p class="st-kick">${String(i+1).padStart(2,'0')} / ${String(reel.length).padStart(2,'0')}${a.airing?' · AIRING':''}</p>
                <h1>${esc(t)}</h1>
                <div class="st-meta">
                  ${a.score?`<b>★ ${a.score.toFixed(2)}</b>`:''}
                  <span>${esc(a.type||'')}</span>${a.episodes?`<span>${a.episodes} episodes</span>`:''}
                  ${a.year?`<span>${a.year}</span>`:''}${a.members?`<span>${fmtCount(a.members)} members</span>`:''}
                </div>
                <p class="st-syn">${esc((a.synopsis||'').slice(0,200))}${(a.synopsis||'').length>200?'…':''}</p>
                <div class="st-genres">${genreChips(a.genres,4)}</div>
                <div class="st-cta">
                  <a class="btn btn--primary" href="#/watch/${a.id}?ep=1">${svg(ICON.play)} Play</a>
                  <a class="btn btn--ghost" href="#/anime/${a.id}">Details</a>
                </div>
              </div>
            </section>`;
          }).join('')}
        </div>
        <button class="st-arrow st-arrow--prev" data-step="-1" aria-label="Previous">${svg(ICON.chevL)}</button>
        <button class="st-arrow st-arrow--next" data-step="1" aria-label="Next">${svg(ICON.chevR)}</button>
        <div class="st-strip">
          ${reel.map((a,i)=>{const t=displayTitle(a);
            return `<button class="st-frame ${i===0?'is-active':''}" data-go="${i}" aria-label="${attr(t)}">
              ${imgTag(a.poster||genPoster(t),'',t)}<span>${esc(t)}</span></button>`;}).join('')}
        </div>
      </div>`;
    if (d.demo) mount.querySelector('#homeNotice').innerHTML = demoNotice();

    const slides = [...mount.querySelectorAll('.st-slide')];
    const frames = [...mount.querySelectorAll('[data-go]')];
    let i = 0;
    const show = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s,k)=>s.classList.toggle('is-active',k===i));
      frames.forEach((f,k)=>{ f.classList.toggle('is-active',k===i); if(k===i) f.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'}); });
    };
    frames.forEach(f=>f.addEventListener('click',()=>show(+f.dataset.go)));
    mount.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>show(i + +b.dataset.step)));
    const onKey = (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); show(i+1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); show(i-1); }
    };
    window.addEventListener('keydown', onKey);
    return { destroy(){ window.removeEventListener('keydown', onKey); } };
  },

  card(a) {
    const t = displayTitle(a);
    return `<a class="st-card" href="#/anime/${a.id}">
      <span class="st-card__art">${imgTag(a.poster||genPoster(t),t,t)}
        <span class="st-card__glow"></span></span>
      <b>${esc(t)}</b><small>${esc(a.type||'')}${a.year?` · ${a.year}`:''}</small>
    </a>`;
  },
};
