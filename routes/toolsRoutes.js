'use strict';
const controller = require('../controllers/toolsController');

function handle(req, res, pathname, searchParams) {
  if (req.method !== 'GET') return false;
  if (pathname === '/api/tools/affordability') { controller.affordability(res, searchParams); return true; }
  if (pathname === '/api/tools/commute') { controller.commute(res, searchParams); return true; }
  if (pathname === '/api/properties/compare') { controller.compare(res, searchParams); return true; }
  if (pathname === '/api/properties/nearby') { controller.nearbySearch(res, searchParams); return true; }
  if (pathname === '/api/landmarks') { controller.landmarkList(res); return true; }
  if (pathname === '/api/neighborhoods') { controller.neighborhoodList(res); return true; }
  const neighborhood = pathname.match(/^\/api\/neighborhoods\/([A-Za-z ]{1,40})$/);
  if (neighborhood) { controller.neighborhood(res, decodeURIComponent(neighborhood[1])); return true; }
  const insight = pathname.match(/^\/api\/properties\/(\d+)\/insight$/);
  if (insight) { controller.insight(res, insight[1]); return true; }
  return false;
}

module.exports = { handle };
