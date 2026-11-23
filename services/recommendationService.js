'use strict';
const propertyRepository = require('../repositories/propertyRepository');

// The full score is 100 points. Missing optional preferences are neutral and
// therefore do not penalize a home; requested amenities only score when met.
function recommend(criteria) {
  const { budget, bhk, area, pets, parking } = criteria;
  return propertyRepository.list().map(property => {
    let score = 0;
    const reasons = [];
    if (property.rent <= budget) { score += 35; reasons.push('Within your monthly rent budget'); }
    else if (property.rent <= budget * 1.1) { score += 15; reasons.push('Slightly above your budget'); }
    if (property.bhk === bhk) { score += 25; reasons.push('Exact BHK match'); }
    else if (Math.abs(property.bhk - bhk) === 1) { score += 12; reasons.push('Similar bedroom count'); }
    if (area && (property.area.toLowerCase().includes(area) || property.city.toLowerCase().includes(area))) {
      score += 20; reasons.push('Matches your preferred location');
    }
    if (!pets || property.pets) { score += 10; if (pets) reasons.push('Pet-friendly'); }
    if (!parking || property.parking) { score += 10; if (parking) reasons.push('Parking available'); }
    return { ...property, matchScore: score, matchReasons: reasons };
  }).sort((a, b) => b.matchScore - a.matchScore || a.rent - b.rent).slice(0, 5);
}

module.exports = { recommend };
