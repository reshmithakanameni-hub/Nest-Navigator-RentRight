'use strict';
const propertyRepository = require('../repositories/propertyRepository');
const recommendationService = require('../services/recommendationService');
const { send } = require('../lib/http');

function list(req, res, searchParams) {
  const properties = propertyRepository.list(Object.fromEntries(searchParams));
  send(res, 200, { properties, total: properties.length });
}

function recommendations(res, searchParams) {
  const budget = Number(searchParams.get('budget'));
  const bhk = Number(searchParams.get('bhk'));
  const area = String(searchParams.get('area') || '').trim().slice(0, 80).toLowerCase();
  const pets = searchParams.get('pets') === 'true';
  const parking = searchParams.get('parking') === 'true';
  if (!Number.isFinite(budget) || budget < 1 || budget > 1000000 || ![1, 2, 3].includes(bhk)) {
    send(res, 400, { error: 'Enter a monthly budget and select 1, 2 or 3 BHK.' });
    return;
  }
  send(res, 200, {
    matches: recommendationService.recommend({ budget, bhk, area, pets, parking }),
    criteria: { budget, bhk, area: area || null, pets, parking }
  });
}

module.exports = { list, recommendations };
