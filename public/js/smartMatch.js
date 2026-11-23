'use strict';
export function setupSmartMatch({ $, apiRequest, escapeHTML, money, toast }) {
  $('#findMatches').onclick = async () => {
    const budget = Number($('#matchBudget').value), bhk = $('#matchBhk').value, area = $('#matchArea').value.trim();
    if (!Number.isFinite(budget) || budget < 1) return toast('Enter a valid monthly budget.');
    $('#smartMatchResult').textContent = 'Finding your best matches…';
    const params = new URLSearchParams({ budget: String(budget), bhk, area, pets: String($('#matchPets').checked), parking: String($('#matchParking').checked) });
    try {
      const data = await apiRequest(`/api/recommendations?${params}`);
      $('#smartMatchResult').innerHTML = data.matches.map((property, index) => `<p><b>${index + 1}. ${escapeHTML(property.name)}</b> · <b>${property.matchScore}% match</b><br>${escapeHTML(property.area)}, ${escapeHTML(property.city)} · ${money(property.rent)}/month<br><small>${property.matchReasons.map(escapeHTML).join(' · ') || 'General listing match'}</small></p>`).join('') || 'No matching homes found.';
    } catch (error) { $('#smartMatchResult').textContent = error.message; }
  };
}
