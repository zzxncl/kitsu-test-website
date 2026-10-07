# KITSU/LIVE

An anime index with an ambient-light player. Browse, search, track what you're
watching — all in the browser, with no build step, no framework, no account.

**Five skins**, switchable live — press <kbd>K</kbd> for the picker or
<kbd>S</kbd> to cycle:

| Skin | Look |
|---|---|
| **Press** | Editorial brutalism. Hairline rules, condensed poster type, hard-offset hovers. |
| **Vault** | The modern streaming look, done carefully. Deep slate, soft depth, one electric accent. |
| **Neon** | Late-night arcade. Black glass, magenta and cyan, scanlines. Hits hardest with ambient light. |
| **Linen** | Warm paper and an italic serif. A reading room rather than a dashboard. |
| **Noir** | Cinema. Pure greyscale, one blood accent, chrome almost absent. |

Each is one small file in `css/skins/` that overrides a set of surface
variables — radius, border weight, shadow, fonts, card hover, panel fill —
declared in `css/base.css`. Adding a sixth is a copy and a palette.

Vanilla ES modules, hash routing, ~1,450 lines of hand-written CSS. Drop it on
any static host.

---

## Run it

It uses ES modules, so it needs to be served over HTTP (opening `index.html`
with `file://` will be blocked by the browser):

```bash
python3 -m http.server 8777
# then open http://127.0.0.1:8777
```

Any static host works — GitHub Pages, Netlify, Cloudflare Pages, `npx serve`.
Hash routing means no server rewrite rules are needed.

---

## What's in it

**Home** — rotating spotlight carousel, continue-watching rail, trending,
fresh episodes, seasonal, all-time ranked list, movies, upcoming.

**Browse** — full-text search plus format / status / year / min-score / genre
filters, sorting, and pagination.

**Detail page** — synopsis, stats, score breakdown, characters with voice
actors, related entries, external links, episode list (list *or* grid view,
filler flagged), and your per-series progress.

**Watch** — custom player with a server switcher and sub/dub toggle, an
episode sidebar with per-episode progress bars, and recommendations.

**Library** — watchlist with five status buckets, stats, and continue-watching.
Export/import as JSON.

**Schedule** — the week's broadcasts grouped by air time.

**Settings** — theme, title language, playback defaults, data export/import,
cache controls.

### Ambient light — `ambient-light.js`

**This is a standalone file you can drop into any site.** No dependencies, no
stylesheet to copy, no build step. Open `ambient-light.html` for a live demo
and the docs.

```html
<script src="ambient-light.js"></script>
<script>
  const amb = AmbientLight.attach('video');
</script>
```

That's the whole integration. It injects its own CSS, wraps the video itself,
and starts and stops with playback. The site you're reading about uses this
exact file — there is no second copy to drift out of sync.

```js
new AmbientLight(video, {
  mode: 'full',           // 'off' | 'soft' | 'full' | 'neon' | {custom}
  flood: true,            // also light the page behind the whole document
  floodStrategy: 'auto',  // 'behind' | 'overlay' | 'auto'
  target: null,           // container to glow around (default: wraps the video)
});
// amb.setMode('neon'); amb.cycle(); amb.setFlood(false); amb.destroy();
```

Downscaled video frames are painted into tiny canvases (40×23) sitting behind
the player; CSS blurs them into a wash of colour that bleeds out past the
frame and onto the page — the same idea as a backlit TV.

Two stacked layers do the work: a wide soft wash for spill, and a tighter
brighter core hugging the edge so the bleed reads as *light* rather than fog.
It repaints at 8–15fps depending on mode (not every frame — there's no point,
and it keeps the cost near zero), pauses with the video, and holds the last
frame while paused so the glow doesn't snap off.

It doesn't stop at the player frame. A second fixed, viewport-sized copy of
the same frame sits behind the entire document, so the picture lights the
whole site — and while watching, the topbar, panels and footer go translucent
so the colour reads *through* the chrome instead of stopping at it.

A layer at `z-index: -1` is invisible if `<body>` paints an opaque background
over it, which most sites do. On `auto` the module detects that and moves the
colour up to `<html>` — the page looks identical and the glow has somewhere to
live. If it can't do that safely it falls back to an `overlay` layer using
`mix-blend-mode: screen`, which works anywhere. Verified against a page built
with no knowledge of the module.

The page layer runs dimmer and softer than the frame glow, and text sitting
directly on the lit background gets a backing shadow, so body copy survives a
bright scene.

Four modes — **off / soft / full / neon** — on the <kbd>A</kbd> key, the sun
icon in the player bar, the player's settings menu, or Settings → Playback.
<kbd>Shift</kbd>+<kbd>A</kbd> toggles the page-wide flood on its own, keeping
the glow to the frame.

Because it only ever *draws* frames and never reads pixels back, a
cross-origin stream tainting the canvas costs nothing — it keeps working where
a histogram-based approach would throw. If a decoder refuses `drawImage`
outright, the glow disables itself quietly instead of erroring.

### The player

Built from scratch on a plain `<video>` element:

- HLS via [hls.js](https://github.com/video-dev/hls.js) (loaded on demand),
  native on Safari/iOS; plain MP4/WebM otherwise
- Scrubbing with buffered-range display and a hover time tooltip
- Quality and speed menus, volume, PiP, theater mode, fullscreen
- Skip-intro button over the opening window
- Auto-advance to the next episode with a countdown card
- Resume where you left off, saved every ~5s
- Idle-hiding chrome

Keyboard: <kbd>Space</kbd>/<kbd>K</kbd> play, <kbd>←</kbd><kbd>→</kbd> seek 5s,
<kbd>J</kbd><kbd>L</kbd> seek 10s, <kbd>↑</kbd><kbd>↓</kbd> volume,
<kbd>M</kbd> mute, <kbd>F</kbd> fullscreen, <kbd>I</kbd> PiP,
<kbd>A</kbd> ambient light, <kbd>Shift</kbd>+<kbd>A</kbd> page flood, <kbd>N</kbd>/<kbd>P</kbd> next/previous episode,
<kbd>0</kbd>–<kbd>9</kbd> jump to percent, <kbd>,</kbd>/<kbd>.</kbd> speed.

Site-wide: <kbd>/</kbd> search, <kbd>G</kbd> then <kbd>H</kbd>/<kbd>B</kbd>/<kbd>L</kbd>/<kbd>S</kbd>
to navigate, <kbd>R</kbd> random, <kbd>T</kbd> theme, <kbd>?</kbd> for the full list.

---

## Video sources — read this part

**Kitsu Live hosts no video and ships with no scraper.** The player is real and
complete; it just needs something to point at. Sources are resolver stubs in
[`js/config.js`](js/config.js):

```js
servers: [
  {
    id: 'myserver',
    label: 'My server',
    resolve: ({ malId, title, episode, dub }) => ({
      src:  `https://example.com/${malId}/${episode}.m3u8`,
      type: 'application/x-mpegURL',
      intro: { start: 85, end: 175 },   // optional, drives "skip intro"
    }),
  },
],
```

`resolve()` may be async. Return `null` to show the "no source" screen.

Four stubs ship by default:

| Server | What it does |
|---|---|
| **Demo clip** | A 14s generated clip bundled in `video/demo.webm` — no network needed, and a good way to see the ambient light work |
| **HLS test** | A public test stream, to exercise the hls.js path |
| **Local file** | Looks for `video/ep-<n>.mp4` next to `index.html` |
| **Custom** | Paste any direct `.mp4` / `.m3u8` / `.webm` URL on the watch page |

Point these at content you actually have the rights to serve.

---

## Catalog data

Metadata comes from [Jikan](https://jikan.moe), the free unofficial MyAnimeList
API — no key required. Because Jikan rate-limits to roughly 3 requests/second,
`js/api.js` runs every call through one serialized queue with request spacing,
retry-with-backoff on 429, de-duplication of in-flight requests, and a 30-minute
TTL cache in `localStorage`.

If the API can't be reached at all, a circuit breaker trips and the UI falls
back to a small bundled demo catalog (`data/fallback.json`) so nothing renders
blank. Those 20 entries are original placeholder titles written for this
project — not real releases — and their posters are generated gradients. A
banner makes the demo state obvious.

---

## Your data

Watchlist, episode progress, settings and search history live in
`localStorage` and never leave the browser. There is no backend, no analytics
and no account. Settings → **Export backup** writes the lot to a JSON file;
**Import** restores it.

---

## Layout

```
index.html            markup shell: topbar, drawer, footer, tab bar, modals
ambient-light.js      THE DROP-IN MODULE — copy this into any site
ambient-light.html    live demo + docs for the module
css/
  base.css            design tokens, skin surface variables, reset
  skins/*.css         the five skins
  layout.css          topbar, nav, drawer, footer, mobile tab bar
  components.css      cards, rails, chips, buttons, skeletons, toasts, modal
  pages.css           hero, browse, detail, schedule, library, settings
  player.css          watch layout + player chrome
js/
  config.js           sources, API settings, defaults — tweak here first
  util.js             DOM + formatting helpers, escaping, generated posters
  api.js              Jikan client: queue, retry, cache, breaker, normalizers
  store.js            localStorage: settings, watchlist, progress, history
  router.js           hash router with per-route containers
  components.js       shared HTML builders (cards, rails, states, icons)
  player.js           the video player
  toast.js            toasts + topbar load bar
  pages/              home, browse, info, watch, library, schedule, settings
data/fallback.json    offline demo catalog
video/demo.webm       bundled clip for the default player source
```

Each route renders into its own container, so a slow page that's still
awaiting when you navigate away can't clobber the page that replaced it.

---

## Notes

- No dependencies. hls.js is pulled from a CDN only when an HLS stream is
  actually played.
- Two themes: **ink** (bone on near-black) and **paper** (inverted, like printed
  stock). Follows the system setting if you pick "Follow system".
- Type is Anton for display and Space Grotesk for everything else, both from
  Google Fonts.
- Respects `prefers-reduced-motion`, and there's a "reduce motion" toggle that
  also stops the hero auto-rotating.
- Keyboard-navigable throughout, with focus rings, skip link and ARIA labels.

Independent project. Not affiliated with any studio, publisher or streaming
service.
