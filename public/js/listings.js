import { apiRequest } from './api.js';
import { byId } from './dom.js';
import { escapeHTML, money } from './format.js';
import { propertyCard } from './propertyCard.js';
import { store } from './store.js';

const ANY_RENT = 999999;

// Pure helper: turns filter control values into the API query string.
export function buildQuery(filters) {
  const params = new URLSearchParams();
  if (filters.maxRent && filters.maxRent < ANY_RENT) params.set('maxRent', String(filters.maxRent));
  if (filters.bhk) params.set('bhk', String(filters.bhk));
  if (filters.furnishing) params.set('furnishing', filters.furnishing);
  if (filters.term && filters.term.trim()) params.set('area', filters.term.trim());
  if (filters.pets) params.set('pets', 'true');
  if (filters.parking) params.set('parking', 'true');
  if (filters.sort && filters.sort !== 'featured') params.set('sort', filters.sort);
  return params.toString();
}

export function readFilters() {
  return {
    term: byId('search').value,
    maxRent: Number(byId('maxRent').value),
    bhk: Number(byId('bhk').value),
    furnishing: byId('furnishing').value,
    sort: byId('sort').value,
    pets: byId('pets').checked,
    parking: byId('parking').checked
  };
}

const card = property => propertyCard(property, store, { escapeHTML, money });

export function renderListings() {
  byId('propertyGrid').innerHTML = store.visible.map(card).join('');
  byId('count').textContent = `Showing ${store.visible.length} of ${store.allHomes.length} sample listings`;
  byId('empty').hidden = store.visible.length > 0;
  renderShortlist();
}

export function renderShortlist() {
  const savedHomes = store.allHomes.filter(home => store.saved.includes(home.id));
  byId('shortlistGrid').innerHTML = savedHomes.map(card).join('');
  byId('shortlistEmpty').hidden = savedHomes.length > 0;
  byId('savedCount').textContent = store.saved.length;
}

// Loads every listing once so forms and lookups have the full catalogue.
export async function loadCatalogue() {
  const payload = await apiRequest('/api/properties');
  store.allHomes = payload.properties || [];
  store.visible = store.allHomes;
  renderListings();
  return store.allHomes;
}

// Filtering and sorting happen on the server. A counter drops stale responses.
let latestRequest = 0;
export async function applyFilters() {
  const requestNumber = ++latestRequest;
  const queryString = buildQuery(readFilters());
  const payload = await apiRequest(`/api/properties${queryString ? `?${queryString}` : ''}`);
  if (requestNumber !== latestRequest) return;
  store.visible = payload.properties || [];
  renderListings();
}
