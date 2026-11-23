'use strict';
export function setupVisitBooking({ $, apiRequest, toast }) {
  const today = new Date();
  $('#visitDate').min = today.toISOString().slice(0, 10);
  $('#visitForm').addEventListener('submit', async event => {
    event.preventDefault();
    const visit = { propertyId: Number($('#visitProperty').value), name: $('#visitorName').value.trim(), email: $('#visitorEmail').value.trim(), date: $('#visitDate').value, time: $('#visitTime').value };
    if (visit.date < new Date().toISOString().slice(0, 10)) return toast('Choose a future date.');
    $('#visitStatus').textContent = 'Submitting request…';
    try {
      const result = await apiRequest('/api/visits', { method: 'POST', body: JSON.stringify(visit) });
      $('#visitStatus').textContent = `Request ${result.id} submitted successfully. (Demo only)`;
      $('#visitForm').reset(); $('#visitDate').min = today.toISOString().slice(0, 10);
    } catch (error) { $('#visitStatus').textContent = error.message; }
  });
  return {
    updateProperties(properties) {
      for (const id of ['visitProperty', 'leaseProperty']) {
        const select = $(`#${id}`), selected = select.value;
        select.innerHTML = '';
        properties.forEach(property => {
          const option = document.createElement('option'); option.value = property.id;
          option.textContent = `${property.name} — ${property.area}`; select.append(option);
        });
        if (selected) select.value = selected;
      }
      $('#leaseStart').value ||= today.toISOString().slice(0, 10);
    }
  };
}
