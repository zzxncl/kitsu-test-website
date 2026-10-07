/* KITSU/LIVE — home. Fetches everything once, then hands the data to the
   active layout, which decides what the page actually looks like. */
import { api, state as apiState } from '../api.js';
import { continueWatching, onStoreChange } from '../store.js';
import { current } from '../layouts/index.js';
import { CONFIG } from '../config.js';
import { setMeta } from '../util.js';

export default async function home({ mount }) {
  setMeta('', CONFIG.tagline);

  mount.innerHTML = `<div class="home-boot">
    <div class="sk" style="height:46vh"></div>
    <div class="sk sk--line w60" style="height:1.4rem;margin-top:1.4rem"></div>
    <div class="home-boot__row">${'<div class="sk sk--poster"></div>'.repeat(7)}</div>
  </div>`;

  const [trending, season, topRated, movies, upcoming, allTime, recent, genres] = await Promise.all([
    api.trending(24), api.seasonNow(24), api.topRated(24), api.topMovies(20),
    api.seasonUpcoming(20), api.allTime(10), api.recentEpisodes(14), api.genres(),
  ]);

  const data = {
    trending, season, topRated, movies, upcoming, allTime, recent, genres,
    spotlight: trending.filter((a) => a.synopsis).slice(0, 10),
    resume: continueWatching(12),
    demo: apiState.demo,
  };

  const layout = current();
  let view = layout.home(mount, data) || null;

  /* progress changes while you're on the page — refresh the resume strip */
  const off = onStoreChange((what) => {
    if (what !== 'progress') return;
    const next = continueWatching(12);
    if (next.length === data.resume.length) return;
    data.resume = next;
    try { view?.destroy?.(); } catch {}
    view = layout.home(mount, data) || null;
  });

  return { destroy() { try { view?.destroy?.(); } catch {} off(); } };
}
