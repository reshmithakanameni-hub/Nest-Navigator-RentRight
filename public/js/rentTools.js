import { apiRequest } from './api.js';
import { byId, toast } from './dom.js';
import { money } from './format.js';
import { store } from './store.js';

// All calculations run on the server so rules live in one tested place.
export async function calculateCosts() {
  const params = new URLSearchParams({
    rent: byId('rent').value || '0', deposit: byId('deposit').value || '0',
    maintenance: byId('maintenance').value || '0', income: byId('income').value || '0'
  });
  try {
    const result = await apiRequest(`/api/tools/affordability?${params}`);
    byId('total').textContent = money(result.moveInCost);
    byId('afford').textContent = result.message;
  } catch (error) {
    byId('afford').textContent = error.message;
  }
}

export async function showNeighborhood() {
  try {
    const result = await apiRequest(`/api/neighborhoods/${encodeURIComponent(byId('neighborhood').value)}`);
    byId('scores').innerHTML = result.scores
      .map(item => `<div class="score"><b>${item.score}/5</b><span>${item.label}</span></div>`)
      .join('');
  } catch (error) {
    byId('scores').textContent = error.message;
  }
}

export async function estimateCommute() {
  const destination = byId('destination').value.trim();
  if (!destination) return toast('Enter a destination first.');
  const home = store.allHomes.find(item => store.saved.includes(item.id)) || store.allHomes[0];
  if (!home) return toast('Listings are still loading. Try again shortly.');
  const params = new URLSearchParams({ propertyId: String(home.id), mode: byId('mode').value, destination });
  try {
    const result = await apiRequest(`/api/tools/commute?${params}`);
    byId('commuteResult').textContent = `Estimate from ${result.area} to ${result.destination}: about ${result.minutes} minutes (${result.mode}). ${result.note}`;
  } catch (error) {
    toast(error.message);
  }
}

export function setupRentTools() {
  byId('calculate').onclick = calculateCosts;
  byId('neighborhood').onchange = showNeighborhood;
  byId('commute').onclick = estimateCommute;
  calculateCosts();
  showNeighborhood();
}
