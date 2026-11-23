'use strict';
const propertyRepository = require('../repositories/propertyRepository');

// Approximate landmark centres used as search origins (illustrative, not survey-accurate).
const LANDMARKS = [
  { id: 'hitech-city', name: 'HITEC City (Cyber Towers)', city: 'Hyderabad', lat: 17.4504, lng: 78.3810 },
  { id: 'financial-district', name: 'Financial District', city: 'Hyderabad', lat: 17.4172, lng: 78.3441 },
  { id: 'jntu-metro', name: 'JNTU Metro Station', city: 'Hyderabad', lat: 17.4930, lng: 78.3910 },
  { id: 'jubilee-hills', name: 'Jubilee Hills Check Post', city: 'Hyderabad', lat: 17.4326, lng: 78.4071 },
  { id: 'itpl', name: 'ITPL Whitefield', city: 'Bengaluru', lat: 12.9850, lng: 77.7280 },
  { id: 'bellandur', name: 'Bellandur / Outer Ring Road', city: 'Bengaluru', lat: 12.9370, lng: 77.6950 },
  { id: 'mg-road', name: 'MG Road', city: 'Bengaluru', lat: 12.9757, lng: 77.6070 }
];

function fail(message) { throw Object.assign(new Error(message), { status: 400 }); }

// Great-circle distance in kilometres (haversine formula).
function distanceKm(aLat, aLng, bLat, bLng) {
  const rad = degrees => (degrees * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function search(params) {
  const lat = Number(params.lat), lng = Number(params.lng);
  const radiusKm = params.radiusKm === undefined || params.radiusKm === '' ? 5 : Number(params.radiusKm);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180)
    fail('Provide a valid latitude and longitude.');
  if (!Number.isFinite(radiusKm) || radiusKm < 0.5 || radiusKm > 50) fail('Radius must be between 0.5 and 50 km.');
  const properties = propertyRepository.list({ maxRent: params.maxRent, bhk: params.bhk })
    .filter(property => property.lat !== null && property.lng !== null)
    .map(property => ({ ...property, distanceKm: Math.round(distanceKm(lat, lng, property.lat, property.lng) * 10) / 10 }))
    .filter(property => property.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm || a.rent - b.rent);
  return { center: { lat, lng }, radiusKm, total: properties.length, properties };
}

const landmarks = () => LANDMARKS.map(item => ({ ...item }));

module.exports = { search, landmarks, distanceKm };
