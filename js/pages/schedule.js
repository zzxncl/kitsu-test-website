/* Kitsu Live — weekly airing schedule. */
import { api, DAYS } from '../api.js';
import { ICON, svg, displayTitle, emptyState, demoNotice } from '../components.js';
import { onApiState } from '../api.js';
import { $, $$, esc, imgTag, genPoster, setMeta, titleCase } from '../util.js';
import { go, buildQuery } from '../router.js';

export default async function schedule({ mount, query }) {
  setMeta('Airing schedule');
  const todayIdx = (new Date().getDay() + 6) % 7;      // Mon=0
  const day = DAYS.includes(query.day) ? query.day : DAYS[todayIdx];

  mount.innerHTML = `
    <div class="page-head">
      <h1>Airing schedule</h1>
      <p>Broadcast times are the Japanese air slot (JST), as published by the source.</p>
    </div>
    <div class="page-body">
      <div id="schedNotice"></div>
      <div class="sched-days">
        ${DAYS.map((d, i) => `<button class="sched-day ${d === day ? 'is-active' : ''} ${i === todayIdx ? 'is-today' : ''}" data-day="${d}">
          <b>${titleCase(d).slice(0, 3)}</b><small>${i === todayIdx ? 'Today' : titleCase(d)}</small></button>`).join('')}
      </div>
      <div id="schedBody" style="margin-top:1.4rem"><div class="sk" style="height:300px"></div></div>
    </div>`;

  const offNotice = onApiState((s) => { $('#schedNotice', mount).innerHTML = s.demo ? demoNotice() : ''; });
  $$('[data-day]', mount).forEach((b) =>
    b.addEventListener('click', () => go('/schedule' + buildQuery({ day: b.dataset.day }))));

  const items = await api.schedule(day, 25);
  const host = $('#schedBody', mount);

  if (!items.length) {
    host.innerHTML = emptyState('Nothing scheduled', `No broadcasts listed for ${titleCase(day)}.`);
    return { destroy: offNotice };
  }

  /* group by broadcast time */
  const buckets = new Map();
  for (const a of items) {
    const m = (a.broadcast || '').match(/(\d{1,2}:\d{2})/);
    const key = m ? m[1] : 'TBA';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(a);
  }
  const keys = [...buckets.keys()].sort((x, y) => (x === 'TBA' ? 1 : y === 'TBA' ? -1 : x.localeCompare(y)));

  host.innerHTML = `<div class="timeline">${keys.map((k) => `
    <div class="timeslot">
      <div class="timeslot__time">${esc(k)}</div>
      <div class="timeslot__items">
        ${buckets.get(k).map((a) => {
          const t = displayTitle(a);
          return `<a class="schedrow" href="#/anime/${a.id}">
            <span class="schedrow__art">${imgTag(a.poster || genPoster(t), t, t)}</span>
            <span class="schedrow__info">
              <b>${esc(t)}</b>
              <small>${esc(a.type)}${a.episodes ? ` · ${a.episodes} ep` : ''}${a.score ? ` · ★ ${a.score.toFixed(2)}` : ''}</small>
            </span>
            ${a.airing ? '<span class="chip chip--live"><span class="dot dot--pulse"></span>Airing</span>' : ''}
          </a>`;
        }).join('')}
      </div>
    </div>`).join('')}</div>`;

  return { destroy: offNotice };
}
