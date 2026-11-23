import { apiRequest } from './api.js';
import { byId, toast } from './dom.js';
import { isSignedIn, store } from './store.js';

// The shortlist is stored per user on the server; signed-out visitors are asked to sign in.
export async function toggleSaved(id, onChange) {
  if (!isSignedIn()) {
    toast('Sign in to save homes to your shortlist.');
    byId('account').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  try {
    const exists = store.saved.includes(id);
    const result = exists
      ? await apiRequest(`/api/shortlist/${id}`, { method: 'DELETE' })
      : await apiRequest('/api/shortlist', { method: 'POST', body: JSON.stringify({ propertyId: id }) });
    store.saved = result.propertyIds || [];
    onChange();
  } catch (error) {
    toast(error.message);
  }
}
