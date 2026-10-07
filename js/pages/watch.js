/* KITSU/LIVE — watch page.
   Player on the left with its toolbar, episode meta, series card and
   comments; episode list, seasons, related and recommendations on the right. */
import { CONFIG } from '../config.js';
import { api } from '../api.js';
import {
  getSettings, setSetting, seenEpisodes, getProgress, markEpisode,
  onStoreChange, addToList, inList, removeFromList,
  getComments, addComment, voteComment, removeComment,
} from '../store.js';
import { createPlayer } from '../player.js';
import { ICON, svg, displayTitle, emptyState } from '../components.js';
import { current } from '../layouts/index.js';
import { $, $$, esc, attr, setMeta, fmtTime, fmtDate, fmtCount, relTime, imgTag, genPoster, scrollTop } from '../util.js';
import { go, buildQuery } from '../router.js';
import { toast } from '../toast.js';

const CHUNK = 24;
const SEASON_RELS = ['Prequel', 'Sequel', 'Parent story', 'Side story', 'Alternative version', 'Alternative setting', 'Full story', 'Summary'];

export default async function watch({ mount, params, query }) {
  const id = params.id;
  const ep = Math.max(1, Number(query.ep) || 1);
  const startAt = Number(query.t) || 0;

  mount.innerHTML = `<div class="wt"><div class="wt__main">
    <div class="sk sk--wide"></div><div class="sk" style="height:120px;margin-top:.8rem"></div></div>
    <div class="wt__side"><div class="sk" style="height:520px"></div></div></div>`;

  const a = await api.anime(id);
  if (!a) { mount.innerHTML = emptyState('Not found', `No anime with id ${id}.`, '<a class="btn btn--ghost" href="#/browse">Browse</a>'); return; }

  const epRes = await api.episodes(a.id, 1);
  let episodes = epRes.items;
  if (!episodes.length) {
    const n = a.episodes || 12;
    episodes = Array.from({ length: n }, (_, i) => ({ num: i + 1, title: `Episode ${i + 1}`, filler: false }));
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

  const seasons = a.relations.filter((r) => SEASON_RELS.includes(r.relation));
  const related = a.relations.filter((r) => !SEASON_RELS.includes(r.relation));
  const ckey = `${a.id}:${ep}`;

  mount.innerHTML = `
  <div class="wt">
    <div class="wt__main">
      <div id="playerMount"></div>

      <div class="wt-tools">
        <button data-t="autoplay">${svg(ICON.check)} Autoplay</button>
        <button data-t="skipIntro">${svg(ICON.check)} Auto Skip</button>
        <button data-t="autoNext">${svg(ICON.check)} Auto Next</button>
        <button data-act="keys">${svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>')} Shortcuts</button>
        <button data-lights>${svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 1 3.5 10.9V16h-7v-2.1A6 6 0 0 1 12 3Z"/>')} Lights Off</button>
        <button data-ambient>${svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2"/>')} Ambient</button>
        <span class="wt-tools__sp"></span>
        <button data-goep="${prevEp ?? ''}" ${prevEp?'':'disabled'}>${svg('<path d="M18 5 8 12l10 7zM6 5v14"/>')} Episode ${prevEp ?? '—'}</button>
        <button data-goep="${nextEp ?? ''}" ${nextEp?'':'disabled'}>Episode ${nextEp ?? '—'} ${svg('<path d="M6 5l10 7L6 19zM18 5v14"/>')}</button>
      </div>

      <section class="wt-card wt-ep">
        <div class="wt-ep__top">
          <h1><b>${ep}.</b> ${esc(epMeta.title || `Episode ${ep}`)}</h1>
          <div class="wt-ep__sel">
            <div class="wt-sel">
              <span class="wt-sel__k">${svg('<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>')} AUDIO</span>
              <select data-audio>
                <option value="sub" ${!dub?'selected':''}>Sub</option>
                <option value="dub" ${dub?'selected':''}>Dub</option>
              </select>
            </div>
            <div class="wt-sel">
              <span class="wt-sel__k">${svg('<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>')} SERVER (${CONFIG.servers.length})</span>
              <select data-server>
                ${CONFIG.servers.map((sv)=>`<option value="${attr(sv.id)}" ${sv.id===serverId?'selected':''}>${esc(sv.label)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="wt-ep__meta">
          ${epMeta.aired?`<span class="wt-tag">${esc(fmtDate(epMeta.aired))}</span>`:''}
          <span class="wt-tag">${svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 11h3M7 14h6"/>')} ${episodes.length}</span>
          ${epMeta.filler?`<span class="wt-tag is-filler">Filler</span>`:''}
          <span class="wt-ep__sp"></span>
          <button class="wt-lnk" data-mark></button>
          <button class="wt-lnk" data-share>${svg('<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.4 10.7 7.2-4.2M8.4 13.3l7.2 4.2"/>')} Share</button>
        </div>
        <div class="wt-custom" ${serverId==='custom'?'':'hidden'}>
          <input class="input" data-custom placeholder="https://…/stream.m3u8 or .mp4" value="${attr(customUrl)}">
          <button class="btn btn--primary btn--sm" data-customgo>Load</button>
        </div>
        <p class="wt-ep__desc">${esc(epMeta.title && epMeta.title !== `Episode ${ep}` ? (a.synopsis||'').slice(0,220) : (a.synopsis||'').slice(0,220))}${(a.synopsis||'').length>220?'…':''}</p>
      </section>

      <section class="wt-card wt-series">
        <div class="wt-series__art">
          ${imgTag(a.poster||genPoster(title), title, title)}
          ${a.trailer?`<a class="wt-trailer" target="_blank" rel="noopener" href="https://www.youtube.com/watch?v=${attr(a.trailer)}">TRAILER ${svg(ICON.play)}</a>`:''}
          <div class="wt-ext">
            <a target="_blank" rel="noopener" href="https://anilist.co/search/anime?search=${encodeURIComponent(a.title)}">AniList</a>
            <a target="_blank" rel="noopener" href="https://myanimelist.net/anime/${a.id}">MAL</a>
          </div>
        </div>
        <div class="wt-series__body">
          <h2>${esc(title)}</h2>
          ${a.titleJp?`<p class="wt-series__jp">${esc(a.titleJp)}</p>`:''}
          <div class="wt-pills">${a.genres.slice(0,6).map(g=>`<a href="#/browse?genre=${g.id}&genreName=${encodeURIComponent(g.name)}">${esc(g.name)}</a>`).join('')}</div>
          <p class="wt-series__syn">${esc(a.synopsis||'No synopsis on file.')}</p>
          <div class="wt-stats">
            <div>
              ${stat('Format', a.type)}${stat('Status', a.status)}${stat('Episodes', a.episodes??'—')}
              ${stat('Rating', a.score?`${Math.round(a.score*10)} /100`:'—')}${stat('Duration', a.duration)}${stat('Season', a.season?`${a.season} ${a.year}`:(a.year||'—'))}
            </div>
            <div>
              ${stat('Start Date', a.airedFrom?fmtDate(a.airedFrom):'—')}${stat('Members', fmtCount(a.members))}
              ${stat('Source', a.source)}${stat('Rank', a.rank?`#${a.rank}`:'—')}
              ${stat('Studios', a.studios.join(', ')||'—')}${stat('Broadcast', a.broadcast||'—')}
            </div>
          </div>
          <div class="wt-series__cta">
            <a class="btn btn--ghost btn--sm" href="#/anime/${a.id}">${svg(ICON.info)} Full entry</a>
            <button class="btn btn--ghost btn--sm" data-lib></button>
          </div>
        </div>
      </section>

      <section class="wt-card wt-comments">
        <div class="wt-comments__top">
          <div><p class="wt-k">The Anime Community</p><h2>Comments</h2></div>
          <div class="wt-seg">
            <button data-scope="anime">ANIME</button>
            <button class="is-on" data-scope="ep">EP ${ep}</button>
          </div>
        </div>
        <div class="wt-comments__bar">
          <span class="wt-note">Stored in this browser only — there is no account system here.</span>
          <label class="wt-sort">Sort by
            <select data-sort><option value="top">Top</option><option value="new">Newest</option></select>
          </label>
        </div>
        <form class="wt-post" data-post>
          <input class="input" data-cname placeholder="Name" value="${attr(getSettings().alias || '')}" maxlength="24">
          <textarea class="input" data-cbody rows="2" placeholder="Add a comment…" maxlength="600"></textarea>
          <button class="btn btn--primary btn--sm" type="submit">Post</button>
        </form>
        <div data-clist></div>
      </section>
    </div>

    <aside class="wt__side">
      <section class="wt-card wt-eps">
        <div class="wt-eps__top">
          <select data-range></select>
          <div class="wt-eps__find">${svg(ICON.search)}<input data-epfilter placeholder="Filter episodes…"></div>
          <button data-unseen title="Hide watched">${svg('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>')}</button>
          <button data-compact title="Compact view">${svg('<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/>')}</button>
        </div>
        <div class="wt-eps__list" data-eplist></div>
      </section>

      ${seasons.length?`<section class="wt-card wt-panel">
        <h3>${svg('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>')} SEASONS</h3>
        <div class="wt-seasons">
          ${seasons.flatMap(r=>r.entries.map(e=>`
            <a class="wt-season" href="#/anime/${e.id}">
              ${imgTag(genPoster(e.title),'',e.title,{ratio:'16/9'})}
              <span><b>${esc(e.title)}</b><i>${esc(r.relation)}</i></span>
            </a>`)).join('')}
        </div></section>`:''}

      <section class="wt-card wt-panel" id="wtRelated" hidden>
        <h3>${svg(ICON.chevR)} RELATED</h3><div class="wt-rows" data-related></div>
      </section>
      <section class="wt-card wt-panel" id="wtRecs" hidden>
        <h3>${svg(ICON.chevR)} RECOMMENDATIONS</h3><div class="wt-rows" data-recs></div>
      </section>
    </aside>
  </div>`;

  /* ── player ────────────────────────────────────────── */
  const ctx = {
    animeId: a.id, anime: a, episode: ep, prevEp, nextEp, startAt,
    onNext: (n) => n && go(`/watch/${a.id}${buildQuery({ ep: n })}`),
    onPrev: (n) => n && go(`/watch/${a.id}${buildQuery({ ep: n })}`),
  };
  const player = createPlayer($('#playerMount', mount), ctx);

  async function applySource() {
    const sv = CONFIG.servers.find((x) => x.id === serverId) || CONFIG.servers[0];
    let src = null;
    try { src = await sv.resolve({ malId: a.id, title: a.title, episode: ep, dub, custom: customUrl }); }
    catch (err) { toast(`Server "${sv.label}" failed: ${err.message}`, 'bad'); }
    player.load(src);
  }
  applySource();

  /* ── toolbar ───────────────────────────────────────── */
  function syncTools() {
    const cur = getSettings();
    $$('[data-t]', mount).forEach((b) => b.classList.toggle('is-on', !!cur[b.dataset.t]));
    $('[data-lights]', mount).classList.toggle('is-on', document.documentElement.classList.contains('lights-off'));
    $('[data-ambient]', mount).classList.toggle('is-on', cur.ambient !== 'off');
  }
  $$('[data-t]', mount).forEach((b) => b.addEventListener('click', () => {
    setSetting(b.dataset.t, !getSettings()[b.dataset.t]); syncTools();
  }));
  $('[data-lights]', mount).addEventListener('click', () => {
    document.documentElement.classList.toggle('lights-off'); syncTools();
  });
  $('[data-ambient]', mount).addEventListener('click', () => {
    setSetting('ambient', getSettings().ambient === 'off' ? 'full' : 'off');
    toast('Press A in the player to cycle intensity', 'info', 2200);
    syncTools();
  });
  $$('[data-goep]', mount).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.goep) go(`/watch/${a.id}${buildQuery({ ep: b.dataset.goep })}`);
  }));
  syncTools();

  /* ── audio / server ────────────────────────────────── */
  $('[data-audio]', mount).addEventListener('change', (e) => {
    dub = e.target.value === 'dub'; setSetting('preferDub', dub); applySource();
  });
  $('[data-server]', mount).addEventListener('change', (e) => {
    serverId = e.target.value; setSetting('server', serverId);
    $('.wt-custom', mount).hidden = serverId !== 'custom';
    applySource();
  });
  $('[data-customgo]', mount).addEventListener('click', () => {
    customUrl = $('[data-custom]', mount).value.trim();
    sessionStorage.setItem('kitsulive:customUrl', customUrl);
    if (!customUrl) return toast('Paste a direct video URL first.', 'bad');
    applySource();
  });
  $('[data-share]', mount).addEventListener('click', async () => {
    const url = location.href;
    try { await navigator.clipboard.writeText(url); toast('Link copied', 'ok'); }
    catch { toast(url, 'info', 6000); }
  });

  /* ── mark / library ────────────────────────────────── */
  function syncBtns() {
    const done = seenEpisodes(a.id).has(ep);
    $('[data-mark]', mount).innerHTML = `${svg(ICON.check)} ${done ? 'Watched' : 'Mark watched'}`;
    $('[data-mark]', mount).classList.toggle('is-on', done);
    $('[data-lib]', mount).innerHTML = inList(a.id) ? `${svg(ICON.check)} In library` : `${svg(ICON.plus)} Add to library`;
  }
  $('[data-mark]', mount).addEventListener('click', () => {
    const done = seenEpisodes(a.id).has(ep);
    markEpisode(a.id, ep, !done, a);
    toast(done ? `Episode ${ep} unmarked` : `Episode ${ep} marked watched`, 'ok');
  });
  $('[data-lib]', mount).addEventListener('click', () => {
    if (inList(a.id)) { removeFromList(a.id); toast('Removed from library'); }
    else { addToList(a, 'watching'); toast('Added to library', 'ok'); }
  });
  syncBtns();

  /* ── episode sidebar ───────────────────────────────── */
  const ranges = [];
  for (let i = 0; i < episodes.length; i += CHUNK) {
    const slice = episodes.slice(i, i + CHUNK);
    ranges.push({ from: slice[0].num, to: slice[slice.length - 1].num, items: slice });
  }
  let rangeIdx = Math.max(0, ranges.findIndex((r) => ep >= r.from && ep <= r.to));
  let hideSeen = false, compact = false;

  $('[data-range]', mount).innerHTML = ranges.map((r, i) =>
    `<option value="${i}" ${i===rangeIdx?'selected':''}>${r.from} - ${r.to}</option>`).join('');

  function renderEps() {
    const filter = ($('[data-epfilter]', mount).value || '').trim().toLowerCase();
    const seen = seenEpisodes(a.id);
    let rows = ranges[rangeIdx]?.items || [];
    if (filter) rows = episodes.filter((e) => String(e.num) === filter || (e.title||'').toLowerCase().includes(filter));
    if (hideSeen) rows = rows.filter((e) => !seen.has(e.num));

    $('[data-eplist]', mount).className = `wt-eps__list ${compact?'is-compact':''}`;
    $('[data-eplist]', mount).innerHTML = rows.length ? rows.map((e) => {
      const p = getProgress(a.id, e.num);
      const pct = p?.duration > 0 ? Math.min(100, (p.position / p.duration) * 100) : 0;
      const on = e.num === ep, watched = seen.has(e.num);
      return `<a class="wt-eprow ${on?'is-on':''} ${watched?'is-seen':''}" href="#/watch/${a.id}?ep=${e.num}">
        <span class="wt-eprow__art">${imgTag(a.poster||genPoster(title),'',title,{ratio:'16/9'})}
          <span class="wt-eprow__n">EP ${e.num}</span></span>
        <span class="wt-eprow__b">
          <b>${esc(e.title || `Episode ${e.num}`)}</b>
          <span class="wt-eprow__f">
            ${svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 11h3M7 14h6"/>')}
            ${svg('<path d="M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z"/><path d="M5 11a7 7 0 0 0 14 0"/>')}
            ${e.filler?'<u>Filler</u>':''}${e.recap?'<u>Recap</u>':''}
            ${watched?'<u class="is-seen">Watched</u>':''}
            <em>${e.aired?esc(fmtDate(e.aired)):(pct>1?`${Math.round(pct)}%`:'')}</em>
          </span>
        </span>
        ${pct>1&&!watched?`<span class="wt-eprow__bar"><i style="width:${pct}%"></i></span>`:''}
      </a>`;
    }).join('') : `<p class="wt-empty">No episode matches that.</p>`;
    $('.wt-eprow.is-on', mount)?.scrollIntoView({ block: 'nearest' });
  }
  $('[data-range]', mount).addEventListener('change', (e) => { rangeIdx = +e.target.value; renderEps(); });
  $('[data-epfilter]', mount).addEventListener('input', renderEps);
  $('[data-unseen]', mount).addEventListener('click', (e) => {
    hideSeen = !hideSeen; e.currentTarget.classList.toggle('is-on', hideSeen); renderEps();
  });
  $('[data-compact]', mount).addEventListener('click', (e) => {
    compact = !compact; e.currentTarget.classList.toggle('is-on', compact); renderEps();
  });
  renderEps();

  /* ── related + recommendations ─────────────────────── */
  const rowHTML = (x, rel) => `<a class="wt-row" href="#/anime/${x.id}">
    ${imgTag(x.poster||genPoster(x.title),'',x.title)}
    <span><b>${esc(x.title)}</b>
      <i>${rel?`<em class="dot"></em>${esc(rel)} · `:''}${esc(x.type||'')}${x.year?` · ${x.year}`:''}${x.episodes?` · ${x.episodes} EP`:''}${x.score?` · ☆${Math.round(x.score*10)}`:''}</i>
    </span></a>`;

  if (related.length) {
    $('#wtRelated', mount).hidden = false;
    $('[data-related]', mount).innerHTML = related.flatMap((r) =>
      r.entries.map((e) => rowHTML({ id: e.id, title: e.title }, r.relation))).join('');
  }
  api.recommendations(a.id, 8).then((recs) => {
    if (!recs.length || !$('#wtRecs', mount)) return;
    $('#wtRecs', mount).hidden = false;
    $('[data-recs]', mount).innerHTML = recs.map((r) => rowHTML(r)).join('');
  });

  /* ── comments (local) ──────────────────────────────── */
  let scope = 'ep', sort = 'top';
  const keyFor = () => (scope === 'ep' ? ckey : `${a.id}`);

  function renderComments() {
    const list = getComments(keyFor());
    const tops = list.filter((c) => !c.parent);
    tops.sort((x, y) => sort === 'top'
      ? (y.up - y.down) - (x.up - x.down) || y.at - x.at
      : y.at - x.at);
    const kids = (pid) => list.filter((c) => c.parent === pid).sort((x, y) => x.at - y.at);
    const one = (c, depth = 0) => `
      <div class="wt-c" style="--d:${depth}">
        <span class="wt-c__av">${esc((c.author||'?')[0].toUpperCase())}</span>
        <div class="wt-c__b">
          <p class="wt-c__h"><b>${esc(c.author||'anon')}</b> <i>${esc(relTime(c.at))}</i></p>
          <p class="wt-c__t">${esc(c.body)}</p>
          <div class="wt-c__a">
            <button data-v="1" data-id="${c.id}" class="${c.vote===1?'is-on':''}">${svg('<path d="M7 10v10H3V10zM7 10l5-7a2 2 0 0 1 3 2l-1 5h5a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 17.7 20H7"/>')} ${c.up||0}</button>
            <button data-v="-1" data-id="${c.id}" class="${c.vote===-1?'is-on':''}">${svg('<path d="M17 14V4h4v10zM17 14l-5 7a2 2 0 0 1-3-2l1-5H5a2 2 0 0 1-2-2.4l1.3-6A2 2 0 0 1 6.3 4H17"/>')} ${c.down||0}</button>
            ${depth === 0 ? `<button data-reply="${c.id}">${svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>')} Reply</button>` : ''}
            <button data-del="${c.id}">Delete</button>
          </div>
          <form class="wt-reply" data-rform="${c.id}" hidden>
            <input class="input" data-rbody placeholder="Reply…" maxlength="400">
            <button class="btn btn--primary btn--sm" type="submit">Send</button>
          </form>
          ${kids(c.id).map((k) => one(k, depth + 1)).join('')}
        </div>
      </div>`;
    $('[data-clist]', mount).innerHTML = tops.length
      ? `<p class="wt-ccount">${list.length} comment${list.length===1?'':'s'}</p>` + tops.map((c) => one(c)).join('')
      : `<p class="wt-empty">No comments yet — be the first.</p>`;
  }

  $('[data-post]', mount).addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('[data-cname]', mount).value.trim() || 'anon';
    const body = $('[data-cbody]', mount).value;
    if (!body.trim()) return;
    setSetting('alias', name);
    addComment(keyFor(), { body, author: name });
    $('[data-cbody]', mount).value = '';
    renderComments();
  });
  $('[data-clist]', mount).addEventListener('click', (e) => {
    const v = e.target.closest('[data-v]');
    const r = e.target.closest('[data-reply]');
    const d = e.target.closest('[data-del]');
    if (v) { voteComment(keyFor(), v.dataset.id, +v.dataset.v); renderComments(); }
    if (r) { const f = $(`[data-rform="${r.dataset.reply}"]`, mount); if (f) { f.hidden = !f.hidden; f.querySelector('input')?.focus(); } }
    if (d) { removeComment(keyFor(), d.dataset.del); renderComments(); }
  });
  $('[data-clist]', mount).addEventListener('submit', (e) => {
    const f = e.target.closest('[data-rform]');
    if (!f) return;
    e.preventDefault();
    const body = f.querySelector('[data-rbody]').value;
    if (!body.trim()) return;
    addComment(keyFor(), { body, parent: f.dataset.rform, author: getSettings().alias || 'anon' });
    renderComments();
  });
  $$('[data-scope]', mount).forEach((b) => b.addEventListener('click', () => {
    scope = b.dataset.scope;
    $$('[data-scope]', mount).forEach((x) => x.classList.toggle('is-on', x === b));
    renderComments();
  }));
  $('[data-sort]', mount).addEventListener('change', (e) => { sort = e.target.value; renderComments(); });
  renderComments();

  const off = onStoreChange((w) => {
    if (w === 'progress' || w === 'list' || w === 'all') { syncBtns(); renderEps(); }
  });

  return {
    destroy() {
      player.destroy(); off();
      document.documentElement.classList.remove('lights-off');
    },
  };
}

function stat(k, v) {
  return `<p><span>${esc(k)}:</span> <b>${esc(v ?? '—')}</b></p>`;
}
