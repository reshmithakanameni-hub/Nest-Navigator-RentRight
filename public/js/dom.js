// Small DOM helpers shared by every browser module.
export const byId = id => document.getElementById(id);
export const query = selector => document.querySelector(selector);

let toastTimer;
export function toast(message) {
  const element = byId('toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('show'), 2400);
}

export function openModal(html) {
  byId('modalContent').innerHTML = html;
  byId('modal').hidden = false;
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  byId('modal').hidden = true;
  document.body.style.overflow = '';
  if (window.pano) {
    window.pano.destroy();
    window.pano = null;
  }
}
