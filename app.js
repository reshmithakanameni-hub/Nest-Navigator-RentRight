// Browser entry point: wires the feature modules together. No business logic lives here.
import { apiRequest } from './public/js/api.js';
import { byId, query, toast, closeModal } from './public/js/dom.js';
import { escapeHTML, money } from './public/js/format.js';
import { store } from './public/js/store.js';
import { applyFilters, loadCatalogue, renderListings } from './public/js/listings.js';
import { toggleSaved } from './public/js/shortlist.js';
import { openComparison, renderCompareSummary, toggleCompare } from './public/js/compare.js';
import { showDetails, showTour } from './public/js/tour.js';
import { setupLease } from './public/js/lease.js';
import { setupRentTools } from './public/js/rentTools.js';
import { setupSmartMatch } from './public/js/smartMatch.js';
import { setupVisitBooking } from './public/js/visitBooking.js';
import { setupAccountWorkspace } from './public/js/accountWorkspace.js';
import { setupMapSearch } from './public/js/mapSearch.js';

const FILTER_IDS = ['search', 'maxRent', 'bhk', 'furnishing', 'sort', 'pets', 'parking'];
const FILTER_DEBOUNCE_MS = 250;
const SAMPLE_TOUR_ID = 1;

function debounce(callback, delay) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(callback, delay);
  };
}

function runFilters() {
  applyFilters().catch(error => toast(error.message));
}

function resetFilters() {
  ['search', 'furnishing'].forEach(id => { byId(id).value = ''; });
  byId('maxRent').value = '999999';
  byId('bhk').value = '0';
  byId('sort').value = 'featured';
  byId('pets').checked = false;
  byId('parking').checked = false;
  runFilters();
}

// One delegated handler for the buttons rendered inside property cards and modals.
function handleDocumentClick(event) {
  const target = event.target;
  if (target.closest('[data-scroll-visit]')) {
    closeModal();
    byId('visit').scrollIntoView({ behavior: 'smooth' });
  }
  const save = target.closest('[data-save]');
  const compare = target.closest('[data-compare]');
  const details = target.closest('[data-details]');
  const tour = target.closest('[data-tour]');
  if (save) toggleSaved(Number(save.dataset.save), renderListings);
  if (compare && toggleCompare(Number(compare.dataset.compare))) {
    renderListings();
    renderCompareSummary();
  }
  if (details) showDetails(Number(details.dataset.details));
  if (tour) showTour(Number(tour.dataset.tour));
}

function setupFilters() {
  const onFilterChange = debounce(runFilters, FILTER_DEBOUNCE_MS);
  FILTER_IDS.forEach(id => byId(id).addEventListener('input', onFilterChange));
  byId('reset').onclick = resetFilters;
}

function setupChrome() {
  document.addEventListener('click', handleDocumentClick);
  byId('compare').onclick = openComparison;
  byId('openTour').onclick = () => showTour(SAMPLE_TOUR_ID);
  byId('closeModal').onclick = closeModal;
  byId('modal').addEventListener('click', event => { if (event.target === byId('modal')) closeModal(); });
  byId('menu').onclick = () => query('.top nav').classList.toggle('mobile-open');
}

async function start() {
  setupChrome();
  setupFilters();
  setupLease();
  setupRentTools();
  setupSmartMatch({ $: query, apiRequest, escapeHTML, money, toast });
  const visitBooking = setupVisitBooking({ $: query, apiRequest, toast });
  const account = setupAccountWorkspace({
    $: query, apiRequest, escapeHTML, toast,
    render: renderListings,
    setSaved: ids => { store.saved = ids; },
    setUser: user => { store.user = user; }
  });
  const map = setupMapSearch({ $: query, apiRequest, escapeHTML, money, toast, getHomes: () => store.allHomes });
  try {
    visitBooking.updateProperties(await loadCatalogue());
    map.refreshMarkers();
  } catch (error) {
    toast(`Listings could not be loaded: ${error.message}`);
  }
  await account.restoreSession();
}

start();
