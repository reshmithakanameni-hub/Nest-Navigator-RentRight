import { byId, toast } from './dom.js';
import { escapeHTML, money } from './format.js';
import { findHome } from './store.js';

const TERM_MONTHS = 11;

// Pure helper: lease end date (YYYY-MM-DD) for a start date and 11-month term.
export function leaseEndDate(startDate) {
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + TERM_MONTHS);
  return end.toISOString().slice(0, 10);
}

// Pure helper: builds the sample agreement markup. Every dynamic value is escaped.
export function buildLeaseHTML({ tenant, property, startDate, preparedOn }) {
  return `<h3>RENTAL AGREEMENT — SAMPLE DRAFT</h3>
<p>This sample agreement is prepared on ${escapeHTML(preparedOn)} between the property owner (Owner) and <b>${escapeHTML(tenant)}</b> (Tenant).</p>
<p><b>Property:</b> ${escapeHTML(property.name)}, ${escapeHTML(property.area)}, ${escapeHTML(property.city)}.</p>
<p><b>Term:</b> ${TERM_MONTHS} months, commencing ${escapeHTML(startDate)} and ending ${leaseEndDate(startDate)}.</p>
<p><b>Monthly rent:</b> ${money(property.rent)}. <b>Security deposit:</b> ${money(property.deposit)}. <b>Maintenance:</b> ${money(property.maintenance)} per month.</p>
<p>Both parties should review and sign a legally compliant agreement after confirming all details. This generated preview is not legal advice and is not a signed contract.</p>
<p>Tenant signature: ____________________ &nbsp; Owner signature: ____________________</p>`;
}

export function setupLease() {
  byId('generateLease').onclick = () => {
    const tenant = byId('tenant').value.trim();
    const startDate = byId('leaseStart').value;
    const property = findHome(Number(byId('leaseProperty').value));
    if (!tenant || !startDate) return toast('Enter tenant name and lease start date.');
    if (!property) return toast('Listings are still loading. Try again shortly.');
    byId('leasePreview').innerHTML = buildLeaseHTML({
      tenant, property, startDate, preparedOn: new Date().toLocaleDateString('en-IN')
    });
  };
  byId('printLease').onclick = () => window.print();
}
