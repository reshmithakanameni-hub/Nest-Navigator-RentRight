import { apiRequest } from './api.js';
import { byId, openModal, toast } from './dom.js';
import { escapeHTML, money } from './format.js';
import { findHome, store } from './store.js';

const MAX_COMPARE = 3;

// Pure helper: the rows shown in the side-by-side table.
export const comparisonRows = [
  ['Area', home => home.area],
  ['Monthly rent', home => money(home.rent)],
  ['Deposit', home => money(home.deposit)],
  ['BHK', home => home.bhk],
  ['Furnishing', home => home.furnishing],
  ['Size', home => `${home.size} sq.ft.`],
  ['Maintenance', home => money(home.maintenance)],
  ['Pets', home => (home.pets ? 'Yes' : 'No')],
  ['Parking', home => (home.parking ? 'Yes' : 'No')]
];

export function toggleCompare(id) {
  if (store.compareIds.includes(id)) {
    store.compareIds = store.compareIds.filter(existing => existing !== id);
    return true;
  }
  if (store.compareIds.length >= MAX_COMPARE) {
    toast('Compare up to three homes.');
    return false;
  }
  store.compareIds.push(id);
  return true;
}

export function renderCompareSummary() {
  const selected = store.compareIds.map(findHome).filter(Boolean);
  byId('compareResult').innerHTML = selected.length
    ? `<b>${selected.length} selected</b><br>${selected
        .map(home => `${escapeHTML(home.name)}: ${money(home.rent)}/mo · ${home.bhk} BHK · ${escapeHTML(home.area)}`)
        .join('<br>')}`
    : 'Your comparison will appear here.';
}

export function renderComparisonTable(properties, lowestId) {
  const header = properties.map(home => `<th>${escapeHTML(home.name)}${home.id === lowestId ? ' ★' : ''}</th>`).join('');
  const rows = comparisonRows
    .map(([label, read]) => {
      const cells = properties.map(home => `<td style="padding:12px;border:1px solid #ddd">${escapeHTML(read(home))}</td>`);
      return `<tr><td style="padding:12px;border:1px solid #ddd"><b>${label}</b></td>${cells.join('')}</tr>`;
    })
    .join('');
  return `<h2>Side-by-side comparison</h2><div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12px"><tr><th>Feature</th>${header}</tr>${rows}</table></div><p class="muted">★ lowest monthly cost (rent + maintenance), calculated by the server.</p>`;
}

export async function openComparison() {
  const ids = store.compareIds.length ? store.compareIds : store.saved.slice(0, MAX_COMPARE);
  if (ids.length < 2) return toast('Save or select at least two homes.');
  try {
    const result = await apiRequest(`/api/properties/compare?ids=${ids.join(',')}`);
    openModal(renderComparisonTable(result.properties, result.lowestMonthlyCostId));
  } catch (error) {
    toast(error.message);
  }
}
