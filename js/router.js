/* Kitsu Live — hash router (GitHub-Pages friendly, no server rewrites). */

const routes = [];
let current = null;
let activeView = null;

export function route(pattern, loader) {
  const names = [];
  const rx = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, n) => { names.push(n); return '([^/?]+)'; }) + '$');
  routes.push({ rx, names, loader, pattern });
}

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path: path.startsWith('/') ? path : '/' + path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function go(to, { replace = false } = {}) {
  const next = to.startsWith('#') ? to : '#' + (to.startsWith('/') ? to : '/' + to);
  if (location.hash === next) { resolve(); return; }
  if (replace) history.replaceState(null, '', next);
  else location.hash = next;
}

export function buildQuery(obj) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v != null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? '?' + s : '';
}

export const currentRoute = () => current;

let gen = 0;

export async function resolve() {
  const myGen = ++gen;
  const { path, query } = parseHash();
  const mount = document.getElementById('main');

  for (const r of routes) {
    const m = path.match(r.rx);
    if (!m) continue;
    const params = Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
    const prev = current;
    current = { path, query, params, pattern: r.pattern };

    /* tear down the previous view (players, timers, observers) */
    if (activeView?.destroy) { try { activeView.destroy(); } catch {} }
    activeView = null;

    /* Each route renders into its own container. A slow page that is still
       awaiting when the user navigates away keeps writing into its own
       detached node instead of clobbering the new page. */
    const host = document.createElement('div');
    host.className = 'route-view';
    mount.replaceChildren(host);

    const samePage = prev && prev.pattern === r.pattern && prev.path === path;
    document.dispatchEvent(new CustomEvent('route:before', { detail: { current, samePage } }));

    let view = null;
    try {
      view = (await r.loader({ mount: host, params, query, samePage, alive: () => gen === myGen })) || null;
    } catch (err) {
      if (gen !== myGen) return;              // navigated away; let the new route speak
      console.error('[kitsu-live] route failed', err);
      host.innerHTML = `<div class="state">
        <div class="state__icon" style="color:var(--bad)">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/></svg>
        </div>
        <h3>Something broke on this page</h3>
        <p>${String(err?.message || err).slice(0, 180)}</p>
        <a class="btn btn--ghost" href="#/">Back home</a></div>`;
    }

    if (gen !== myGen) { try { view?.destroy?.(); } catch {} return; }
    activeView = view;
    document.dispatchEvent(new CustomEvent('route:after', { detail: { current } }));
    return;
  }

  if (gen !== myGen) return;
  mount.innerHTML = `<div class="state">
    <div class="state__icon">404</div>
    <h3>No page here</h3><p>That link doesn't go anywhere in Kitsu Live.</p>
    <a class="btn btn--primary" href="#/">Back home</a></div>`;
  document.dispatchEvent(new CustomEvent('route:after', { detail: { current } }));
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
