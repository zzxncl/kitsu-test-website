/* Kitsu Live — anime detail page. */
import { api } from '../api.js';
import {
  inList, listStatus, addToList, removeFromList, LIST_STATUS,
  lastWatchedEp, seenEpisodes, onStoreChange, markEpisode, clearProgress,
} from '../store.js';
import {
  railHTML, bindRails, epGridHTML, starsHTML, genreChips,
  ICON, svg, displayTitle, emptyState,
} from '../components.js';
import { current } from '../layouts/index.js';
import { $, $$, esc, attr, imgTag, genPoster, setMeta, fmtCount, fmtDate, scrollTop } from '../util.js';
import { toast } from '../toast.js';

export default async function info({ mount, params }) {
  const id = params.id;
  mount.innerHTML = `
    <div class="info-banner"><div class="sk sk--block" style="height:100%"></div></div>
    <div class="info-top">
      <div class="sk sk--poster"></div>
      <div style="display:grid;gap:.7rem">
        <div class="sk sk--line w60" style="height:2.2rem"></div>
        <div class="sk sk--line w40"></div><div class="sk sk--line w80"></div>
      </div>
    </div>
    <div class="info-grid"><div><div class="sk" style="height:240px"></div></div><div><div class="sk" style="height:320px"></div></div></div>`;

  let a;
  try {
    a = await api.anime(id);
  } catch (err) {
    mount.innerHTML = emptyState('Not found', `No anime with id ${id}.`, '<a class="btn btn--ghost" href="#/browse">Browse instead</a>');
    return;
  }
  if (!a) {
    mount.innerHTML = emptyState('Not found', `No anime with id ${id}.`, '<a class="btn btn--ghost" href="#/browse">Browse instead</a>');
    return;
  }

  const title = displayTitle(a);
  setMeta(title, a.synopsis);
  scrollTop(false);

  const last = lastWatchedEp(a.id);
  const resumeEp = last ? (last.done ? last.ep + 1 : last.ep) : 1;
  const resumeT = last && !last.done ? Math.floor(last.position) : 0;

  mount.innerHTML = `
    <div class="info-banner">
      ${a.banner || a.poster
        ? imgTag(a.banner || a.poster, '', title, { ratio: '16/9', eager: true })
        : '<div class="info-banner__fade"></div>'}
    </div>

    <div class="info-top">
      <div class="info-poster">${imgTag(a.poster || genPoster(title), title, title, { eager: true })}</div>
      <div class="info-head">
        <h1>${esc(title)}</h1>
        ${a.titleEn && a.titleEn !== title ? `<p class="alt">${esc(a.titleEn)}</p>` : ''}
        ${a.titleJp ? `<p class="alt">${esc(a.titleJp)}</p>` : ''}
        <div class="info-metarow">
          ${a.score ? `<span class="chip chip--score">${svg(ICON.star)}${a.score.toFixed(2)}</span>` : ''}
          ${a.rank ? `<span class="chip">#${a.rank} ranked</span>` : ''}
          <span class="chip chip--ghost">${esc(a.type)}</span>
          ${a.episodes ? `<span class="chip chip--ghost">${a.episodes} episodes</span>` : ''}
          ${a.airing ? `<span class="chip chip--live"><span class="dot dot--pulse"></span>Airing</span>` : `<span class="chip chip--ghost">${esc(a.status)}</span>`}
          ${a.year ? `<span class="chip chip--ghost">${a.year}${a.season ? ` · ${esc(a.season)}` : ''}</span>` : ''}
          ${a.rating ? `<span class="chip chip--ghost">${esc(a.rating.split(' ')[0])}</span>` : ''}
        </div>
        <div class="hero__genres">${genreChips(a.genres, 8)}</div>
        <div class="info-actions">
          <a class="btn btn--primary" href="#/watch/${a.id}?ep=${resumeEp}${resumeT ? `&t=${resumeT}` : ''}">
            ${svg(ICON.play)} ${last ? (last.done ? `Play episode ${resumeEp}` : `Resume episode ${resumeEp}`) : 'Start watching'}
          </a>
          <button class="btn btn--ghost" id="listBtn"></button>
          <div style="position:relative" id="statusWrap"></div>
          ${a.trailer ? `<a class="btn btn--ghost" target="_blank" rel="noopener"
             href="https://www.youtube.com/watch?v=${attr(a.trailer)}">${svg(ICON.external)} Trailer</a>` : ''}
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="panel">
          <h2>Synopsis</h2>
          <p class="synopsis is-clamped" id="syn">${esc(a.synopsis || 'No synopsis on file for this title yet.')}</p>
          ${(a.synopsis || '').length > 420 ? '<button class="read-more" id="moreSyn">Read more ↓</button>' : ''}
          ${a.background ? `<h3 style="margin-top:1.2rem">Background</h3><p class="synopsis">${esc(a.background)}</p>` : ''}
        </div>

        <div class="panel" id="epPanel">
          <h2>${svg(ICON.film)} Episodes</h2>
          <div id="epBody"><div class="sk" style="height:120px"></div></div>
        </div>

        <div class="panel" id="charPanel">
          <h2>${svg(ICON.users)} Characters</h2>
          <div id="charBody"><div class="sk" style="height:120px"></div></div>
        </div>

        ${a.relations.length ? `<div class="panel">
          <h2>Related</h2>
          <div class="statlist">
            ${a.relations.map((r) => `<div>
              <span class="statlist__k">${esc(r.relation)}</span>
              <span class="statlist__v">${r.entries.map((e) => `<a href="#/anime/${e.id}" style="color:var(--accent)">${esc(e.title)}</a>`).join(', ')}</span>
            </div>`).join('')}
          </div>
        </div>` : ''}
      </div>

      <aside>
        <div class="panel">
          ${a.score ? `<div class="scorebox">
            <div><div class="scorebox__big">${a.score.toFixed(2)}</div>
              ${starsHTML(a.score)}
              <small style="color:var(--fg-3);font-size:.76rem">${fmtCount(a.scoredBy)} ratings</small>
            </div>
          </div><hr style="border:0;border-top:1px solid var(--line);margin:.9rem 0">` : ''}
          <div class="statlist">
            ${row('Format', a.type)}
            ${row('Episodes', a.episodes ?? 'Unknown')}
            ${row('Duration', a.duration)}
            ${row('Status', a.status)}
            ${row('Aired', a.aired)}
            ${row('Season', a.season ? `${a.season} ${a.year}` : (a.year || '—'))}
            ${row('Broadcast', a.broadcast)}
            ${row('Source', a.source)}
            ${row('Studio', a.studios.join(', '))}
            ${row('Producers', a.producers.slice(0, 4).join(', '))}
            ${row('Rating', a.rating)}
            ${row('Rank', a.rank ? `#${a.rank}` : '—')}
            ${row('Popularity', a.popularity ? `#${a.popularity}` : '—')}
            ${row('Members', fmtCount(a.members))}
            ${row('Favorites', fmtCount(a.favorites))}
          </div>
        </div>

        ${a.genres.length ? `<div class="panel"><h3>Tags</h3>
          <div class="hero__genres">${genreChips(a.genres, 20)}</div></div>` : ''}

        ${a.external.length ? `<div class="panel"><h3>Elsewhere</h3>
          <div class="statlist">${a.external.slice(0, 8).map((e) =>
            `<div><span class="statlist__k">${esc(e.name)}</span>
             <span class="statlist__v"><a href="${attr(e.url)}" target="_blank" rel="noopener" style="color:var(--accent)">Open ${svg(ICON.external)}</a></span></div>`).join('')}
          </div></div>` : ''}

        <div class="panel"><h3>Your progress</h3>
          <div id="progPanel"></div>
        </div>
      </aside>
    </div>

    <div id="recoHost"></div>`;

  /* ── synopsis expand ───────────────────────────────── */
  $('#moreSyn', mount)?.addEventListener('click', (e) => {
    const syn = $('#syn', mount);
    syn.classList.toggle('is-clamped');
    e.target.textContent = syn.classList.contains('is-clamped') ? 'Read more ↓' : 'Show less ↑';
  });

  /* ── watchlist controls ────────────────────────────── */
  function renderListBtn() {
    const btn = $('#listBtn', mount);
    const on = inList(a.id);
    const st = listStatus(a.id);
    btn.innerHTML = on
      ? `${svg(ICON.check)} ${esc(LIST_STATUS.find((s) => s.id === st)?.label || 'In library')}`
      : `${svg(ICON.plus)} Add to library`;
    btn.classList.toggle('btn--primary', false);

    const wrap = $('#statusWrap', mount);
    wrap.innerHTML = on ? `
      <select class="select" id="statusSel" aria-label="List status" style="height:38px">
        ${LIST_STATUS.map((s) => `<option value="${s.id}" ${st === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
        <option value="__remove">Remove from library</option>
      </select>` : '';
    $('#statusSel', mount)?.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === '__remove') { removeFromList(a.id); toast('Removed from your library'); }
      else { addToList(a, v); toast(`Marked as ${LIST_STATUS.find((s) => s.id === v)?.label.toLowerCase()}`, 'ok'); }
    });
  }
  $('#listBtn', mount).addEventListener('click', () => {
    if (inList(a.id)) { removeFromList(a.id); toast('Removed from your library'); }
    else { addToList(a, 'planned'); toast('Added to your library', 'ok'); }
  });
  renderListBtn();

  /* ── progress panel ────────────────────────────────── */
  function renderProgress() {
    const host = $('#progPanel', mount);
    const seen = seenEpisodes(a.id);
    const total = a.episodes || 0;
    const pct = total ? Math.min(100, (seen.size / total) * 100) : 0;
    const lw = lastWatchedEp(a.id);
    host.innerHTML = `
      ${total ? `<div class="progress" style="height:6px;margin-bottom:.6rem"><span style="width:${pct.toFixed(1)}%"></span></div>` : ''}
      <p style="font-size:.85rem;color:var(--fg-2)">
        ${seen.size ? `${seen.size}${total ? ` of ${total}` : ''} episodes watched` : 'Nothing watched yet'}
      </p>
      ${lw ? `<p style="font-size:.8rem;color:var(--fg-3);margin-top:.2rem">Last: episode ${lw.ep}</p>` : ''}
      <div style="display:flex;gap:.4rem;margin-top:.8rem;flex-wrap:wrap">
        ${total ? `<button class="btn btn--ghost btn--sm" id="markAll">Mark all watched</button>` : ''}
        ${seen.size ? `<button class="btn btn--danger btn--sm" id="clearProg">${svg(ICON.trash)} Reset</button>` : ''}
      </div>`;
    $('#markAll', mount)?.addEventListener('click', () => {
      for (let i = 1; i <= a.episodes; i++) markEpisode(a.id, i, true, a);
      addToList(a, 'completed');
      toast('Marked the whole run as watched', 'ok');
    });
    $('#clearProg', mount)?.addEventListener('click', () => {
      clearProgress(a.id);
      toast('Progress cleared');
    });
  }
  renderProgress();

  const offStore = onStoreChange((what) => {
    if (what === 'list' || what === 'all') renderListBtn();
    if (what === 'progress' || what === 'all') { renderProgress(); renderEpisodes(); }
  });

  /* ── episodes ──────────────────────────────────────── */
  let epCache = null;
  async function renderEpisodes() {
    const host = $('#epBody', mount);
    if (!host) return;
    if (!epCache) {
      const res = await api.episodes(a.id, 1);
      epCache = res.items;
      if (!epCache.length && a.episodes) {
        epCache = Array.from({ length: a.episodes }, (_, i) => ({ num: i + 1, title: `Episode ${i + 1}` }));
      }
    }
    if (!epCache.length) {
      host.innerHTML = `<p style="color:var(--fg-3);font-size:.88rem">
        No episode list published yet${a.status === 'Not yet aired' ? ' — this one hasn’t aired.' : '.'}</p>`;
      return;
    }
    const seen = seenEpisodes(a.id);
    host.innerHTML = `
      <div class="tabs" style="margin-bottom:.8rem">
        <button class="is-active" data-epview="list">List</button>
        <button data-epview="grid">Grid</button>
      </div>
      <div id="epView">${epListHTML(a.id, epCache, seen)}</div>`;
    host.querySelectorAll('[data-epview]').forEach((b) => {
      b.addEventListener('click', () => {
        host.querySelectorAll('[data-epview]').forEach((x) => x.classList.toggle('is-active', x === b));
        $('#epView', host).innerHTML = b.dataset.epview === 'grid'
          ? epGridHTML(a.id, epCache)
          : epListHTML(a.id, epCache, seenEpisodes(a.id));
      });
    });
  }
  renderEpisodes();

  /* ── characters ────────────────────────────────────── */
  api.characters(a.id, 12).then((chars) => {
    const host = $('#charBody', mount);
    if (!host) return;
    if (!chars.length) { $('#charPanel', mount)?.remove(); return; }
    host.innerHTML = `<div class="chars">${chars.map((c) => `
      <div class="charrow">
        ${c.img ? imgTag(c.img, c.name, c.name) : `<span class="charrow__ph">${imgTag('', c.name, c.name)}</span>`}
        <div><b>${esc(c.name)}</b><small>${esc(c.role)}${c.va ? ` · ${esc(c.va)}` : ''}</small></div>
      </div>`).join('')}</div>`;
  });

  /* ── recommendations ───────────────────────────────── */
  api.recommendations(a.id, 20).then((recs) => {
    const host = $('#recoHost', mount);
    if (!host || !recs.length) return;
    host.innerHTML = railHTML('More like this', recs.map((r) => current().card(r)).join(''), { icon: ICON.heart });
    bindRails(host);
  });

  return { destroy: offStore };
}

function row(k, v) {
  if (v == null || v === '' || v === '—') return `<div><span class="statlist__k">${esc(k)}</span><span class="statlist__v">—</span></div>`;
  return `<div><span class="statlist__k">${esc(k)}</span><span class="statlist__v">${esc(v)}</span></div>`;
}

function epListHTML(animeId, eps, seen) {
  return `<div class="eplist panel__scroll">${eps.map((e) => `
    <a class="eprow ${e.filler ? 'is-filler' : ''} ${seen.has(e.num) ? 'is-seen' : ''}" href="#/watch/${animeId}?ep=${e.num}">
      <span class="eprow__n">${e.num}</span>
      <span class="eprow__t">${esc(e.title || `Episode ${e.num}`)}</span>
      ${e.filler ? '<span class="chip" style="padding:.05rem .4rem;font-size:.66rem">Filler</span>' : ''}
      ${e.recap ? '<span class="chip" style="padding:.05rem .4rem;font-size:.66rem">Recap</span>' : ''}
      ${seen.has(e.num) ? `<span class="eprow__r" style="color:var(--ok)">watched</span>` : ''}
      ${e.aired ? `<span class="eprow__r">${esc(fmtDate(e.aired))}</span>` : ''}
    </a>`).join('')}</div>`;
}
