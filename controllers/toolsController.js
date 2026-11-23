'use strict';
const service = require('../services/toolsService');
const nearby = require('../services/nearbyService');
const { send } = require('../lib/http');

// Wraps a service call so thrown validation errors become JSON error responses.
function respond(res, work) {
  try { send(res, 200, work()); }
  catch (error) { send(res, error.status || 400, { error: error.message }); }
}

const affordability = (res, params) => respond(res, () => service.affordability(Object.fromEntries(params)));
const neighborhoodList = res => respond(res, () => ({ neighborhoods: service.neighborhoods() }));
const neighborhood = (res, area) => respond(res, () => service.neighborhoodScores(area));
const commute = (res, params) => respond(res, () => service.commute(Object.fromEntries(params)));
const compare = (res, params) => respond(res, () => service.compare(params.get('ids')));
const insight = (res, id) => respond(res, () => service.priceInsight(id));

const nearbySearch = (res, params) => respond(res, () => nearby.search(Object.fromEntries(params)));
const landmarkList = res => respond(res, () => ({ landmarks: nearby.landmarks() }));

module.exports = { nearbySearch, landmarkList, affordability, neighborhoodList, neighborhood, commute, compare, insight };
