'use strict';
const propertyRepository = require('../repositories/propertyRepository');
const { safeId } = require('../lib/validation');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

// Illustrative neighbourhood ratings: groceries, healthcare, schools, transit (out of 5).
const NEIGHBORHOODS = {
  Whitefield: [4, 4, 3, 3], Gachibowli: [4, 4, 4, 3], Kondapur: [4, 4, 4, 3],
  Miyapur: [3, 4, 4, 4], Madhapur: [4, 4, 3, 3]
};
const NEIGHBORHOOD_LABELS = ['Groceries', 'Healthcare', 'Schools', 'Transit'];
const MODE_MULTIPLIER = { car: 1, transit: 1.35, walk: 2.2 };
const BASE_COMMUTE_MINUTES = 24;
const MAX_MONEY = 100_000_000;

function money(value, label) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_MONEY) fail(400, `${label} must be a number between 0 and ${MAX_MONEY}.`);
  return amount;
}

function affordability({ rent, deposit, maintenance, income }) {
  const values = {
    rent: money(rent, 'Rent'), deposit: money(deposit, 'Deposit'),
    maintenance: money(maintenance, 'Maintenance'), income: money(income, 'Income')
  };
  const moveInCost = values.rent + values.deposit + values.maintenance;
  const monthly = values.rent + values.maintenance;
  if (!values.income) return { moveInCost, monthly, ratioPercent: null, withinGuideline: null, message: 'Enter monthly income for an affordability estimate.' };
  const ratio = monthly / values.income;
  return {
    moveInCost, monthly, ratioPercent: Math.round(ratio * 100), withinGuideline: ratio <= 0.3,
    message: `Rent + maintenance is ${Math.round(ratio * 100)}% of income. ${ratio <= 0.3 ? 'Within a common 30% planning guideline.' : 'Consider reviewing your monthly budget.'}`
  };
}

function neighborhoods() { return Object.keys(NEIGHBORHOODS); }

function neighborhoodScores(area) {
  const scores = NEIGHBORHOODS[area];
  if (!scores) fail(404, 'No scorecard is available for that neighborhood.');
  return { area, scores: NEIGHBORHOOD_LABELS.map((label, index) => ({ label, score: scores[index] })), note: 'Illustrative scores, not independently verified data.' };
}

function commute({ propertyId, mode, destination }) {
  const id = safeId(propertyId);
  const dest = String(destination || '').trim().slice(0, 80);
  if (!id) fail(400, 'Choose a valid property.');
  if (!dest) fail(400, 'Enter a destination first.');
  if (!MODE_MULTIPLIER[mode]) fail(400, 'Travel mode must be car, transit or walk.');
  const property = propertyRepository.findById(id);
  if (!property) fail(404, 'Property not found.');
  return {
    property: property.name, area: property.area, destination: dest, mode,
    minutes: Math.round(BASE_COMMUTE_MINUTES * MODE_MULTIPLIER[mode]),
    note: 'Illustrative estimate only. Not live traffic or route data.'
  };
}

function compare(rawIds) {
  const ids = [...new Set(String(rawIds || '').split(',').map(safeId).filter(Boolean))];
  if (ids.length < 2 || ids.length > 3) fail(400, 'Choose two or three homes to compare.');
  const properties = propertyRepository.findByIds(ids);
  if (properties.length !== ids.length) fail(404, 'One or more properties were not found.');
  const cheapest = properties.reduce((best, p) => (p.rent + p.maintenance < best.rent + best.maintenance ? p : best));
  return { properties, lowestMonthlyCostId: cheapest.id };
}

function median(values) {
  const mid = Math.floor(values.length / 2);
  return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
}

// Compares a listing's rent per square foot with the city median (+/-10% is "fair").
function priceInsight(rawId) {
  const id = safeId(rawId);
  const property = id && propertyRepository.findById(id);
  if (!property) fail(404, 'Property not found.');
  const perSqft = property.rent / property.size;
  const cityMedian = median(propertyRepository.rentPerSqftInCity(property.city));
  const differencePercent = Math.round(((perSqft - cityMedian) / cityMedian) * 100);
  const verdict = differencePercent > 10 ? 'ABOVE_MARKET' : differencePercent < -10 ? 'BELOW_MARKET' : 'FAIR';
  return {
    propertyId: property.id, rentPerSqft: Math.round(perSqft * 10) / 10,
    cityMedianPerSqft: Math.round(cityMedian * 10) / 10, differencePercent, verdict,
    note: `Compared with other sample listings in ${property.city}; not a market valuation.`
  };
}

module.exports = { affordability, neighborhoods, neighborhoodScores, commute, compare, priceInsight };
