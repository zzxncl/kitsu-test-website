/* Kitsu Live — custom video player.
 *
 * Plain <video> underneath, bespoke chrome on top. Handles HLS through
 * hls.js (loaded on demand) and native on Safari/iOS. Persists position,
 * offers skip-intro and an auto-advance card near the end.
 */
import { CONFIG } from './config.js';
import { $, $$, clamp, fmtTime, esc, attr, imgTag, genPoster } from './util.js';
import { getSettings, setSetting, saveProgress, markEpisode } from './store.js';
import { ICON, svg } from './components.js';
import { toast } from './toast.js';

let hlsLib = null;
async function loadHls() {
  if (hlsLib) return hlsLib;
  if (window.Hls) return (hlsLib = window.Hls);
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = CONFIG.hlsCdn; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('hls.js failed to load'));
    document.head.append(s);
  });
  return (hlsLib = window.Hls);
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function createPlayer(mount, ctx) {
  const s = getSettings();
  const st = {
    src: null, type: null, intro: null, hls: null,
    seeking: false, idleTimer: null, nextShown: false, resumeOffered: false,
    saveTimer: null, destroyed: false, menuOpen: false,
  };

  mount.innerHTML = shell(ctx);
  const wrap   = $('.player-wrap', mount);
  const root   = $('.player', mount);
  const video  = $('video', root);
  const poster = $('.pl-poster', root);
  const spin   = $('.pl-spinner', root);
  const seek   = $('.pl-seek', root);
  const fill   = $('.pl-seek__fill', root);
  const buf    = $('.pl-seek__buf', root);
  const knob   = $('.pl-seek__knob', root);
  const tip    = $('.pl-tip', root);
  const marks  = $('.pl-seek__marks', root);
  const tCur   = $('[data-cur]', root);
  const tDur   = $('[data-dur]', root);
  const btnPlay= $('[data-act="play"]', root);
  const btnMute= $('[data-act="mute"]', root);
  const vol    = $('[data-vol]', root);
  const hint   = $('.pl-center-hint', root);
  const floatBar = $('.pl-float', root);
  const nextBox  = $('.pl-next-host', root);

  video.volume = s.muted ? 0 : clamp(s.volume, 0, 1);
  video.muted = !!s.muted;
  video.playbackRate = s.rate || 1;
  setVolUi();

  /* ══ AMBIENT LIGHT ═══════════════════════════════════
     Downscaled video frames are painted into two tiny canvases sitting
     behind the player; CSS blurs them into a wash of colour that bleeds
     out past the frame. We only ever draw — never read pixels back — so
     a cross-origin stream tainting the canvas costs us nothing. */
  const AMB = {
    off:  null,
    soft: { opacity: 0.5,  blur: 54, sat: 1.8, fps: 8  },
    full: { opacity: 1,    blur: 78, sat: 2.5, fps: 12 },
    neon: { opacity: 1.35, blur: 96, sat: 3.6, fps: 15 },
  };
  const AMB_ORDER = ['off', 'soft', 'full', 'neon'];

  const amb = {
    mode: AMB[getSettings().ambient] !== undefined ? getSettings().ambient : 'full',
    raf: null, last: 0, broken: false,
    canvases: $$('.pl-amb', wrap),
  };
  amb.ctxs = amb.canvases.map((c) => c.getContext('2d', { alpha: false }));

  function ambApply() {
    const cfg = AMB[amb.mode];
    const live = Boolean(cfg) && !amb.broken && Boolean(st.src);
    wrap.classList.toggle('amb-on', live);
    if (cfg) {
      wrap.style.setProperty('--amb-opacity', cfg.opacity);
      wrap.style.setProperty('--amb-blur', `${cfg.blur}px`);
      wrap.style.setProperty('--amb-sat', cfg.sat);
    }
    $('[data-act="amb"]', root)?.classList.toggle('is-on', live);
    live && !video.paused ? ambStart() : ambStop();
    if (live) ambPaint();          // one frame now, so a paused video still glows
  }

  function ambPaint() {
    if (amb.broken || video.readyState < 2) return;
    try {
      for (let i = 0; i < amb.canvases.length; i++) {
        const c = amb.canvases[i];
        amb.ctxs[i].drawImage(video, 0, 0, c.width, c.height);
      }
    } catch {
      /* some decoders refuse drawImage entirely — fail quiet, not loud */
      amb.broken = true;
      wrap.classList.remove('amb-on');
      ambStop();
    }
  }

  function ambTick(t) {
    amb.raf = requestAnimationFrame(ambTick);
    const cfg = AMB[amb.mode];
    if (!cfg) return;
    if (t - amb.last < 1000 / cfg.fps) return;
    amb.last = t;
    ambPaint();
  }
  function ambStart() { if (!amb.raf) amb.raf = requestAnimationFrame(ambTick); }
  function ambStop()  { if (amb.raf) { cancelAnimationFrame(amb.raf); amb.raf = null; } }

  function ambSet(mode) {
    amb.mode = AMB[mode] !== undefined ? mode : 'full';
    setSetting('ambient', amb.mode);
    ambApply();
    toast(amb.mode === 'off' ? 'Ambient light off' : `Ambient light: ${amb.mode}`, 'info', 1600);
  }
  function ambCycle() {
    ambSet(AMB_ORDER[(AMB_ORDER.indexOf(amb.mode) + 1) % AMB_ORDER.length]);
  }

  /* ── source loading ────────────────────────────────── */
  async function load(source) {
    teardownHls();
    st.nextShown = false; st.resumeOffered = false;
    if (!source?.src) {
      st.src = null;
      poster.hidden = false;
      poster.querySelector('[data-pmsg]').innerHTML = noSourceMsg();
      spin.hidden = true;
      ambApply();
      return;
    }
    st.src = source.src; st.type = source.type; st.intro = source.intro || null;
    amb.broken = false;
    poster.hidden = true; spin.hidden = false;
    ambApply();
    renderMarks();

    const isHls = (source.type || '').includes('mpegURL') || /\.m3u8(\?|$)/i.test(source.src);
    try {
      if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
        let Hls;
        try {
          Hls = await loadHls();
        } catch {
          throw new Error('This stream is HLS (.m3u8), which needs hls.js — and the CDN copy could not be fetched. Check the network or an ad blocker, or point this server at an .mp4 instead.');
        }
        if (!Hls?.isSupported()) throw new Error('This browser cannot play HLS streams. Try an .mp4 source.');
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false, capLevelToPlayerSize: true });
        st.hls = hls;
        hls.loadSource(source.src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { buildQualityMenu(hls); afterLoad(); });
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
          else fail('Stream error — try another server.');
        });
      } else {
        video.src = source.src;
        video.load();
        afterLoad();
      }
    } catch (err) {
      fail(err.message || 'Could not start playback.');
    }
  }

  function afterLoad() {
    spin.hidden = true;
    const start = Number(ctx.startAt || 0);
    if (start > 2) {
      const go = () => { try { video.currentTime = start; } catch {} };
      video.readyState >= 1 ? go() : video.addEventListener('loadedmetadata', go, { once: true });
      toast(`Resuming at ${fmtTime(start)}`, 'info', 2400);
    }
    if (getSettings().autoplay) video.play().catch(() => {});
  }

  function fail(msg) {
    spin.hidden = true; poster.hidden = false;
    poster.querySelector('[data-pmsg]').innerHTML =
      `<h3>Playback failed</h3><p>${esc(msg)}</p>`;
    toast(msg, 'bad');
  }

  function teardownHls() {
    if (st.hls) { try { st.hls.destroy(); } catch {} st.hls = null; }
    try { video.removeAttribute('src'); video.load(); } catch {}
  }

  function noSourceMsg() {
    return `<h3>No source configured</h3>
      <p>Kitsu Live ships without video. Pick a different server above, paste a direct
      <code>.mp4</code>/<code>.m3u8</code> URL into the <b>Custom</b> field, or wire your own
      resolver in <code>js/config.js</code>.</p>`;
  }

  /* ── transport ─────────────────────────────────────── */
  const toggle = () => (video.paused ? video.play().catch(() => {}) : video.pause());
  const nudge = (d) => { video.currentTime = clamp(video.currentTime + d, 0, video.duration || 0); flash(d > 0 ? ICON.chevR : ICON.chevL); };
  function flash(path) {
    hint.innerHTML = svg(path);
    hint.classList.remove('is-flash');
    void hint.offsetWidth;
    hint.classList.add('is-flash');
  }
  function setVolUi() {
    const v = video.muted ? 0 : video.volume;
    if (vol) { vol.value = String(Math.round(v * 100)); vol.parentElement.style.setProperty('--vol', `${v * 100}%`); }
    btnMute.innerHTML = svg(v === 0
      ? '<path d="M11 5 6 9H3v6h3l5 4zM17 9l4 6M21 9l-4 6"/>'
      : v < 0.5
        ? '<path d="M11 5 6 9H3v6h3l5 4zM16 9.5a3.5 3.5 0 0 1 0 5"/>'
        : '<path d="M11 5 6 9H3v6h3l5 4zM16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10"/>');
  }

  /* ── seek bar ──────────────────────────────────────── */
  function pctFromEvent(e) {
    const r = seek.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    return clamp(x / r.width, 0, 1);
  }
  seek.addEventListener('pointerdown', (e) => {
    if (!video.duration) return;
    st.seeking = true; seek.classList.add('is-drag');
    seek.setPointerCapture?.(e.pointerId);
    video.currentTime = pctFromEvent(e) * video.duration;
  });
  seek.addEventListener('pointermove', (e) => {
    const p = pctFromEvent(e);
    if (video.duration) {
      tip.style.left = `${p * 100}%`;
      tip.textContent = fmtTime(p * video.duration);
    }
    if (st.seeking && video.duration) video.currentTime = p * video.duration;
  });
  const endSeek = () => { st.seeking = false; seek.classList.remove('is-drag'); };
  seek.addEventListener('pointerup', endSeek);
  seek.addEventListener('pointercancel', endSeek);

  function renderMarks() {
    if (!marks) return;
    const intro = st.intro || CONFIG.introGuess;
    marks.innerHTML = '';
    if (intro && video.duration) {
      const m = document.createElement('span');
      m.className = 'pl-seek__mark';
      m.style.left = `${clamp((intro.start / video.duration) * 100, 0, 100)}%`;
      m.title = 'Opening';
      marks.append(m);
    }
  }

  /* ── video events ──────────────────────────────────── */
  video.addEventListener('loadedmetadata', () => {
    tDur.textContent = fmtTime(video.duration);
    renderMarks();
  });
  video.addEventListener('play',    () => { btnPlay.innerHTML = svg(ICON.pause); poster.hidden = true; ambApply(); });
  video.addEventListener('pause',   () => { btnPlay.innerHTML = svg(ICON.play); persist(); ambStop(); ambPaint(); });
  video.addEventListener('loadeddata', ambApply);
  video.addEventListener('seeked', ambPaint);
  video.addEventListener('waiting', () => { spin.hidden = false; });
  video.addEventListener('playing', () => { spin.hidden = true; });
  video.addEventListener('error',   () => { if (st.src && !st.hls) fail('The browser rejected this source.'); });
  video.addEventListener('volumechange', () => {
    setVolUi();
    setSetting('volume', video.volume);
    setSetting('muted', video.muted);
  });
  video.addEventListener('ratechange', () => setSetting('rate', video.playbackRate));
  video.addEventListener('ended', () => {
    markEpisode(ctx.animeId, ctx.episode, true, ctx.anime);
    if (getSettings().autoNext && ctx.nextEp) ctx.onNext?.(ctx.nextEp);
  });

  video.addEventListener('timeupdate', () => {
    const d = video.duration || 0, t = video.currentTime || 0;
    if (d) {
      const p = (t / d) * 100;
      fill.style.width = `${p}%`;
      knob.style.left = `${p}%`;
    }
    tCur.textContent = fmtTime(t);

    /* buffered */
    try {
      if (video.buffered.length && d) {
        const end = video.buffered.end(video.buffered.length - 1);
        buf.style.width = `${clamp((end / d) * 100, 0, 100)}%`;
      }
    } catch {}

    /* skip intro */
    const intro = st.intro || (d > 300 ? CONFIG.introGuess : null);
    const inIntro = intro && t >= intro.start && t < intro.end;
    floatBar.hidden = !(inIntro && getSettings().skipIntro);

    /* next-episode card */
    if (d && ctx.nextEp && !st.nextShown && d - t <= CONFIG.nextEpLeadSec && t > 10) {
      st.nextShown = true;
      showNext();
    }

    /* persist every ~5s */
    if (!st.saveTimer) {
      st.saveTimer = setTimeout(() => { st.saveTimer = null; persist(); }, 5000);
    }
  });

  function persist() {
    if (!video.duration || !ctx.animeId) return;
    saveProgress(ctx.animeId, ctx.episode, video.currentTime, video.duration, ctx.anime);
  }

  /* ── skip intro / next ep ──────────────────────────── */
  floatBar.querySelector('[data-skip]').addEventListener('click', () => {
    const intro = st.intro || CONFIG.introGuess;
    video.currentTime = intro.end;
    floatBar.hidden = true;
  });

  let nextTimer = null;
  function showNext() {
    if (!ctx.nextEp) return;
    const title = ctx.anime ? (ctx.anime.title || '') : '';
    let left = Math.max(5, Math.ceil(CONFIG.nextEpLeadSec * 0.6));
    nextBox.innerHTML = `
      <div class="pl-next">
        <div class="pl-next__head">
          <small>Up next</small>
          <span class="ring" data-count>${left}s</span>
        </div>
        <div class="pl-next__body">
          <span class="pl-next__art">${imgTag(ctx.anime?.poster || genPoster(title), title, title, { ratio: '16/9' })}</span>
          <span class="pl-next__t"><b>Episode ${esc(ctx.nextEp)}</b><small>${esc(title)}</small></span>
        </div>
        <div class="pl-next__acts">
          <button class="btn btn--ghost btn--sm" data-next-cancel>Stay here</button>
          <button class="btn btn--primary btn--sm" data-next-go>${svg(ICON.play)} Play now</button>
        </div>
      </div>`;
    const countEl = nextBox.querySelector('[data-count]');
    const stop = () => { clearInterval(nextTimer); nextTimer = null; nextBox.innerHTML = ''; };
    nextBox.querySelector('[data-next-cancel]').onclick = stop;
    nextBox.querySelector('[data-next-go]').onclick = () => { stop(); ctx.onNext?.(ctx.nextEp); };
    if (!getSettings().autoNext) { countEl.textContent = ''; return; }
    nextTimer = setInterval(() => {
      left -= 1;
      if (countEl) countEl.textContent = `${left}s`;
      if (left <= 0) { stop(); ctx.onNext?.(ctx.nextEp); }
    }, 1000);
  }

  /* ── control wiring ────────────────────────────────── */
  $$('[data-act]', root).forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const act = b.dataset.act;
      if (act === 'play') toggle();
      if (act === 'back') nudge(-10);
      if (act === 'fwd') nudge(10);
      if (act === 'mute') { video.muted = !video.muted; if (!video.muted && video.volume === 0) video.volume = 0.6; }
      if (act === 'prev') ctx.onPrev?.(ctx.prevEp);
      if (act === 'next') ctx.onNext?.(ctx.nextEp);
      if (act === 'pip') togglePip();
      if (act === 'full') toggleFull();
      if (act === 'theater') { root.classList.toggle('is-theater'); ctx.onTheater?.(root.classList.contains('is-theater')); }
      if (act === 'amb') ambCycle();
      if (act === 'menu') toggleMenu();
    });
  });
  vol?.addEventListener('input', () => {
    video.muted = false;
    video.volume = clamp(Number(vol.value) / 100, 0, 1);
  });
  poster.querySelector('.pl-big')?.addEventListener('click', () => {
    if (!st.src) return;
    poster.hidden = true; video.play().catch(() => {});
  });
  video.addEventListener('click', toggle);
  video.addEventListener('dblclick', toggleFull);

  async function togglePip() {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch { toast('Picture-in-picture is not available here.', 'bad'); }
  }
  async function toggleFull() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (root.requestFullscreen) await root.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } catch { toast('Fullscreen was blocked.', 'bad'); }
  }

  /* ── settings menu ─────────────────────────────────── */
  const menuHost = $('.pl-menu', root);
  function toggleMenu() { st.menuOpen ? closeMenu() : openMenu(); }
  function closeMenu() { st.menuOpen = false; $('.pl-menu__pop', root)?.remove(); }
  function openMenu() {
    closeMenu(); st.menuOpen = true;
    const cur = getSettings();
    const levels = st.hls?.levels || [];
    const pop = document.createElement('div');
    pop.className = 'pl-menu__pop';
    pop.innerHTML = `
      <div class="pl-menu__group">
        <div class="pl-menu__label">Speed</div>
        ${RATES.map((r) => `<button class="pl-menu__item ${video.playbackRate === r ? 'is-on' : ''}" data-rate="${r}">
          ${r === 1 ? 'Normal' : r + '×'}<span class="tick">${svg(ICON.check)}</span></button>`).join('')}
      </div>
      ${levels.length ? `<div class="pl-menu__group">
        <div class="pl-menu__label">Quality</div>
        <button class="pl-menu__item ${st.hls.autoLevelEnabled ? 'is-on' : ''}" data-level="-1">Auto<span class="tick">${svg(ICON.check)}</span></button>
        ${levels.map((l, i) => `<button class="pl-menu__item ${!st.hls.autoLevelEnabled && st.hls.currentLevel === i ? 'is-on' : ''}" data-level="${i}">
          ${l.height ? l.height + 'p' : Math.round((l.bitrate || 0) / 1000) + 'kbps'}<span class="tick">${svg(ICON.check)}</span></button>`).join('')}
      </div>` : ''}
      <div class="pl-menu__group">
        <div class="pl-menu__label">Ambient light</div>
        ${AMB_ORDER.map((m) => `<button class="pl-menu__item ${amb.mode === m ? 'is-on' : ''}" data-amb="${m}">
          ${m === 'off' ? 'Off' : m[0].toUpperCase() + m.slice(1)}<span class="tick">${svg(ICON.check)}</span></button>`).join('')}
      </div>
      <div class="pl-menu__group">
        <div class="pl-menu__label">Behaviour</div>
        <button class="pl-menu__item ${cur.autoplay ? 'is-on' : ''}" data-flag="autoplay">Autoplay<span class="tick">${svg(ICON.check)}</span></button>
        <button class="pl-menu__item ${cur.autoNext ? 'is-on' : ''}" data-flag="autoNext">Auto next episode<span class="tick">${svg(ICON.check)}</span></button>
        <button class="pl-menu__item ${cur.skipIntro ? 'is-on' : ''}" data-flag="skipIntro">Offer skip intro<span class="tick">${svg(ICON.check)}</span></button>
      </div>`;
    menuHost.append(pop);
    pop.addEventListener('click', (e) => {
      const r = e.target.closest('[data-rate]');
      const l = e.target.closest('[data-level]');
      const f = e.target.closest('[data-flag]');
      const am = e.target.closest('[data-amb]');
      if (am) { ambSet(am.dataset.amb); openMenu(); }
      if (r) { video.playbackRate = Number(r.dataset.rate); openMenu(); }
      if (l && st.hls) { st.hls.currentLevel = Number(l.dataset.level); openMenu(); }
      if (f) { setSetting(f.dataset.flag, !getSettings()[f.dataset.flag]); openMenu(); }
    });
  }
  function buildQualityMenu() { if (st.menuOpen) openMenu(); }
  document.addEventListener('click', (e) => {
    if (st.menuOpen && !e.target.closest('.pl-menu')) closeMenu();
  });

  /* ── idle chrome ───────────────────────────────────── */
  function wake() {
    root.classList.remove('is-idle');
    clearTimeout(st.idleTimer);
    st.idleTimer = setTimeout(() => {
      if (!video.paused && !st.menuOpen) root.classList.add('is-idle');
    }, 2800);
  }
  ['pointermove', 'pointerdown', 'keydown'].forEach((ev) => root.addEventListener(ev, wake));
  root.addEventListener('pointerleave', () => { if (!video.paused) root.classList.add('is-idle'); });
  wake();

  /* ── keyboard ──────────────────────────────────────── */
  function onKey(e) {
    if (st.destroyed) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    const map = {
      ' ': () => toggle(), k: () => toggle(),
      ArrowLeft: () => nudge(-5), ArrowRight: () => nudge(5),
      j: () => nudge(-10), l: () => nudge(10),
      ArrowUp: () => { video.muted = false; video.volume = clamp(video.volume + 0.1, 0, 1); },
      ArrowDown: () => { video.volume = clamp(video.volume - 0.1, 0, 1); },
      m: () => { video.muted = !video.muted; },
      f: () => toggleFull(), i: () => togglePip(), a: () => ambCycle(),
      n: () => ctx.nextEp && ctx.onNext?.(ctx.nextEp),
      p: () => ctx.prevEp && ctx.onPrev?.(ctx.prevEp),
      ',': () => { video.playbackRate = RATES[clamp(RATES.indexOf(video.playbackRate) - 1, 0, RATES.length - 1)]; },
      '.': () => { video.playbackRate = RATES[clamp(RATES.indexOf(video.playbackRate) + 1, 0, RATES.length - 1)]; },
    };
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (map[lower]) { e.preventDefault(); map[lower](); wake(); return; }
    if (/^[0-9]$/.test(k) && video.duration) {
      e.preventDefault();
      video.currentTime = (Number(k) / 10) * video.duration;
      wake();
    }
  }
  window.addEventListener('keydown', onKey);

  return {
    load,
    get video() { return video; },
    setContext(next) { Object.assign(ctx, next); },
    destroy() {
      st.destroyed = true;
      persist();
      ambStop();
      clearTimeout(st.idleTimer); clearTimeout(st.saveTimer); clearInterval(nextTimer);
      window.removeEventListener('keydown', onKey);
      teardownHls();
      try { video.pause(); } catch {}
    },
  };
}

function shell(ctx) {
  const title = ctx.anime?.title || 'Kitsu Live';
  return `
  <div class="player-wrap">
    <canvas class="pl-amb pl-amb--wash" width="40" height="23" aria-hidden="true"></canvas>
    <canvas class="pl-amb pl-amb--core" width="40" height="23" aria-hidden="true"></canvas>
  <div class="player" tabindex="0">
    <video playsinline preload="metadata" crossorigin="anonymous"></video>

    <div class="pl-poster">
      ${imgTag(ctx.anime?.poster || genPoster(title), '', title, { ratio: '16/9' })}
      <div class="pl-poster__body" data-pmsg>
        <button class="pl-big" aria-label="Play">${svg(ICON.play)}</button>
      </div>
    </div>

    <div class="pl-spinner" hidden></div>
    <div class="pl-center-hint"></div>

    <div class="pl-top">
      <div class="pl-top__txt">
        <b>${esc(title)}</b>
        <small>Episode ${esc(ctx.episode)}</small>
      </div>
      <span class="pl-top__amb"><i></i>AMBIENT</span>
    </div>

    <div class="pl-float" hidden>
      <button class="btn btn--ghost btn--sm" data-skip>Skip intro ${svg(ICON.chevR)}</button>
    </div>
    <div class="pl-next-host"></div>

    <div class="pl-ctrl">
      <div class="pl-seek">
        <div class="pl-seek__rail">
          <div class="pl-seek__buf"></div>
          <div class="pl-seek__fill"></div>
          <div class="pl-seek__marks"></div>
          <div class="pl-seek__knob"></div>
        </div>
        <span class="pl-tip">0:00</span>
      </div>
      <div class="pl-row">
        <button class="pl-btn" data-act="play" aria-label="Play or pause">${svg(ICON.play)}</button>
        <button class="pl-btn" data-act="prev" aria-label="Previous episode" ${ctx.prevEp ? '' : 'disabled'}>
          ${svg('<path d="M18 5 8 12l10 7zM6 5v14"/>')}</button>
        <button class="pl-btn" data-act="next" aria-label="Next episode" ${ctx.nextEp ? '' : 'disabled'}>
          ${svg('<path d="M6 5l10 7L6 19zM18 5v14"/>')}</button>
        <div class="pl-vol">
          <button class="pl-btn" data-act="mute" aria-label="Mute"></button>
          <span class="pl-vol__slider"><input type="range" min="0" max="100" value="100" data-vol aria-label="Volume"></span>
        </div>
        <span class="pl-time"><b data-cur>0:00</b> / <span data-dur>0:00</span></span>
        <span class="pl-spacer"></span>
        <button class="pl-btn" data-act="amb" aria-label="Ambient light" title="Ambient light (A)">
          ${svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/>')}</button>
        <div class="pl-menu">
          <button class="pl-btn" data-act="menu" aria-label="Settings">
            ${svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2.4M12 18.6V21M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/>')}</button>
        </div>
        <button class="pl-btn" data-act="pip" aria-label="Picture in picture">
          ${svg('<rect x="3" y="5" width="18" height="14" rx="3"/><rect x="12" y="11" width="7" height="6" rx="1.5"/>')}</button>
        <button class="pl-btn" data-act="theater" aria-label="Theater mode">
          ${svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/>')}</button>
        <button class="pl-btn" data-act="full" aria-label="Fullscreen">
          ${svg('<path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5"/>')}</button>
      </div>
    </div>
  </div>
  </div>`;
}
