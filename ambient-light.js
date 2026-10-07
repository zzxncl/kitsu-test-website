/*!
 * ambient-light.js — drop-in ambilight for any <video>. No dependencies.
 * ---------------------------------------------------------------------
 * Paints downscaled video frames into tiny canvases behind the player and
 * blurs them with CSS, so the picture's colour bleeds out around the frame
 * and (optionally) lights the whole page.
 *
 *   <script src="ambient-light.js"></script>
 *   <script>
 *     const amb = AmbientLight.attach('video');      // that's it
 *   </script>
 *
 * With options:
 *   const amb = new AmbientLight(document.querySelector('video'), {
 *     mode: 'full',      // 'off' | 'soft' | 'full' | 'neon' | {custom}
 *     flood: true,       // also light the page behind the whole document
 *     target: null,      // container to glow around (default: wraps the video)
 *   });
 *
 * Under a bundler:  const AmbientLight = require('./ambient-light.js');
 *
 *   amb.setMode('neon');  amb.setFlood(false);  amb.toggle();  amb.destroy();
 *
 * Notes
 *  - It only ever DRAWS frames, never reads pixels back, so a cross-origin
 *    stream that taints the canvas still works fine. No CORS headers needed.
 *  - All CSS is injected by this file. There is no stylesheet to copy.
 *  - Repaints at 8–15fps (not every frame — pointless for a blurred wash)
 *    and stops entirely while paused, so the cost is negligible.
 *
 * MIT licence. Do what you like with it.
 */
(function (root, factory) {
  const AmbientLight = factory();
  if (typeof module === 'object' && module.exports) module.exports = AmbientLight;
  root.AmbientLight = AmbientLight;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NS = 'ambl';
  const PRESETS = {
    off:  null,
    soft: { fps: 8,  blur: 54, sat: 1.8, opacity: 0.50, pageOpacity: 0.18, pageBlur: 70,  pageBright: 0.62 },
    full: { fps: 12, blur: 78, sat: 2.5, opacity: 1.00, pageOpacity: 0.34, pageBlur: 95,  pageBright: 0.60 },
    neon: { fps: 15, blur: 96, sat: 3.6, opacity: 1.35, pageOpacity: 0.46, pageBlur: 115, pageBright: 0.58 },
  };
  const ORDER = ['off', 'soft', 'full', 'neon'];

  /* Frame buffers are deliberately tiny — the browser's own upscaling does
     most of the smoothing, which is what keeps the blur cheap. */
  const CW = 40, CH = 23;

  const CSS = `
.${NS}-wrap { position: relative; isolation: isolate; }
.${NS}-layer {
  position: absolute; pointer-events: none; z-index: 0;
  opacity: 0; transition: opacity .6s cubic-bezier(.2,.7,.3,1);
  will-change: opacity;
}
.${NS}-layer canvas { width: 100%; height: 100%; display: block; }
.${NS}-wash {
  inset: -14% -9%;
  filter: blur(var(--${NS}-blur,78px)) saturate(var(--${NS}-sat,2.5)) brightness(1.1);
  transform: scaleY(1.06);
}
.${NS}-core {
  inset: -3% -2%;
  filter: blur(calc(var(--${NS}-blur,78px) * .42)) saturate(var(--${NS}-sat,2.5)) brightness(1.2);
}
.${NS}-wrap.${NS}-on .${NS}-wash { opacity: var(--${NS}-opacity,1); }
.${NS}-wrap.${NS}-on .${NS}-core { opacity: calc(var(--${NS}-opacity,1) * .55); }
.${NS}-wrap > video, .${NS}-wrap > :not(.${NS}-layer) { position: relative; z-index: 1; }

/* page-wide flood */
.${NS}-stage {
  position: fixed; inset: -18%; pointer-events: none;
  opacity: 0; transition: opacity .9s cubic-bezier(.2,.7,.3,1);
  will-change: opacity;
  filter: blur(var(--${NS}-page-blur,95px)) saturate(var(--${NS}-sat,2.5))
          brightness(var(--${NS}-page-bright,.6));
}
.${NS}-stage canvas { width: 100%; height: 100%; display: block; }
.${NS}-stage.${NS}-behind  { z-index: -1; }
.${NS}-stage.${NS}-overlay { z-index: 2147483000; mix-blend-mode: screen; }
.${NS}-stage.${NS}-on { opacity: var(--${NS}-page-opacity,.34); }
@media (prefers-reduced-motion: reduce) {
  .${NS}-layer, .${NS}-stage { transition: none; }
}`;

  function injectCSS() {
    if (document.getElementById(NS + '-css')) return;
    const el = document.createElement('style');
    el.id = NS + '-css';
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function makeLayer(cls) {
    const d = document.createElement('div');
    d.className = `${NS}-layer ${cls}`;
    d.setAttribute('aria-hidden', 'true');
    const c = document.createElement('canvas');
    c.width = CW; c.height = CH;
    d.appendChild(c);
    return d;
  }

  const isOpaque = (c) => {
    if (!c || c === 'transparent') return false;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return true;
    const parts = m[1].split(',').map((s) => parseFloat(s));
    return parts.length < 4 || parts[3] > 0.95;
  };

  class AmbientLight {
    /**
     * @param {HTMLVideoElement|string} video
     * @param {object} [opts]
     */
    constructor(video, opts = {}) {
      this.video = typeof video === 'string' ? document.querySelector(video) : video;
      if (!this.video) throw new Error('[ambient-light] no video element');

      this.opts = Object.assign({
        mode: 'full',
        flood: true,
        floodStrategy: 'auto',  // 'behind' | 'overlay' | 'auto'
        wrap: true,             // wrap the video so the glow can't be clipped
        target: null,           // or hand it an existing container to glow around
        presets: PRESETS,
      }, opts);

      this._mode = this.opts.mode;
      this._flood = this.opts.flood !== false;
      this._raf = null; this._last = 0; this._broken = false; this._hoisted = false;

      injectCSS();
      this._build();
      this._bind();
      this.apply();
    }

    /* ── setup ───────────────────────────────────────── */
    _build() {
      const v = this.video;

      if (this.opts.target) {
        /* caller owns the container — e.g. a player with its own chrome, where
           the glow must sit outside the clipped frame */
        this.wrap = this.opts.target;
        this.wrap.classList.add(`${NS}-wrap`);
      } else if (this.opts.wrap && !v.parentElement?.classList.contains(`${NS}-wrap`)) {
        const w = document.createElement('div');
        w.className = `${NS}-wrap`;
        v.parentElement.insertBefore(w, v);
        w.appendChild(v);
        this.wrap = w;
        this._madeWrap = true;
      } else {
        this.wrap = v.parentElement;
        this.wrap.classList.add(`${NS}-wrap`);
      }

      this.wash = makeLayer(`${NS}-wash`);
      this.core = makeLayer(`${NS}-core`);
      this.wrap.prepend(this.core);
      this.wrap.prepend(this.wash);

      this.stage = document.createElement('div');
      this.stage.className = `${NS}-stage`;
      this.stage.setAttribute('aria-hidden', 'true');
      const sc = document.createElement('canvas');
      sc.width = CW; sc.height = CH;
      this.stage.appendChild(sc);
      document.body.prepend(this.stage);

      this.canvases = [this.wash, this.core, this.stage].map((d) => d.querySelector('canvas'));
      this.ctxs = this.canvases.map((c) => c.getContext('2d', { alpha: false }));
    }

    /**
     * A page-wide glow at z-index:-1 is invisible if <body> paints an opaque
     * background over it. If it does, move that colour up to <html> — the
     * page looks identical and the glow now has somewhere to live.
     */
    _prepareFlood() {
      let strategy = this.opts.floodStrategy;
      if (strategy === 'auto') {
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        if (isOpaque(bodyBg)) {
          const htmlBg = getComputedStyle(document.documentElement).backgroundColor;
          if (!isOpaque(htmlBg)) {
            this._prevHtmlBg = document.documentElement.style.background;
            this._prevBodyBg = document.body.style.background;
            document.documentElement.style.background = bodyBg;
            document.body.style.background = 'transparent';
            this._hoisted = true;
          } else {
            strategy = 'overlay';   // can't hoist safely — blend on top instead
          }
        }
        if (strategy === 'auto') strategy = 'behind';
      }
      this._strategy = strategy;
      this.stage.classList.toggle(`${NS}-behind`, strategy === 'behind');
      this.stage.classList.toggle(`${NS}-overlay`, strategy === 'overlay');
    }

    _bind() {
      this._onPlay = () => this.apply();
      this._onPause = () => { this._stop(); this.paint(); };
      this._onData = () => this.apply();
      this._onSeek = () => this.paint();
      this.video.addEventListener('play', this._onPlay);
      this.video.addEventListener('pause', this._onPause);
      this.video.addEventListener('loadeddata', this._onData);
      this.video.addEventListener('seeked', this._onSeek);
    }

    /* ── drawing ─────────────────────────────────────── */
    get preset() {
      const m = this._mode;
      if (m && typeof m === 'object') return m;
      return this.opts.presets[m] !== undefined ? this.opts.presets[m] : PRESETS.full;
    }

    paint() {
      if (this._broken || this.video.readyState < 2) return;
      try {
        for (let i = 0; i < this.canvases.length; i++) {
          this.ctxs[i].drawImage(this.video, 0, 0, CW, CH);
        }
      } catch (e) {
        /* some decoders refuse drawImage outright — fail quiet, not loud */
        this._broken = true;
        this._stop();
        this.wrap.classList.remove(`${NS}-on`);
        this.stage.classList.remove(`${NS}-on`);
      }
    }

    _tick = (t) => {
      this._raf = requestAnimationFrame(this._tick);
      const p = this.preset;
      if (!p) return;
      if (t - this._last < 1000 / (this.opts.fps || p.fps)) return;
      this._last = t;
      this.paint();
    };
    _start() { if (!this._raf) this._raf = requestAnimationFrame(this._tick); }
    _stop() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }

    /* ── state ───────────────────────────────────────── */
    apply() {
      const p = this.preset;
      const live = Boolean(p) && !this._broken;

      if (p) {
        const s = this.wrap.style;
        s.setProperty(`--${NS}-opacity`, p.opacity);
        s.setProperty(`--${NS}-blur`, p.blur + 'px');
        s.setProperty(`--${NS}-sat`, p.sat);
        const t = this.stage.style;
        t.setProperty(`--${NS}-page-opacity`, p.pageOpacity);
        t.setProperty(`--${NS}-page-blur`, p.pageBlur + 'px');
        t.setProperty(`--${NS}-page-bright`, p.pageBright);
        t.setProperty(`--${NS}-sat`, p.sat);
      }

      this.wrap.classList.toggle(`${NS}-on`, live);

      const flooding = live && this._flood;
      if (flooding && !this._strategy) this._prepareFlood();
      this.stage.classList.toggle(`${NS}-on`, flooding);
      document.documentElement.classList.toggle(`${NS}-flooded`, flooding);

      live && !this.video.paused ? this._start() : this._stop();
      if (live) this.paint();
      return this;
    }

    get mode() { return this._mode; }
    setMode(m) { this._mode = m; return this.apply(); }
    cycle() { return this.setMode(ORDER[(ORDER.indexOf(this._mode) + 1) % ORDER.length]); }
    get flood() { return this._flood; }
    setFlood(on) { this._flood = !!on; return this.apply(); }
    toggle() { return this.setMode(this._mode === 'off' ? 'full' : 'off'); }

    destroy() {
      this._stop();
      this.video.removeEventListener('play', this._onPlay);
      this.video.removeEventListener('pause', this._onPause);
      this.video.removeEventListener('loadeddata', this._onData);
      this.video.removeEventListener('seeked', this._onSeek);
      this.wash.remove(); this.core.remove(); this.stage.remove();
      document.documentElement.classList.remove(`${NS}-flooded`);
      if (this._hoisted) {
        document.documentElement.style.background = this._prevHtmlBg || '';
        document.body.style.background = this._prevBodyBg || '';
      }
      if (this._madeWrap && this.wrap.parentElement) {
        this.wrap.parentElement.insertBefore(this.video, this.wrap);
        this.wrap.remove();
      } else {
        this.wrap.classList.remove(`${NS}-wrap`, `${NS}-on`);
      }
    }

    static attach(video, opts) { return new AmbientLight(video, opts); }
    static get presets() { return PRESETS; }
  }

  return AmbientLight;
});
