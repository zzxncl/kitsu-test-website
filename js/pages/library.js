/* Kitsu Live — your library: watchlist buckets + continue watching. */
import {
  getListArray, LIST_STATUS, continueWatching, onStoreChange,
  removeFromList, addToList, clearProgress, seenEpisodes,
} from '../store.js';
import { cardHTML, resumeCardHTML, emptyState, ICON, svg, displayTitle } from '../components.js';
import { $, $$, esc, setMeta, fmtCount } from '../util.js';
import { go, buildQuery } from '../router.js';
import { toast } from '../toast.js';

export default async function library({ mount, query }) {
  setMeta('Your library');
  const tab = query.tab || 'all';

  function render() {
    const all = getListArray();
    const resume = continueWatching(24);
    const counts = Object.fromEntries(LIST_STATUS.map((s) => [s.id, all.filter((r) => r.status === s.id).length]));
    const episodesWatched = resume.reduce((n, r) => n + seenEpisodes(r.id).size, 0);

    const rows = tab === 'all' ? all
      : tab === 'watching' ? all.filter((r) => r.status === 'watching')
      : all.filter((r) => r.status === tab);

    mount.innerHTML = `
      <div class="page-head">
        <h1>Your library</h1>
        <p>Saved on this device only — nothing is uploaded anywhere.</p>
      </div>
      <div class="page-body">
        <div class="lib-stats">
          <div class="statcard"><b>${all.length}</b><small>Titles saved</small></div>
          <div class="statcard"><b>${counts.watching || 0}</b><small>Watching</small></div>
          <div class="statcard"><b>${counts.completed || 0}</b><small>Completed</small></div>
          <div class="statcard"><b>${fmtCount(episodesWatched)}</b><small>Episodes seen</small></div>
        </div>

        ${resume.length ? `
          <section class="section" style="margin-top:0">
            <div class="section__head" style="padding-inline:0">
              <div class="section__title">${svg(ICON.clock)}<h2>Pick up where you left off</h2></div>
            </div>
            <div class="grid-wide">${resume.map(resumeCardHTML).join('')}</div>
          </section>` : ''}

        <div class="lib-head" style="margin-top:2rem">
          <div class="tabs">
            <button data-tab="all" class="${tab === 'all' ? 'is-active' : ''}">All (${all.length})</button>
            ${LIST_STATUS.map((s) => `<button data-tab="${s.id}" class="${tab === s.id ? 'is-active' : ''}">${s.label} (${counts[s.id] || 0})</button>`).join('')}
          </div>
        </div>

        <div id="libGrid">
          ${rows.length
            ? `<div class="grid-posters">${rows.map((r) => `
                <div style="position:relative" data-entry="${r.id}">
                  ${cardHTML({ ...r.anime, id: r.id }, { showProgress: true })}
                  <div style="display:flex;gap:.3rem;margin-top:.4rem">
                    <select class="select" data-status="${r.id}" style="height:30px;font-size:.76rem;flex:1">
                      ${LIST_STATUS.map((s) => `<option value="${s.id}" ${r.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
                    </select>
                    <button class="icon-btn" data-remove="${r.id}" aria-label="Remove" style="width:30px;height:30px">${svg(ICON.trash)}</button>
                  </div>
                </div>`).join('')}</div>`
            : emptyState(
                tab === 'all' ? 'Your library is empty' : 'Nothing in this bucket',
                'Add anything you want to keep an eye on — it saves instantly, right here in your browser.',
                '<a class="btn btn--primary" href="#/browse">Find something to watch</a>')}
        </div>
      </div>`;

    $$('[data-tab]', mount).forEach((b) =>
      b.addEventListener('click', () => go('/library' + buildQuery({ tab: b.dataset.tab }))));

    $$('[data-status]', mount).forEach((sel) =>
      sel.addEventListener('change', (e) => {
        const entry = getListArray().find((r) => String(r.id) === sel.dataset.status);
        if (!entry) return;
        addToList({ ...entry.anime, id: entry.id }, e.target.value);
        toast(`Moved to ${LIST_STATUS.find((s) => s.id === e.target.value).label.toLowerCase()}`, 'ok');
      }));

    $$('[data-remove]', mount).forEach((b) =>
      b.addEventListener('click', () => {
        removeFromList(Number(b.dataset.remove) || b.dataset.remove);
        clearProgress(Number(b.dataset.remove) || b.dataset.remove);
        toast('Removed');
      }));
  }

  render();
  const off = onStoreChange(() => render());
  return { destroy: off };
}
