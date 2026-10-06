# Kitsu Live

A fast, keyboard-friendly anime discovery front-end. Browse, search, track what
you're watching, and play episodes in a custom-built player — all in the
browser, with no build step, no framework, and no account.

Vanilla ES modules, hash routing, ~1,200 lines of hand-written CSS. Drop it on
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
<kbd>N</kbd>/<kbd>P</kbd> next/previous episode, <kbd>0</kbd>–<kbd>9</kbd> jump
to percent, <kbd>,</kbd>/<kbd>.</kbd> speed.

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

Three stubs ship by default:

| Server | What it does |
|---|---|
| **Demo clip** | A public test HLS stream, so you can feel the player out immediately |
| **Local file** | Looks for `video/ep-<n>.mp4` next to `index.html` |
| **Custom** | Paste any direct `.mp4` / `.m3u8` URL on the watch page |

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
css/
  base.css            design tokens, both themes, reset
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
```

Each route renders into its own container, so a slow page that's still
awaiting when you navigate away can't clobber the page that replaced it.

---

## Notes

- No dependencies. hls.js is pulled from a CDN only when an HLS stream is
  actually played.
- Theme follows the system setting if you pick "Follow system"; otherwise it's
  whatever you chose, remembered.
- Respects `prefers-reduced-motion`, and there's a "reduce motion" toggle that
  also stops the hero auto-rotating.
- Keyboard-navigable throughout, with focus rings, skip link and ARIA labels.

Independent project. Not affiliated with any studio, publisher or streaming
service.
