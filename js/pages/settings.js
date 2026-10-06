/* Kitsu Live — settings, data export/import, cache controls. */
import { CONFIG } from '../config.js';
import {
  getSettings, setSetting, resetSettings, exportAll, importAll, wipeAll,
  cacheClear, getListArray, clearHistory, getHistory, onStoreChange,
} from '../store.js';
import { ICON, svg } from '../components.js';
import { $, $$, esc, attr, setMeta } from '../util.js';
import { toast } from '../toast.js';
import { api } from '../api.js';

export default async function settings({ mount }) {
  setMeta('Settings');

  function render() {
    const s = getSettings();
    mount.innerHTML = `
      <div class="page-head">
        <h1>Settings</h1>
        <p>Everything here is stored in this browser. No account, no sync, no telemetry.</p>
      </div>
      <div class="page-body">
        <div class="settings-grid">

          <div class="panel">
            <h3>Appearance</h3>
            <div class="setting-row">
              <div class="setting-row__text"><b>Theme</b><small>Ink on bone, or inverted to paper stock.</small></div>
              <select class="select" data-set="theme">
                <option value="ink" ${s.theme === 'ink' || s.theme === 'dark' ? 'selected' : ''}>Ink</option>
                <option value="paper" ${s.theme === 'paper' || s.theme === 'light' ? 'selected' : ''}>Paper</option>
                <option value="system" ${s.theme === 'system' ? 'selected' : ''}>Follow system</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-row__text"><b>Title language</b><small>Romaji or English, wherever both exist.</small></div>
              <select class="select" data-set="titleLang">
                <option value="romaji" ${s.titleLang === 'romaji' ? 'selected' : ''}>Romaji</option>
                <option value="english" ${s.titleLang === 'english' ? 'selected' : ''}>English</option>
              </select>
            </div>
            <label class="switch">
              <input type="checkbox" data-set="reduceMotion" ${s.reduceMotion ? 'checked' : ''}>
              <span class="switch__track"></span>
              <span class="switch__text"><b>Reduce motion</b><small>Stops the hero from auto-rotating and kills the slow zoom.</small></span>
            </label>
          </div>

          <div class="panel">
            <h3>Playback</h3>
            <label class="switch">
              <input type="checkbox" data-set="autoplay" ${s.autoplay ? 'checked' : ''}>
              <span class="switch__track"></span>
              <span class="switch__text"><b>Autoplay</b><small>Start the episode as soon as a source loads.</small></span>
            </label>
            <label class="switch">
              <input type="checkbox" data-set="autoNext" ${s.autoNext ? 'checked' : ''}>
              <span class="switch__track"></span>
              <span class="switch__text"><b>Auto next episode</b><small>Roll into the next one with a countdown.</small></span>
            </label>
            <label class="switch">
              <input type="checkbox" data-set="skipIntro" ${s.skipIntro ? 'checked' : ''}>
              <span class="switch__track"></span>
              <span class="switch__text"><b>Offer “skip intro”</b><small>Shows a button over the opening window.</small></span>
            </label>
            <label class="switch">
              <input type="checkbox" data-set="preferDub" ${s.preferDub ? 'checked' : ''}>
              <span class="switch__track"></span>
              <span class="switch__text"><b>Prefer dub</b><small>Default the audio toggle to dub where a server offers it.</small></span>
            </label>
            <div class="setting-row">
              <div class="setting-row__text"><b>Ambient light</b><small>Bleeds the picture's colour out around the player.</small></div>
              <select class="select" data-set="ambient">
                <option value="off"  ${s.ambient === 'off' ? 'selected' : ''}>Off</option>
                <option value="soft" ${s.ambient === 'soft' ? 'selected' : ''}>Soft</option>
                <option value="full" ${s.ambient === 'full' || !s.ambient ? 'selected' : ''}>Full</option>
                <option value="neon" ${s.ambient === 'neon' ? 'selected' : ''}>Neon</option>
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-row__text"><b>Default speed</b><small>Applies to every new episode.</small></div>
              <select class="select" data-set="rate">
                ${[0.75, 1, 1.25, 1.5, 2].map((r) => `<option value="${r}" ${Number(s.rate) === r ? 'selected' : ''}>${r === 1 ? 'Normal' : r + '×'}</option>`).join('')}
              </select>
            </div>
            <div class="setting-row">
              <div class="setting-row__text"><b>Default server</b><small>Where the watch page starts looking.</small></div>
              <select class="select" data-set="server">
                ${CONFIG.servers.map((sv) => `<option value="${attr(sv.id)}" ${s.server === sv.id ? 'selected' : ''}>${esc(sv.label)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="panel">
            <h3>Sources</h3>
            <p style="font-size:.86rem;color:var(--ink-2);margin-bottom:.8rem">
              Kitsu Live hosts no video. Each server below is a resolver stub in
              <code>js/config.js</code> — point them wherever you have the rights to play from.
            </p>
            <div class="statlist">
              ${CONFIG.servers.map((sv) => `<div>
                <span class="statlist__k">${esc(sv.label)}</span>
                <span class="statlist__v" style="font-size:.8rem;color:var(--ink-3)">${esc(sv.note || sv.kind)}</span>
              </div>`).join('')}
            </div>
            <div class="notice notice--info" style="margin-top:.9rem">
              ${svg(ICON.info)}
              <div>Metadata comes from the <b>Jikan</b> API (MyAnimeList). Status:
              <b style="color:${api.state.demo ? 'var(--warn)' : 'var(--ok)'}">${api.state.demo ? 'offline — using the bundled demo catalog' : 'live'}</b>.</div>
            </div>
          </div>

          <div class="panel">
            <h3>Your data</h3>
            <p style="font-size:.86rem;color:var(--ink-2)">
              ${getListArray().length} titles in your library · ${getHistory().length} saved searches.
            </p>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem">
              <button class="btn btn--ghost btn--sm" id="exportBtn">${svg(ICON.download)} Export backup</button>
              <button class="btn btn--ghost btn--sm" id="importBtn">Import backup</button>
              <button class="btn btn--ghost btn--sm" id="cacheBtn">Clear metadata cache</button>
              <button class="btn btn--ghost btn--sm" id="histBtn">Clear search history</button>
            </div>
            <input type="file" id="importFile" accept="application/json" hidden>
            <hr style="border:0;border-top:1px solid var(--line);margin:1rem 0">
            <div style="display:flex;gap:.5rem;flex-wrap:wrap">
              <button class="btn btn--danger btn--sm" id="resetBtn">Reset settings</button>
              <button class="btn btn--danger btn--sm" id="wipeBtn">${svg(ICON.trash)} Erase everything</button>
            </div>
          </div>

        </div>
      </div>`;

    /* bindings */
    $$('[data-set]', mount).forEach((ctl) => {
      ctl.addEventListener('change', () => {
        const key = ctl.dataset.set;
        const val = ctl.type === 'checkbox' ? ctl.checked
          : (key === 'rate' ? Number(ctl.value) : ctl.value);
        setSetting(key, val);
        if (key === 'theme') document.dispatchEvent(new CustomEvent('theme:apply'));
        toast('Saved', 'ok', 1400);
      });
    });

    $('#exportBtn', mount).addEventListener('click', () => {
      const blob = new Blob([exportAll()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kitsu-live-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Backup downloaded', 'ok');
    });
    $('#importBtn', mount).addEventListener('click', () => $('#importFile', mount).click());
    $('#importFile', mount).addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        importAll(await file.text());
        toast('Backup restored', 'ok');
        render();
      } catch (err) { toast(`Import failed: ${err.message}`, 'bad'); }
    });
    $('#cacheBtn', mount).addEventListener('click', () => { cacheClear(); toast('Metadata cache cleared', 'ok'); });
    $('#histBtn', mount).addEventListener('click', () => { clearHistory(); toast('Search history cleared', 'ok'); render(); });
    $('#resetBtn', mount).addEventListener('click', () => {
      resetSettings();
      document.dispatchEvent(new CustomEvent('theme:apply'));
      toast('Settings reset'); render();
    });
    $('#wipeBtn', mount).addEventListener('click', () => {
      if (!confirm('Erase your library, progress, settings and cache from this browser? This cannot be undone.')) return;
      wipeAll();
      document.dispatchEvent(new CustomEvent('theme:apply'));
      toast('Everything erased'); render();
    });
  }

  render();
  const off = onStoreChange((w) => { if (w === 'all') render(); });
  return { destroy: off };
}
