// Small DOM helpers: escaping, toasts, bottom sheets and confirm dialogs.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let toastTimer = null;
export function toast(msg, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.className = `toast toast-${type} show`;
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = `toast toast-${type}`; }, type === 'error' ? 4200 : 2400);
}

// Bottom sheet with arbitrary HTML. Buttons with data-sheet="value" resolve the promise.
export function sheet(html, { onMount, dismissable = true } = {}) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="sheet-grip"></div>${html}</div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const close = (val) => {
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 260);
      resolve(val);
    };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sheet]');
      if (b) { e.preventDefault(); close(b.dataset.sheet === 'false' ? false : b.dataset.sheet === 'true' ? true : b.dataset.sheet); }
      else if (dismissable && e.target.classList.contains('sheet-backdrop')) close(null);
    });
    if (onMount) onMount(wrap.querySelector('.sheet'), close);
  });
}

export function confirmDialog(message, { ok = 'Confirm', cancel = 'Cancel', danger = false, title = 'Are you sure?' } = {}) {
  return sheet(`<h3 class="sheet-title">${esc(title)}</h3><p class="sheet-text">${esc(message)}</p>
    <div class="sheet-actions"><button class="btn ghost" data-sheet="false">${esc(cancel)}</button>
    <button class="btn ${danger ? 'danger' : 'primary'}" data-sheet="true">${esc(ok)}</button></div>`).then((v) => v === true);
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString('en-GB');
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
