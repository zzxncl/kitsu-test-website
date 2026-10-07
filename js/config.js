/* Kitsu Live — configuration.
 * Everything you'd realistically want to tweak lives here.
 */
export const CONFIG = {
  appName: 'Kitsu Live',
  tagline: 'Find something worth staying up for.',

  /* Catalog metadata source. Jikan is the free, unofficial MyAnimeList API
     (no key, rate limited to ~3 req/s). */
  api: {
    base: 'https://api.jikan.moe/v4',
    minGapMs: 400,     // spacing between requests, keeps us under the limit
    retries: 3,
    retryBaseMs: 900,
    timeoutMs: 12000,
    cacheTtlMs: 30 * 60 * 1000,
    cacheMax: 300,
  },

  /* ── Video sources ─────────────────────────────────────────────────────
   * Kitsu Live hosts no video. The player is a real player — it just needs
   * something to point at. Add your own resolver here.
   *
   * Each server is { id, label, kind, resolve(ctx) } where ctx is
   * { malId, title, episode, dub } and resolve returns either
   *   null                                  -> "no source" screen
   *   { src, type?, poster?, tracks?[], intro?: {start,end} }
   *
   * `type` may be 'video/mp4' or 'application/x-mpegURL' (HLS needs
   * hls.js or a Safari/iOS browser — see loadHls() in player.js).
   */
  servers: [
    {
      id: 'demo',
      label: 'Demo clip',
      kind: 'webm',
      note: 'A short generated clip bundled with the site — no network needed. Good for seeing the ambient light work.',
      resolve: () => ({
        src: 'video/demo.webm',
        type: 'video/webm',
        intro: { start: 2, end: 6 },
      }),
    },
    {
      id: 'hls',
      label: 'HLS test',
      kind: 'hls',
      note: 'A public test stream — exercises the hls.js path (needs network).',
      resolve: () => ({
        src: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        type: 'application/x-mpegURL',
      }),
    },
    {
      id: 'local',
      label: 'Local file',
      kind: 'mp4',
      note: 'Drop video/ep-<n>.mp4 next to index.html.',
      resolve: ({ episode }) => ({ src: `video/ep-${episode}.mp4`, type: 'video/mp4' }),
    },
    {
      id: 'custom',
      label: 'Custom',
      kind: 'any',
      note: 'Paste any direct .mp4 / .m3u8 URL on the watch page.',
      resolve: ({ custom }) => (custom ? { src: custom, type: guessType(custom) } : null),
    },
  ],

  defaults: {
    skin: 'press',           // press | vault | neon | linen | noir
    theme: 'ink',            // ink | paper | system
    autoplay: false,
    autoNext: true,
    skipIntro: true,
    preferDub: false,
    volume: 1,
    muted: false,
    rate: 1,
    server: 'demo',
    ambient: 'full',          // off | soft | full | neon
    ambientFlood: true,       // let the glow wash the whole page, not just the frame
    reduceMotion: false,
    titleLang: 'romaji',   // 'romaji' | 'english'
  },

  /* fallback intro window when a source doesn't declare one */
  introGuess: { start: 60, end: 150 },

  /* how far from the end to offer "next episode" */
  nextEpLeadSec: 40,

  hlsCdn: 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js',
};

export function guessType(url = '') {
  const u = url.split('?')[0].toLowerCase();
  if (u.endsWith('.m3u8')) return 'application/x-mpegURL';
  if (u.endsWith('.mpd')) return 'application/dash+xml';
  if (u.endsWith('.webm')) return 'video/webm';
  if (u.endsWith('.ogv')) return 'video/ogg';
  return 'video/mp4';
}

export const STORAGE_PREFIX = 'kitsulive:';
