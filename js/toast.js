/* Kitsu Live — toasts + the tiny topbar load bar. */
import { $ } from './util.js';

const ICONS = {
  ok:   '<path d="M20 6 9 17l-5-5"/>',
  bad:  '<circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
};

export function toast(msg, kind = 'info', ms = 3200) {
  const host = $('#toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.innerHTML = `<svg class="toast__icon" viewBox="0 0 24 24">${ICONS[kind] || ICONS.info}</svg><span></span>`;
  node.querySelector('span').textContent = msg;
  host.append(node);
  const kill = () => {
    node.classList.add('is-out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };
  const t = setTimeout(kill, ms);
  node.addEventListener('click', () => { clearTimeout(t); kill(); });
}

let pending = 0, barTimer = null;
export function loading(on) {
  const bar = $('#loadBar');
  pending = Math.max(0, pending + (on ? 1 : -1));
  if (!bar) return;
  clearTimeout(barTimer);
  if (pending > 0) {
    bar.classList.add('is-active');
    bar.style.width = '72%';
  } else {
    bar.style.width = '100%';
    barTimer = setTimeout(() => {
      bar.classList.remove('is-active');
      bar.style.width = '0';
    }, 220);
  }
}
