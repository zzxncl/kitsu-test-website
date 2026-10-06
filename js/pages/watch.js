/* Kitsu Live — watch page: player + episode sidebar + server switcher. */
import { CONFIG, guessType } from '../config.js';
import { api } from '../api.js';
import {
  getSettings, setSetting, seenEpisodes, getProgress, markEpisode,
  onStoreChange, addToList, inList, removeFromList, lastWatchedEp,
} from '../store.js';
import { createPlayer } from '../player.js';
import { cardHTML, railHTML, bindRails, ICON, svg, displayTitle, emptyState } from '../components.js';
import { $, $$, esc, attr, setMeta, fmtTime, scrollTop, imgTag, genPoster } from '../util.js';
import { go, buildQuery } from '../router.js';
import { toast } from '../toast.js';

export default async function watch({ mount, params, query }) {
  const id = params.id;
  const ep = Math.max(1, Number(query.ep) || 1);
  const startAt = Number(query.t) || 0;

  mount.innerHTML = `<div class="watch"><div class="watch__main">
    <div class="sk sk--wide"></div><div class="sk sk--line w60" style="height:1.4rem"></div>
  </div><div class="watch__side"><div class="sk" style="height:420px"></div></div></div>`;

  const a = await api.anime(id);
  if (!a) {
    mount.innerHTML = emptyState('Not found', `No anime with id ${id}.`, '<a class="btn btn--ghost" href="#/browse">Browse</a>');
    return;
  }

  const epRes = await api.episodes(a.id, 1);
  let episodes = epRes.items;
  if (!episodes.length) {
    const n = a.episodes || 12;
    episodes = Array.from({ length: n }, (_, i) => ({ num: i + 1, title: `Episode ${i + 1}` }));
  }
  const epMeta = episodes.find((e) => e.num === ep) || { num: ep, title: `Episode ${ep}` };
  const idx = episodes.findIndex((e) => e.num === ep);
  const prevEp = idx > 0 ? episodes[idx - 1].num : null;
  const nextEp = idx >= 0 && idx < episodes.length - 1 ? episodes[idx + 1].num : null;

  const title = displayTitle(a);
  setMeta(`${title} · Episode ${ep}`, a.synopsis);
  scrollTop(false);

  const s = getSettings();
  let serverId = s.server || CONFIG.servers[0].id;
  let dub = !!s.preferDub;
  let customUrl = sessionStorage.getItem('kitsulive:customUrl') || '';

  mount.innerHTML = `
    <div class="watch">
      <div class="watch__main">
        <nav class="watch__crumbs">
          <a href="#/">Home</a>${svg(ICON.chevR)}
          <a href="#/anime/${a.id}">${esc(title)}</a>${svg(ICON.chevR)}
          <span>Episode ${ep}</span>
        </nav>

        <div id="playerMount"></div>

        <div class="srvbar">
          <span class="srvbar__label">Audio</span>
          <div class="srvbar__group">
            <button class="srvbtn ${!dub ? 'is-on' : ''}" data-dub="sub">Sub</button>
            <button class="srvbtn ${dub ? 'is-on' : ''}" data-dub="dub">Dub</button>
          </div>
          <span class="srvbar__label" style="margin-left:.6rem">Server</span>
          <div class="srvbar__group">
            ${CONFIG.servers.map((sv) => `<button class="srvbtn ${sv.id === serverId ? 'is-on' : ''}"
              data-server="${attr(sv.id)}" title="${attr(sv.note || '')}">${esc(sv.label)}</button>`).join('')}
          </div>
          <span class="spacer"></span>
          <button class="btn btn--quiet btn--sm" id="reportBtn">${svg(ICON.info)} Source help</button>
        </div>

        <div id="customRow" ${serverId === 'custom' ? '' : 'hidden'} style="display:flex;gap:.5rem;align-items:center">
          <input class="input" id="customUrl" placeholder="https://…/stream.m3u8 or .mp4" value="${attr(customUrl)}">
          <button class="btn btn--primary btn--sm" id="customGo">Load</button>
        </div>

        <div class="watch__titlebar">
          <div>
            <h1>${esc(epMeta.title || `Episode ${ep}`)}</h1>
            <p>${esc(title)} · Episode ${ep}${episodes.length ? ` of ${episodes.length}` : ''}${epMeta.filler ? ' · filler' : ''}</p>
          </div>
          <div class="watch__titleacts">
            <button class="btn btn--ghost btn--sm" id="markBtn"></button>
            <button class="btn btn--ghost btn--sm" id="libBtn"></button>
            <a class="btn btn--ghost btn--sm" href="#/anime/${a.id}">${svg(ICON.info)} Series</a>
          </div>
        </div>

        <div class="panel">
          <h3>About this series</h3>
          <p class="synopsis" style="font-size:.88rem">${esc((a.synopsis || 'No synopsis available.').slice(0, 600))}${(a.synopsis || '').length > 600 ? '…' : ''}</p>
        </div>
      </div>

      <aside class="watch__side">
        <div class="panel">
          <h3>Episodes <span class="chip" style="margin-left:auto">${episodes.length}</span></h3>
          <div class="epnav">
            <input class="input" id="epFilter" placeholder="Jump to episode…" inputmode="numeric">
            <button class="btn btn--ghost btn--sm" id="epSort" title="Reverse order">${svg(ICON.shuffle)}</button>
          </div>
          <div class="eplist eplist--side" id="epSide"></div>
        </div>
        <div class="panel">
          <h3>Next up</h3>
          <div id="nextUp"></div>
        </div>
      </aside>
    </div>
    <div id="recoHost"></div>`;

  /* ── player ────────────────────────────────────────── */
  const ctx = {
    animeId: a.id, anime: a, episode: ep, prevEp, nextEp, startAt,
    onNext: (n) => n && go(`/watch/${a.id}${buildQuery({ ep: n })}`),
    onPrev: (n) => n && go(`/watch/${a.id}${buildQuery({ ep: n })}`),
    onTheater: (on) => document.documentElement.classList.toggle('is-theater', on),
  };
  const player = createPlayer($('#playerMount', mount), ctx);

  async function applySource() {
    const sv = CONFIG.servers.find((x) => x.id === serverId) || CONFIG.servers[0];
    let src = null;
    try {
      src = await sv.resolve({ malId: a.id, title: a.title, episode: ep, dub, custom: customUrl });
    } catch (err) {
      toast(`Server "${sv.label}" failed: ${err.message}`, 'bad');
    }
    player.load(src);
  }
  applySource();

  /* ── audio + server switches ───────────────────────── */
  mount.addEventListener('click', (e) => {
    const d = e.target.closest('[data-dub]');
    const sv = e.target.closest('[data-server]');
    if (d) {
      dub = d.dataset.dub === 'dub';
      setSetting('preferDub', dub);
      $$('[data-dub]', mount).forEach((b) => b.classList.toggle('is-on', (b.dataset.dub === 'dub') === dub));
      applySource();
    }
    if (sv) {
      serverId = sv.dataset.server;
      setSetting('server', serverId);
      $$('[data-server]', mount).forEach((b) => b.classList.toggle('is-on', b.dataset.server === serverId));
      $('#customRow', mount).hidden = serverId !== 'custom';
      applySource();
    }
  });
  $('#customGo', mount).addEventListener('click', () => {
    customUrl = $('#customUrl', mount).value.trim();
    sessionStorage.setItem('kitsulive:customUrl', customUrl);
    if (!customUrl) { toast('Paste a direct video URL first.', 'bad'); return; }
    serverId = 'custom';
    setSetting('server', 'custom');
    $$('[data-server]', mount).forEach((b) => b.classList.toggle('is-on', b.dataset.server === 'custom'));
    applySource();
  });
  $('#reportBtn', mount).addEventListener('click', () => {
    toast('Kitsu Live ships no video. Wire a resolver in js/config.js, or paste a direct URL under the Custom server.', 'info', 7000);
  });

  /* ── episode sidebar ───────────────────────────────── */
  let reversed = false;
  function renderSide(filter = '') {
    const seen = seenEpisodes(a.id);
    let rows = episodes.filter((e) =>
      !filter || String(e.num).includes(filter) || (e.title || '').toLowerCase().includes(filter.toLowerCase()));
    if (reversed) rows = [...rows].reverse();
    $('#epSide', mount).innerHTML = rows.map((e) => {
      const p = getProgress(a.id, e.num);
      const pct = p?.duration > 0 ? Math.min(100, (p.position / p.duration) * 100) : 0;
      return `<a class="eprow eprow--side ${e.num === ep ? 'is-active' : ''} ${seen.has(e.num) ? 'is-seen' : ''} ${e.filler ? 'is-filler' : ''}"
        href="#/watch/${a.id}?ep=${e.num}">
        <span class="eprow__n">${e.num}</span>
        <span class="eprow__wrap">
          <span class="eprow__t">${esc(e.title || `Episode ${e.num}`)}</span>
          <span class="eprow__sub">
            ${seen.has(e.num) ? `<span style="color:var(--ok)">watched</span>` : (pct > 1 ? `${Math.round(pct)}%` : '')}
            ${e.filler ? '· filler' : ''}
          </span>
          ${pct > 1 && !seen.has(e.num) ? `<span class="progress eprow__bar"><span style="width:${pct}%"></span></span>` : ''}
        </span>
      </a>`;
    }).join('') || `<p style="color:var(--fg-3);font-size:.85rem;padding:.5rem">No episode matches that.</p>`;

    const active = $('.eprow--side.is-active', mount);
    active?.scrollIntoView({ block: 'nearest' });
  }
  renderSide();
  $('#epFilter', mount).addEventListener('input', (e) => renderSide(e.target.value.trim()));
  $('#epSort', mount).addEventListener('click', () => { reversed = !reversed; renderSide($('#epFilter', mount).value.trim()); });

  /* ── next-up panel ─────────────────────────────────── */
  $('#nextUp', mount).innerHTML = nextEp
    ? `<a class="ecard" href="#/watch/${a.id}?ep=${nextEp}">
        <div class="ecard__art">${imgTag(a.poster || genPoster(title), title, title, { ratio: '16/9' })}
          <span class="ecard__pill">EP ${nextEp}</span><span class="card__play">${svg(ICON.play)}</span></div>
        <div class="ecard__body"><h3 class="ecard__title">${esc(episodes[idx + 1]?.title || `Episode ${nextEp}`)}</h3>
        <p class="ecard__sub">Episode ${nextEp}</p></div></a>`
    : `<p style="color:var(--fg-3);font-size:.85rem">That's the last episode on file.${a.airing ? ' More are still airing.' : ''}</p>`;

  /* ── mark / library buttons ────────────────────────── */
  function renderBtns() {
    const seen = seenEpisodes(a.id);
    const done = seen.has(ep);
    $('#markBtn', mount).innerHTML = done
      ? `${svg(ICON.check)} Watched`
      : `${svg(ICON.check)} Mark watched`;
    $('#markBtn', mount).classList.toggle('btn--primary', false);
    $('#libBtn', mount).innerHTML = inList(a.id)
      ? `${svg(ICON.check)} In library`
      : `${svg(ICON.plus)} Add to library`;
  }
  $('#markBtn', mount).addEventListener('click', () => {
    const done = seenEpisodes(a.id).has(ep);
    markEpisode(a.id, ep, !done, a);
    toast(done ? `Episode ${ep} unmarked` : `Episode ${ep} marked watched`, 'ok');
  });
  $('#libBtn', mount).addEventListener('click', () => {
    if (inList(a.id)) { removeFromList(a.id); toast('Removed from library'); }
    else { addToList(a, 'watching'); toast('Added to library as watching', 'ok'); }
  });
  renderBtns();

  const offStore = onStoreChange((what) => {
    if (what === 'progress' || what === 'list' || what === 'all') { renderBtns(); renderSide($('#epFilter', mount)?.value.trim() || ''); }
  });

  /* ── recommendations ───────────────────────────────── */
  api.recommendations(a.id, 18).then((recs) => {
    const host = $('#recoHost', mount);
    if (!host || !recs.length) return;
    host.innerHTML = railHTML('Because you watched this', recs.map((r) => cardHTML(r)).join(''), { icon: ICON.heart });
    bindRails(host);
  });

  return {
    destroy() {
      player.destroy();
      offStore();
      document.documentElement.classList.remove('is-theater');
    },
  };
}
