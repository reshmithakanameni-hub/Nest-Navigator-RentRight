// Map-based search: pick a landmark or click the map, choose a radius, and the API returns the
// homes inside that circle sorted by distance. Leaflet (loaded from a CDN) draws the map; if it
// cannot load, the landmark/radius controls and the result list still work.
const DEFAULT_CENTER = { lat: 17.4435, lng: 78.3772 };

// Pure helper (unit-tested): builds the query string for /api/properties/nearby.
export function buildNearbyQuery({ lat, lng, radiusKm, maxRent, bhk }) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), radiusKm: String(radiusKm) });
  if (maxRent && maxRent < 999999) params.set('maxRent', String(maxRent));
  if (bhk) params.set('bhk', String(bhk));
  return params.toString();
}

export function setupMapSearch({ $, apiRequest, escapeHTML, money, toast, getHomes }) {
  const select = $('#landmarkSelect'), radius = $('#radiusKm'), results = $('#nearResults');
  if (!select || !radius || !results) return { refreshMarkers() {} };
  const L = window.L;
  let landmarks = [], map = null, circle = null, centerMarker = null, markerLayer = null, center = DEFAULT_CENTER;

  if (L && $('#nearMap')) {
    map = L.map('nearMap', { scrollWheelZoom: false }).setView([center.lat, center.lng], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    map.on('click', event => { select.value = ''; setCenter({ lat: event.latlng.lat, lng: event.latlng.lng }); });
  } else if ($('#nearMap')) {
    $('#nearMap').hidden = true;
    $('#mapFallback').hidden = false;
  }

  function popup(home) {
    return `<b>${escapeHTML(home.name)}</b><br>${escapeHTML(home.area)} · ${money(home.rent)}/month<br><button type="button" class="btn dark" data-details="${Number(home.id)}">Details</button>`;
  }

  function refreshMarkers() {
    if (!map) return;
    markerLayer.clearLayers();
    getHomes().filter(home => home.lat != null && home.lng != null)
      .forEach(home => L.marker([home.lat, home.lng]).bindPopup(popup(home)).addTo(markerLayer));
  }

  function drawCircle() {
    if (!map) return;
    if (circle) circle.remove();
    if (centerMarker) centerMarker.remove();
    circle = L.circle([center.lat, center.lng], { radius: Number(radius.value) * 1000, color: '#18372c', weight: 2, fillOpacity: 0.08 }).addTo(map);
    centerMarker = L.circleMarker([center.lat, center.lng], { radius: 6, color: '#b8864b', fillOpacity: 1 }).addTo(map);
    map.fitBounds(circle.getBounds(), { maxZoom: 14 });
  }

  async function runSearch() {
    $('#radiusValue').textContent = `${radius.value} km`;
    results.textContent = 'Searching…';
    try {
      const query = buildNearbyQuery({ ...center, radiusKm: radius.value, maxRent: Number($('#maxRent').value), bhk: Number($('#bhk').value) });
      const data = await apiRequest(`/api/properties/nearby?${query}`);
      results.innerHTML = data.properties.length
        ? data.properties.map(home => `<article class="near-item"><div><b>${escapeHTML(home.name)}</b><br><small>${escapeHTML(home.area)}, ${escapeHTML(home.city)} · ${home.bhk} BHK · ${money(home.rent)}/month</small></div><div><b>${home.distanceKm} km</b><br><button type="button" class="btn outline" data-details="${Number(home.id)}">Details</button></div></article>`).join('')
        : `No homes within ${escapeHTML(radius.value)} km. Increase the radius or pick another point.`;
      drawCircle();
    } catch (error) { results.textContent = error.message; }
  }

  function setCenter(point) { center = point; runSearch(); }

  radius.addEventListener('input', () => { $('#radiusValue').textContent = `${radius.value} km`; });
  radius.addEventListener('change', runSearch);
  select.addEventListener('change', () => {
    const landmark = landmarks.find(item => item.id === select.value);
    if (landmark) setCenter({ lat: landmark.lat, lng: landmark.lng });
  });
  $('#mapRefresh').onclick = runSearch;

  apiRequest('/api/landmarks').then(data => {
    landmarks = data.landmarks;
    select.innerHTML = '<option value="">Choose a landmark…</option>' + landmarks.map(item => `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)} · ${escapeHTML(item.city)}</option>`).join('');
    select.value = 'hitech-city';
    setCenter({ lat: landmarks[0].lat, lng: landmarks[0].lng });
  }).catch(error => toast(error.message));

  return { refreshMarkers };
}
