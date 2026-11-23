'use strict';
export function setupAccountWorkspace({ $, apiRequest, escapeHTML, toast, render, setSaved, setUser }) {
  const action = $('#authAction');
  if (action) {
    action.addEventListener('change', () => {
      $('#authNameWrap').hidden = action.value === 'login';
      $('#authName').required = action.value === 'register';
    });
    $('#authForm').addEventListener('submit', async event => {
      event.preventDefault();
      const operation = action.value;
      const body = { email: $('#authEmail').value.trim(), password: $('#authPassword').value };
      if (operation === 'register') { body.name = $('#authName').value.trim(); body.role = $('#authRole').value; }
      try {
        const result = await apiRequest(`/api/auth/${operation === 'register' ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify(body) });
        $('#authStatus').textContent = operation === 'register' ? 'Account created. Sign in to open your workspace.' : `Signed in as ${result.user.name} (${result.user.role}).`;
        $('#accountGreeting').textContent = `Welcome, ${result.user.name} · ${result.user.role}`;
        $('#authPassword').value = '';
        if (operation === 'login') {
          setUser(result.user);
          const shortlist = await apiRequest('/api/shortlist'); setSaved(shortlist.propertyIds || []); render();
          if (result.user.role === 'owner') $('#ownerVisits').textContent = 'Claim a property using its listing ID, then load visit requests.';
        }
      } catch (error) { $('#authStatus').textContent = error.message; }
    });
    $('#changePassword').onclick = async () => {
      try {
        const result = await apiRequest('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: $('#currentPassword').value, newPassword: $('#newPassword').value }) });
        $('#passwordStatus').textContent = result.message; $('#currentPassword').value = ''; $('#newPassword').value = '';
      } catch (error) { $('#passwordStatus').textContent = error.message; }
    };
    setupPasswordRecovery();
    $('#loadOwnerVisits').onclick = loadOwnerVisits;
    $('#ownerVisits').addEventListener('click', async event => {
      const button = event.target.closest('[data-update-visit]'); if (!button) return;
      const select = button.parentElement.querySelector('[data-visit-status]');
      try {
        await apiRequest(`/api/owner/visits/${encodeURIComponent(button.dataset.updateVisit)}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) });
        toast('Visit status updated'); await loadOwnerVisits();
      } catch (error) { toast(error.message); }
    });
    $('#logout').onclick = async () => {
      try { await apiRequest('/api/auth/logout', { method: 'POST' }); }
      catch (error) { toast(error.message); }
      finally { setUser(null); setSaved([]); render(); $('#accountGreeting').textContent = 'Signed out'; $('#ownerVisits').textContent = 'Sign in as an owner to view requests.'; }
    };
  }
  $('#claimProperty').onclick = async () => {
    const propertyId = Number($('#claimPropertyId').value);
    if (!Number.isInteger(propertyId) || propertyId < 1) return toast('Enter a valid property ID.');
    try { const result = await apiRequest('/api/owner/properties/claim', { method: 'POST', body: JSON.stringify({ propertyId }) }); toast(result.message); $('#claimPropertyId').value = ''; }
    catch (error) { toast(error.message); }
  };
  return { restoreSession };

  // Forgot-password flow: request a link, then open it (#reset=<token>) to choose a new password.
  // The token travels in the URL fragment, so it is never sent to the server in a request line or logs.
  function setupPasswordRecovery() {
    let resetToken = '';
    $('#sendReset').onclick = async () => {
      try {
        const result = await apiRequest('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: $('#forgotEmail').value.trim() }) });
        const status = $('#forgotStatus');
        status.textContent = result.message;
        if (result.devResetLink) {
          // Present only outside production, because this demo has no mail server.
          status.append(document.createElement('br'), 'Demo mode (no email server): ');
          const link = document.createElement('a');
          link.href = result.devResetLink; link.textContent = 'open your reset link';
          status.append(link);
        }
      } catch (error) { $('#forgotStatus').textContent = error.message; }
    };
    const openFromHash = () => {
      const match = /^#reset=([a-f0-9]{64})$/.exec(location.hash);
      if (!match) return;
      resetToken = match[1];
      history.replaceState(null, '', location.pathname + location.search);
      $('#resetPanel').hidden = false;
      $('#resetStatus').textContent = '';
      $('#account').scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('hashchange', openFromHash);
    openFromHash();
    $('#submitReset').onclick = async () => {
      try {
        const result = await apiRequest('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: resetToken, newPassword: $('#resetPassword').value }) });
        $('#resetStatus').textContent = result.message; $('#resetPassword').value = ''; resetToken = '';
        $('#authAction').value = 'login'; $('#authAction').dispatchEvent(new Event('change'));
      } catch (error) { $('#resetStatus').textContent = error.message; }
    };
  }

  async function loadOwnerVisits() {
    try {
      const result = await apiRequest('/api/owner/visits');
      $('#ownerVisits').innerHTML = result.visits.length ? result.visits.map(visit => `<p><b>${escapeHTML(visit.property)}</b> · ${escapeHTML(visit.name)} · ${escapeHTML(visit.date)} ${escapeHTML(visit.time)} · ${escapeHTML(visit.status)} <select data-visit-status="${escapeHTML(visit.id)}"><option ${visit.status === 'REQUESTED' ? 'selected' : ''}>REQUESTED</option><option ${visit.status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED</option><option ${visit.status === 'DECLINED' ? 'selected' : ''}>DECLINED</option><option ${visit.status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option></select> <button data-update-visit="${escapeHTML(visit.id)}">Update</button></p>`).join('') : 'No visit requests yet.';
    } catch (error) { $('#ownerVisits').textContent = error.message; }
  }
  async function restoreSession() {
    try {
      const result = await apiRequest('/api/auth/me'); setUser(result.user);
      $('#accountGreeting').textContent = `Welcome, ${result.user.name} · ${result.user.role}`;
      if (result.user.role === 'owner') $('#ownerVisits').textContent = 'Claim a property using its listing ID, then load visit requests.';
      const shortlist = await apiRequest('/api/shortlist'); setSaved(shortlist.propertyIds || []); render();
    } catch { /* A missing session is the expected signed-out state. */ }
  }
}
