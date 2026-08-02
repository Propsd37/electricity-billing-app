// API helper
const API = {
  async get(url) {
    const res = await fetch('/api' + url);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch('/api' + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch('/api' + url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },
  async delete(url) {
    const res = await fetch('/api' + url, { method: 'DELETE' });
    return res.json();
  }
};

// Utility functions
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function getCurrentMonth() {
  return MONTHS[new Date().getMonth()];
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function formatCurrency(amount) {
  return '₹' + (amount || 0).toFixed(2);
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  setTimeout(() => toast.className = 'toast hidden', 3000);
}

function showModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal').classList.add('hidden');
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.getElementById('sidebar').classList.remove('open');
    loadPage(page);
  });
});

document.getElementById('menuBtn').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') hideModal();
});

function loadPage(page) {
  const titles = {
    dashboard: '📊 Dashboard',
    readings: '⚡ Meter Readings',
    bills: '📄 Bills',
    tenants: '👥 Tenants',
    properties: '🏘️ Properties',
    settings: '⚙️ Rate Settings'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  
  switch(page) {
    case 'dashboard': renderDashboard(); break;
    case 'readings': renderReadings(); break;
    case 'bills': renderBills(); break;
    case 'tenants': renderTenants(); break;
    case 'properties': renderProperties(); break;
    case 'settings': renderSettings(); break;
  }
}

// ========== DASHBOARD ==========
async function renderDashboard() {
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const data = await API.get(`/dashboard?month=${month}&year=${year}`);
  const s = data.summary;

  // Group property cards by group_name with custom order
  const grouped = {};
  (data.property_cards || []).forEach(p => {
    const grp = p.group_name || 'Unassigned';
    if (!grouped[grp]) grouped[grp] = [];
    grouped[grp].push(p);
  });

  // Custom group order: RJ Market Complex > Karuna Bhavana RCC > Karuna Bhavana Asbestos
  const groupOrder = ['RJ Market Complex', 'Karuna Bhavana RCC', 'Karuna Bhavana Asbestos'];
  const orderedGroups = [];
  groupOrder.forEach(g => { if (grouped[g]) orderedGroups.push([g, grouped[g]]); });
  // Add any remaining groups not in the custom order
  Object.keys(grouped).forEach(g => { if (!groupOrder.includes(g)) orderedGroups.push([g, grouped[g]]); });

  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
    <h3>🏠 All Properties — ${month} ${year}</h3>
    <button class="btn btn-primary" onclick="generateMonthlyBills()">🔄 Generate Monthly Bills</button>
  </div>`;

  // Property cards section (grouped) — compact view with collapsible groups
  for (const [groupName, cards] of orderedGroups) {
    const paidCount = cards.filter(c => c.bill_paid === 1).length;
    const tenantCount = cards.filter(c => !!c.tenant_name).length;
    const totalAmt = cards.reduce((s, c) => s + (c.current_bill || c.monthly_rent || 0), 0);
    const pendingAmt = cards.filter(c => c.tenant_name && c.bill_paid !== 1).reduce((s, c) => s + (c.current_bill || c.monthly_rent || 0), 0);

    html += `
      <div class="group-block">
        <div class="group-header" onclick="toggleGroup(this)">
          <div class="gh-left">
            <span class="gh-arrow">▶</span>
            <h4>${groupName}</h4>
            <span class="gh-count">${cards.length} units • ${tenantCount} tenants</span>
          </div>
          <div class="gh-right">
            <span class="gh-stat gh-success">${paidCount} paid</span>
            <span class="gh-stat gh-pending">₹${pendingAmt.toFixed(0)} pending</span>
            <span class="gh-stat">₹${totalAmt.toFixed(0)} total</span>
          </div>
        </div>
        <div class="group-body collapsed">
    `;
    cards.forEach(p => {
      const hasT = !!p.tenant_name;
      const statusClass = !hasT ? 'vacant' : (p.bill_paid === 1 ? 'paid' : (p.current_bill ? 'unpaid' : 'no-bill'));
      const billAmt = p.current_bill || p.monthly_rent || 0;
      const elecDone = p.electricity_units != null && p.electricity_units > 0;

      html += `
        <div class="compact-card ${statusClass}" onclick="openCardDetail(${JSON.stringify(p).replace(/"/g, '&quot;')})">
          <div class="cc-left">
            <div class="cc-icon">${hasT ? p.tenant_name.charAt(0).toUpperCase() : '🏠'}</div>
            <div class="cc-info">
              <strong>${p.property_name}</strong>
              <small>${hasT ? p.tenant_name : 'Vacant'}${hasT && p.tenant_phone ? ' • ' + p.tenant_phone : ''}</small>
            </div>
          </div>
          <div class="cc-right">
            <div class="cc-amount">${hasT ? formatCurrency(billAmt) : '—'}</div>
            <div class="cc-badges">
              ${!hasT ? '<span class="badge badge-warning">Vacant</span>' :
                (p.bill_paid === 1 ? '<span class="badge badge-success">Paid</span>' :
                (!elecDone ? '<span class="badge badge-warning">Rent</span>' : '<span class="badge badge-danger">Due</span>'))}
            </div>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }

  // Total Calculations Section at bottom
  html += `
    <div class="card" style="margin-top:25px;">
      <div class="card-header"><h3>📊 Total Calculations — ${month} ${year}</h3></div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="value">${data.total_tenants}</div>
          <div class="label">Active Tenants</div>
        </div>
        <div class="stat-card">
          <div class="value">${data.total_properties}</div>
          <div class="label">Total Properties</div>
        </div>
        <div class="stat-card warning">
          <div class="value">${formatCurrency(s.total_amount)}</div>
          <div class="label">Total Billed</div>
        </div>
        <div class="stat-card success">
          <div class="value">${formatCurrency(s.collected)}</div>
          <div class="label">Collected</div>
        </div>
        <div class="stat-card danger">
          <div class="value">${formatCurrency(s.pending)}</div>
          <div class="label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="value">${formatCurrency(s.total_rent)}</div>
          <div class="label">Total Rent</div>
        </div>
        <div class="stat-card">
          <div class="value">${formatCurrency(s.total_electricity)}</div>
          <div class="label">Total Electricity</div>
        </div>
        <div class="stat-card">
          <div class="value">${s.paid_count || 0} / ${s.total_bills || 0}</div>
          <div class="label">Bills Paid</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('pageContent').innerHTML = html;
}

// --- Dashboard Actions ---

function toggleGroup(header) {
  const body = header.nextElementSibling;
  body.classList.toggle('collapsed');
  header.classList.toggle('open');
}

async function generateMonthlyBills() {
  const result = await API.post('/generate-monthly-bills', { month: getCurrentMonth(), year: getCurrentYear() });
  if (result.bills_created > 0) {
    showToast(`${result.bills_created} rent bills generated for ${result.month}!`, 'success');
  } else {
    showToast('All bills already exist for this month', '');
  }
  renderDashboard();
}

function openCardDetail(p) {
  const hasT = !!p.tenant_name;
  const prevReading = p.prev_reading || 0;
  const elecDone = p.electricity_units != null && p.electricity_units > 0;

  let content = `
    <div class="modal-header">
      <h2>${p.property_name} <small style="font-weight:400;color:var(--text-light);">(${p.property_type})</small></h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
  `;

  if (hasT) {
    content += `
      <!-- Tenant -->
      <div class="detail-section">
        <div class="detail-title">👤 Tenant</div>
        <div class="detail-row"><span>Name:</span> <strong>${p.tenant_name}</strong></div>
        <div class="detail-row"><span>Phone:</span> <strong>${p.tenant_phone || '—'}</strong></div>
        <div class="detail-actions">
          <button class="btn btn-sm btn-outline" onclick="hideModal(); editTenantFromDash(${p.tenant_id}, ${p.property_id}, '${p.tenant_name.replace(/'/g, "\\'")}', '${(p.tenant_phone || '').replace(/'/g, "\\'")}')">✏️ Edit Tenant</button>
          <button class="btn btn-sm btn-danger" onclick="hideModal(); removeTenantFromDash(${p.tenant_id})">✕ Remove</button>
        </div>
      </div>

      <!-- Rent -->
      <div class="detail-section">
        <div class="detail-title">🏠 House Rent</div>
        <div class="detail-row"><span>Monthly Rent:</span> <strong class="amount">${formatCurrency(p.monthly_rent)}</strong>
          <button class="btn btn-sm btn-outline" onclick="hideModal(); editRentFromDash(${p.property_id}, ${p.monthly_rent}, '${p.property_name.replace(/'/g, "\\'")}')">✏️</button>
        </div>
      </div>

      <!-- Electricity -->
      <div class="detail-section">
        <div class="detail-title">⚡ Electricity (₹${p.rate_per_unit}/unit)</div>
        ${elecDone ? `
          <div class="detail-grid">
            <div><span>Previous</span><strong>${p.prev_reading || 0}</strong></div>
            <div><span>Current</span><strong>${p.curr_reading || 0}</strong></div>
            <div><span>Units</span><strong>${p.electricity_units}</strong></div>
            <div><span>Amount</span><strong>${formatCurrency(p.electricity_amount)}</strong></div>
          </div>
          <div class="detail-actions">
            <button class="btn btn-sm btn-outline" onclick="editElectricity(${p.property_id}, ${p.tenant_id}, ${p.rate_per_unit}, ${p.monthly_rent}, ${p.prev_reading || 0}, ${p.curr_reading || 0}, ${p.bill_id || 0})">✏️ Edit Reading</button>
          </div>
        ` : `
          <div class="prop-reading-form">
            <div class="prop-form-row">
              <div class="prop-form-field">
                <label>Prev Reading</label>
                <input type="number" id="prev-${p.property_id}" value="${prevReading}" oninput="previewBill(${p.property_id}, ${p.rate_per_unit}, ${p.monthly_rent})">
              </div>
              <div class="prop-form-field">
                <label>Current Reading</label>
                <input type="number" id="curr-${p.property_id}" placeholder="Enter reading" oninput="previewBill(${p.property_id}, ${p.rate_per_unit}, ${p.monthly_rent})">
              </div>
            </div>
            <div class="prop-calc-row" id="preview-${p.property_id}"></div>
            <button class="btn btn-primary" onclick="submitReadingFromCard(${p.property_id}, ${p.tenant_id}, ${p.rate_per_unit}, ${p.bill_id || 0})">💾 Save Reading & Update Bill</button>
          </div>
        `}
      </div>

      <!-- Total -->
      <div class="detail-section detail-total">
        <div class="detail-grid">
          <div><span>Rent</span><strong>${formatCurrency(p.rent_amount || p.monthly_rent)}</strong></div>
          <div><span>Electricity</span><strong>${formatCurrency(p.electricity_amount || 0)}</strong></div>
        </div>
        <div class="detail-grand-total">
          <span>Total Bill</span>
          <strong>${formatCurrency(p.current_bill || p.monthly_rent || 0)}</strong>
        </div>
        <div class="detail-actions" style="margin-top:10px;">
          ${p.bill_id ? (p.bill_paid === 1 
            ? `<button class="btn btn-outline" onclick="hideModal(); markUnpaidDash(${p.bill_id})">↩ Mark Unpaid</button>`
            : `<button class="btn btn-success" onclick="hideModal(); markPaid(${p.bill_id})">✓ Mark as Paid</button>`
          ) : ''}
          <button class="btn btn-outline" onclick="hideModal(); viewHistory(${p.tenant_id}, '${p.tenant_name.replace(/'/g, "\\'")}')">📋 View History</button>
        </div>
      </div>
    `;
  } else {
    content += `
      <div class="detail-section">
        <div class="prop-vacant-msg">No tenant assigned to this property</div>
        <div class="prop-reading-form">
          <div class="prop-form-field">
            <label>Tenant Name *</label>
            <input type="text" id="tname-${p.property_id}" placeholder="Enter name">
          </div>
          <div class="prop-form-row">
            <div class="prop-form-field">
              <label>Phone</label>
              <input type="text" id="tphone-${p.property_id}" placeholder="Phone number">
            </div>
            <div class="prop-form-field">
              <label>Monthly Rent (₹)</label>
              <input type="number" id="trent-${p.property_id}" placeholder="Rent" value="${p.monthly_rent || 0}">
            </div>
          </div>
          <button class="btn btn-primary" onclick="quickAddTenant(${p.property_id})">+ Add Tenant</button>
        </div>
      </div>
    `;
  }

  showModal(content);
}

function previewBill(propertyId, rate, rent) {
  const prev = parseFloat(document.getElementById(`prev-${propertyId}`).value) || 0;
  const curr = parseFloat(document.getElementById(`curr-${propertyId}`).value) || 0;
  const el = document.getElementById(`preview-${propertyId}`);
  if (curr > prev) {
    const units = curr - prev;
    const elecAmt = units * rate;
    const total = rent + elecAmt;
    el.innerHTML = `
      <div class="calc-item"><span>Total Units</span><strong>${units}</strong></div>
      <div class="calc-item"><span>Electricity</span><strong>${units} × ₹${rate} = ${formatCurrency(elecAmt)}</strong></div>
      <div class="calc-item"><span>Rent</span><strong>${formatCurrency(rent)}</strong></div>
      <div class="calc-item calc-total"><span>Grand Total</span><strong>${formatCurrency(total)}</strong></div>
    `;
    el.style.display = 'grid';
  } else {
    el.style.display = 'none';
  }
}

async function submitReadingFromCard(propertyId, tenantId, rate, existingBillId) {
  const prev = parseFloat(document.getElementById(`prev-${propertyId}`).value) || 0;
  const curr = parseFloat(document.getElementById(`curr-${propertyId}`).value);
  if (!curr || curr <= prev) {
    showToast('Current reading must be greater than previous', 'error');
    return;
  }
  const result = await API.post('/meter-readings', {
    tenant_id: tenantId,
    property_id: propertyId,
    reading_date: new Date().toISOString().split('T')[0],
    month: getCurrentMonth(),
    year: getCurrentYear(),
    previous_reading: prev,
    current_reading: curr,
    existing_bill_id: existingBillId || 0
  });
  if (result.error) { showToast(result.error, 'error'); return; }
  showToast(`Bill updated! Total: ${formatCurrency(result.total_amount)}`, 'success');
  renderDashboard();
}

function editElectricity(propertyId, tenantId, rate, rent, prevReading, currReading, billId) {
  showModal(`
    <div class="modal-header">
      <h2>✏️ Edit Electricity Reading</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="prop-reading-form">
      <div class="prop-form-row">
        <div class="prop-form-field">
          <label>Previous Reading</label>
          <input type="number" id="edit-prev-${propertyId}" value="${prevReading}" oninput="previewEditBill(${propertyId}, ${rate}, ${rent})">
        </div>
        <div class="prop-form-field">
          <label>Current Reading</label>
          <input type="number" id="edit-curr-${propertyId}" value="${currReading}" oninput="previewEditBill(${propertyId}, ${rate}, ${rent})">
        </div>
      </div>
      <div class="prop-calc-row" id="edit-preview-${propertyId}" style="display:grid;">
        <div class="calc-item"><span>Total Units</span><strong>${currReading - prevReading}</strong></div>
        <div class="calc-item"><span>Electricity</span><strong>${(currReading - prevReading)} × ₹${rate} = ${formatCurrency((currReading - prevReading) * rate)}</strong></div>
        <div class="calc-item"><span>Rent</span><strong>${formatCurrency(rent)}</strong></div>
        <div class="calc-item calc-total"><span>Grand Total</span><strong>${formatCurrency(rent + (currReading - prevReading) * rate)}</strong></div>
      </div>
      <button class="btn btn-primary" onclick="saveEditedReading(${propertyId}, ${tenantId}, ${rate}, ${billId})">💾 Update Bill</button>
    </div>
  `);
}

function previewEditBill(propertyId, rate, rent) {
  const prev = parseFloat(document.getElementById(`edit-prev-${propertyId}`).value) || 0;
  const curr = parseFloat(document.getElementById(`edit-curr-${propertyId}`).value) || 0;
  const el = document.getElementById(`edit-preview-${propertyId}`);
  if (curr > prev) {
    const units = curr - prev;
    const elecAmt = units * rate;
    const total = rent + elecAmt;
    el.innerHTML = `
      <div class="calc-item"><span>Total Units</span><strong>${units}</strong></div>
      <div class="calc-item"><span>Electricity</span><strong>${units} × ₹${rate} = ${formatCurrency(elecAmt)}</strong></div>
      <div class="calc-item"><span>Rent</span><strong>${formatCurrency(rent)}</strong></div>
      <div class="calc-item calc-total"><span>Grand Total</span><strong>${formatCurrency(total)}</strong></div>
    `;
    el.style.display = 'grid';
  } else {
    el.style.display = 'none';
  }
}

async function saveEditedReading(propertyId, tenantId, rate, billId) {
  const prev = parseFloat(document.getElementById(`edit-prev-${propertyId}`).value) || 0;
  const curr = parseFloat(document.getElementById(`edit-curr-${propertyId}`).value);
  if (!curr || curr <= prev) {
    showToast('Current reading must be greater than previous', 'error');
    return;
  }
  const result = await API.put(`/meter-readings/update-by-bill/${billId}`, {
    previous_reading: prev,
    current_reading: curr
  });
  if (result.error) { showToast(result.error, 'error'); return; }
  showToast(`Bill updated! Total: ${formatCurrency(result.total_amount)}`, 'success');
  hideModal();
  renderDashboard();
}

async function quickAddTenant(propertyId) {
  const name = document.getElementById(`tname-${propertyId}`).value.trim();
  const phone = document.getElementById(`tphone-${propertyId}`).value.trim();
  const rent = parseFloat(document.getElementById(`trent-${propertyId}`).value) || 0;
  if (!name) { showToast('Tenant name is required', 'error'); return; }
  // Update rent on property
  const props = await API.get('/properties');
  const prop = props.find(p => p.id === propertyId);
  if (prop) {
    await API.put(`/properties/${propertyId}`, { name: prop.name, property_type_id: prop.property_type_id, monthly_rent: rent, address: prop.address || '' });
  }
  // Add tenant
  const result = await API.post('/tenants', { name, phone, property_id: propertyId, move_in_date: new Date().toISOString().split('T')[0] });
  if (result.error) { showToast(result.error, 'error'); return; }
  showToast('Tenant added!', 'success');
  renderDashboard();
}

function editTenantFromDash(tenantId, propertyId, name, phone) {
  showModal(`
    <div class="modal-header">
      <h2>Edit Tenant</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Tenant Name *</label>
      <input type="text" id="dashTenantName" value="${name}">
    </div>
    <div class="form-group">
      <label>Phone Number</label>
      <input type="text" id="dashTenantPhone" value="${phone}">
    </div>
    <button class="btn btn-primary" onclick="updateTenantFromDash(${tenantId}, ${propertyId})">Update</button>
  `);
}

async function updateTenantFromDash(id, propertyId) {
  const name = document.getElementById('dashTenantName').value.trim();
  const phone = document.getElementById('dashTenantPhone').value.trim();
  if (!name) { showToast('Name is required', 'error'); return; }
  await API.put(`/tenants/${id}`, { name, phone, property_id: propertyId, is_active: 1 });
  showToast('Tenant updated!', 'success');
  hideModal();
  renderDashboard();
}

async function removeTenantFromDash(id) {
  if (confirm('Remove this tenant from the property?')) {
    await API.delete(`/tenants/${id}`);
    showToast('Tenant removed', '');
    renderDashboard();
  }
}

function editRentFromDash(propertyId, currentRent, propertyName) {
  showModal(`
    <div class="modal-header">
      <h2>Set Rent — ${propertyName}</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Monthly Rent (₹)</label>
      <input type="number" id="dashRentAmount" value="${currentRent}">
    </div>
    <button class="btn btn-primary" onclick="updateRentFromDash(${propertyId})">Update Rent</button>
  `);
}

async function updateRentFromDash(propertyId) {
  const rent = parseFloat(document.getElementById('dashRentAmount').value) || 0;
  const props = await API.get('/properties');
  const prop = props.find(p => p.id === propertyId);
  if (prop) {
    await API.put(`/properties/${propertyId}`, { name: prop.name, property_type_id: prop.property_type_id, monthly_rent: rent, address: prop.address || '' });
  }
  showToast('Rent updated!', 'success');
  hideModal();
  renderDashboard();
}

async function markPaid(billId) {
  await API.put(`/bills/${billId}/pay`, { paid_date: new Date().toISOString().split('T')[0] });
  showToast('Marked as paid!', 'success');
  renderDashboard();
}

async function markUnpaidDash(billId) {
  await API.put(`/bills/${billId}/unpay`, {});
  showToast('Marked as unpaid', '');
  renderDashboard();
}

async function deleteBillFromDash(billId) {
  if (confirm('Delete this bill? This will also remove the meter reading.')) {
    await API.delete(`/bills/${billId}`);
    showToast('Bill deleted', '');
    renderDashboard();
  }
}

// View transaction history for a tenant
async function viewHistory(tenantId, tenantName) {
  const bills = await API.get(`/bills?tenant_id=${tenantId}`);
  const readings = await API.get(`/meter-readings?tenant_id=${tenantId}`);

  // Build a map of readings by bill
  const readingMap = {};
  readings.forEach(r => { readingMap[r.id] = r; });

  let tableRows = '';
  if (bills.length === 0) {
    tableRows = `<tr><td colspan="9" style="text-align:center;color:var(--text-light);">No bills yet</td></tr>`;
  } else {
    bills.forEach(b => {
      tableRows += `
        <tr>
          <td>${b.month} ${b.year}</td>
          <td>${b.prev_reading || '—'}</td>
          <td>${b.curr_reading || '—'}</td>
          <td>${b.electricity_units || 0}</td>
          <td class="amount">${formatCurrency(b.rent_amount)}</td>
          <td class="amount">${formatCurrency(b.electricity_amount)}</td>
          <td class="amount"><strong>${formatCurrency(b.total_amount)}</strong></td>
          <td>${b.is_paid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-danger">Unpaid</span>'}</td>
          <td>${b.paid_date || '—'}</td>
        </tr>
      `;
    });
  }

  // Calculate totals
  const totalRent = bills.reduce((s, b) => s + (b.rent_amount || 0), 0);
  const totalElec = bills.reduce((s, b) => s + (b.electricity_amount || 0), 0);
  const totalAmount = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
  const totalPaid = bills.filter(b => b.is_paid).reduce((s, b) => s + (b.total_amount || 0), 0);
  const totalPending = totalAmount - totalPaid;

  showModal(`
    <div class="modal-header">
      <h2>📋 History — ${tenantName}</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="history-summary">
      <div><span>Total Billed</span><strong>${formatCurrency(totalAmount)}</strong></div>
      <div class="hs-success"><span>Paid</span><strong>${formatCurrency(totalPaid)}</strong></div>
      <div class="hs-danger"><span>Pending</span><strong>${formatCurrency(totalPending)}</strong></div>
    </div>
    <div class="table-container" style="max-height:400px;overflow-y:auto;">
      <table>
        <thead><tr>
          <th>Month</th><th>Prev</th><th>Curr</th><th>Units</th><th>Rent</th><th>Elec.</th><th>Total</th><th>Status</th><th>Paid On</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr style="font-weight:600;background:var(--bg);">
            <td>TOTAL</td><td></td><td></td><td></td>
            <td class="amount">${formatCurrency(totalRent)}</td>
            <td class="amount">${formatCurrency(totalElec)}</td>
            <td class="amount">${formatCurrency(totalAmount)}</td>
            <td></td><td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `);
}


// ========== METER READINGS ==========
async function renderReadings() {
  const tenants = await API.get('/tenants/active');
  const month = getCurrentMonth();
  const year = getCurrentYear();

  let html = `
    <div class="card">
      <div class="card-header">
        <h3>Enter Meter Readings for ${month} ${year}</h3>
      </div>
      <p style="color:var(--text-light);margin-bottom:15px;font-size:0.9rem;">
        Select a tenant, enter the current meter reading, and the bill will be auto-calculated.
      </p>
  `;

  if (tenants.length === 0) {
    html += `<div class="empty-state"><div class="icon">👥</div>
      <p>No active tenants found. Add tenants first.</p></div>`;
  } else {
    html += `
      <div class="form-group">
        <label>Select Tenant</label>
        <select id="readingTenant" onchange="loadLastReading()">
          <option value="">-- Select Tenant --</option>
          ${tenants.map(t => `<option value="${t.id}" data-property="${t.property_id}" data-rate="${t.rate_per_unit}" data-rent="${t.monthly_rent}">${t.name} (${t.property_name} - ${t.property_type})</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Previous Reading</label>
          <input type="number" id="prevReading" readonly placeholder="Auto-filled">
        </div>
        <div class="form-group">
          <label>Current Reading</label>
          <input type="number" id="currReading" placeholder="Enter current reading" oninput="calcPreview()">
        </div>
      </div>
      <div id="readingPreview" style="margin:15px 0;padding:15px;background:var(--bg);border-radius:6px;display:none;">
      </div>
      <button class="btn btn-primary" onclick="submitReading()">💾 Save Reading & Generate Bill</button>
    `;
  }
  html += `</div>`;

  // Show recent readings
  const readings = await API.get(`/meter-readings?month=${month}&year=${year}`);
  if (readings.length > 0) {
    html += `
      <div class="card">
        <div class="card-header"><h3>Readings This Month</h3></div>
        <div class="table-container">
          <table>
            <thead><tr>
              <th>Tenant</th><th>Property</th><th>Prev</th><th>Current</th><th>Units</th><th>Amount</th>
            </tr></thead>
            <tbody>
              ${readings.map(r => `
                <tr>
                  <td>${r.tenant_name}</td>
                  <td>${r.property_name}</td>
                  <td>${r.previous_reading}</td>
                  <td>${r.current_reading}</td>
                  <td><strong>${r.units_consumed}</strong></td>
                  <td class="amount">${formatCurrency(r.units_consumed * r.rate_per_unit)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  document.getElementById('pageContent').innerHTML = html;
}

async function loadLastReading() {
  const select = document.getElementById('readingTenant');
  const tenantId = select.value;
  if (!tenantId) return;
  
  const lastReading = await API.get(`/meter-readings/last/${tenantId}`);
  document.getElementById('prevReading').value = lastReading.current_reading || 0;
  document.getElementById('currReading').value = '';
  document.getElementById('readingPreview').style.display = 'none';
}

function calcPreview() {
  const select = document.getElementById('readingTenant');
  const option = select.options[select.selectedIndex];
  if (!option || !option.value) return;

  const prev = parseFloat(document.getElementById('prevReading').value) || 0;
  const curr = parseFloat(document.getElementById('currReading').value) || 0;
  const rate = parseFloat(option.dataset.rate) || 0;
  const rent = parseFloat(option.dataset.rent) || 0;

  if (curr > prev) {
    const units = curr - prev;
    const elecAmt = units * rate;
    const total = rent + elecAmt;
    document.getElementById('readingPreview').style.display = 'block';
    document.getElementById('readingPreview').innerHTML = `
      <strong>Bill Preview:</strong><br>
      Units: ${units} × ₹${rate}/unit = <strong>${formatCurrency(elecAmt)}</strong><br>
      Rent: <strong>${formatCurrency(rent)}</strong><br>
      <hr style="margin:8px 0;border-color:var(--border)">
      <strong style="font-size:1.1rem;">Total: ${formatCurrency(total)}</strong>
    `;
  } else {
    document.getElementById('readingPreview').style.display = 'none';
  }
}

async function submitReading() {
  const select = document.getElementById('readingTenant');
  const option = select.options[select.selectedIndex];
  if (!option || !option.value) {
    showToast('Please select a tenant', 'error');
    return;
  }

  const prev = parseFloat(document.getElementById('prevReading').value) || 0;
  const curr = parseFloat(document.getElementById('currReading').value);

  if (!curr || curr <= prev) {
    showToast('Current reading must be greater than previous reading', 'error');
    return;
  }

  const data = {
    tenant_id: parseInt(option.value),
    property_id: parseInt(option.dataset.property),
    reading_date: new Date().toISOString().split('T')[0],
    month: getCurrentMonth(),
    year: getCurrentYear(),
    previous_reading: prev,
    current_reading: curr
  };

  const result = await API.post('/meter-readings', data);
  if (result.error) {
    showToast(result.error, 'error');
  } else {
    showToast(`Bill generated! Total: ${formatCurrency(result.total_amount)}`, 'success');
    renderReadings();
  }
}

// ========== BILLS ==========
async function renderBills() {
  const month = getCurrentMonth();
  const year = getCurrentYear();
  const bills = await API.get(`/bills?month=${month}&year=${year}`);

  let html = `
    <div class="filter-bar">
      <select id="billMonth" onchange="filterBills()">
        ${MONTHS.map(m => `<option value="${m}" ${m === month ? 'selected' : ''}>${m}</option>`).join('')}
      </select>
      <select id="billYear" onchange="filterBills()">
        ${[year-1, year, year+1].map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
      <select id="billStatus" onchange="filterBills()">
        <option value="">All</option>
        <option value="0">Unpaid</option>
        <option value="1">Paid</option>
      </select>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr>
            <th>Tenant</th><th>Property</th><th>Rent</th><th>Electricity</th><th>Total</th><th>Status</th><th>Action</th>
          </tr></thead>
          <tbody id="billsTableBody">
  `;

  if (bills.length === 0) {
    html += `<tr><td colspan="7" class="empty-state">No bills found for this month. Enter meter readings to generate bills.</td></tr>`;
  } else {
    bills.forEach(b => {
      html += `
        <tr>
          <td><strong>${b.tenant_name}</strong></td>
          <td>${b.property_name}<br><small>${b.property_type}</small></td>
          <td class="amount">${formatCurrency(b.rent_amount)}</td>
          <td class="amount">${formatCurrency(b.electricity_amount)}<br><small>${b.electricity_units} units × ₹${b.rate_per_unit}</small></td>
          <td class="amount"><strong>${formatCurrency(b.total_amount)}</strong></td>
          <td>${b.is_paid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-danger">Unpaid</span>'}</td>
          <td>
            ${b.is_paid 
              ? `<button class="btn btn-sm btn-outline" onclick="markUnpaid(${b.id})">Undo</button>`
              : `<button class="btn btn-sm btn-success" onclick="markPaidFromBills(${b.id})">✓ Paid</button>`
            }
          </td>
        </tr>
      `;
    });
  }

  html += `</tbody></table></div></div>`;
  document.getElementById('pageContent').innerHTML = html;
}

async function filterBills() {
  const month = document.getElementById('billMonth').value;
  const year = document.getElementById('billYear').value;
  const status = document.getElementById('billStatus').value;
  let url = `/bills?month=${month}&year=${year}`;
  if (status !== '') url += `&is_paid=${status}`;
  const bills = await API.get(url);
  
  const tbody = document.getElementById('billsTableBody');
  if (bills.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No bills found.</td></tr>`;
    return;
  }
  tbody.innerHTML = bills.map(b => `
    <tr>
      <td><strong>${b.tenant_name}</strong></td>
      <td>${b.property_name}<br><small>${b.property_type}</small></td>
      <td class="amount">${formatCurrency(b.rent_amount)}</td>
      <td class="amount">${formatCurrency(b.electricity_amount)}<br><small>${b.electricity_units} units × ₹${b.rate_per_unit}</small></td>
      <td class="amount"><strong>${formatCurrency(b.total_amount)}</strong></td>
      <td>${b.is_paid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-danger">Unpaid</span>'}</td>
      <td>
        ${b.is_paid 
          ? `<button class="btn btn-sm btn-outline" onclick="markUnpaid(${b.id})">Undo</button>`
          : `<button class="btn btn-sm btn-success" onclick="markPaidFromBills(${b.id})">✓ Paid</button>`
        }
      </td>
    </tr>
  `).join('');
}

async function markPaidFromBills(billId) {
  await API.put(`/bills/${billId}/pay`, { paid_date: new Date().toISOString().split('T')[0] });
  showToast('Bill marked as paid!', 'success');
  filterBills();
}

async function markUnpaid(billId) {
  await API.put(`/bills/${billId}/unpay`, {});
  showToast('Bill marked as unpaid', '');
  filterBills();
}

// ========== TENANTS ==========
async function renderTenants() {
  const tenants = await API.get('/tenants');
  const properties = await API.get('/properties');

  let html = `
    <div class="card">
      <div class="card-header">
        <h3>All Tenants (${tenants.length})</h3>
        <button class="btn btn-primary" onclick="showAddTenantModal()">+ Add Tenant</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr>
            <th>Name</th><th>Phone</th><th>Property</th><th>Rent</th><th>Rate</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
  `;

  if (tenants.length === 0) {
    html += `<tr><td colspan="7" class="empty-state">No tenants yet. Click "Add Tenant" to start.</td></tr>`;
  } else {
    tenants.forEach(t => {
      html += `
        <tr>
          <td><strong>${t.name}</strong></td>
          <td>${t.phone || '-'}</td>
          <td>${t.property_name || 'Unassigned'}<br><small>${t.property_type || ''}</small></td>
          <td class="amount">${formatCurrency(t.monthly_rent)}</td>
          <td>₹${t.rate_per_unit || 0}/unit</td>
          <td>${t.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editTenant(${t.id})">Edit</button>
            ${t.is_active ? `<button class="btn btn-sm btn-danger" onclick="deactivateTenant(${t.id})">Remove</button>` : ''}
          </td>
        </tr>
      `;
    });
  }

  html += `</tbody></table></div></div>`;
  document.getElementById('pageContent').innerHTML = html;

  // Store properties for modal
  window._properties = properties;
}

function showAddTenantModal() {
  const properties = window._properties || [];
  showModal(`
    <div class="modal-header">
      <h2>Add New Tenant</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Tenant Name *</label>
      <input type="text" id="tenantName" placeholder="Enter name">
    </div>
    <div class="form-group">
      <label>Phone Number</label>
      <input type="text" id="tenantPhone" placeholder="Enter phone">
    </div>
    <div class="form-group">
      <label>Assign Property *</label>
      <select id="tenantProperty">
        <option value="">-- Select Property --</option>
        ${properties.map(p => `<option value="${p.id}">${p.name} (${p.type_name})</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Move-in Date</label>
      <input type="date" id="tenantMoveIn" value="${new Date().toISOString().split('T')[0]}">
    </div>
    <button class="btn btn-primary" onclick="saveTenant()">Save Tenant</button>
  `);
}

async function saveTenant() {
  const name = document.getElementById('tenantName').value.trim();
  const phone = document.getElementById('tenantPhone').value.trim();
  const property_id = document.getElementById('tenantProperty').value;
  const move_in_date = document.getElementById('tenantMoveIn').value;

  if (!name || !property_id) {
    showToast('Name and Property are required', 'error');
    return;
  }

  const result = await API.post('/tenants', { name, phone, property_id: parseInt(property_id), move_in_date });
  if (result.error) {
    showToast(result.error, 'error');
  } else {
    showToast('Tenant added successfully!', 'success');
    hideModal();
    renderTenants();
  }
}

async function editTenant(id) {
  const tenants = await API.get('/tenants');
  const tenant = tenants.find(t => t.id === id);
  if (!tenant) return;

  const properties = window._properties || [];
  showModal(`
    <div class="modal-header">
      <h2>Edit Tenant</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Tenant Name *</label>
      <input type="text" id="tenantName" value="${tenant.name}">
    </div>
    <div class="form-group">
      <label>Phone Number</label>
      <input type="text" id="tenantPhone" value="${tenant.phone || ''}">
    </div>
    <div class="form-group">
      <label>Assign Property *</label>
      <select id="tenantProperty">
        ${properties.map(p => `<option value="${p.id}" ${p.id === tenant.property_id ? 'selected' : ''}>${p.name} (${p.type_name})</option>`).join('')}
      </select>
    </div>
    <button class="btn btn-primary" onclick="updateTenant(${id})">Update Tenant</button>
  `);
}

async function updateTenant(id) {
  const name = document.getElementById('tenantName').value.trim();
  const phone = document.getElementById('tenantPhone').value.trim();
  const property_id = document.getElementById('tenantProperty').value;

  if (!name || !property_id) {
    showToast('Name and Property are required', 'error');
    return;
  }

  await API.put(`/tenants/${id}`, { name, phone, property_id: parseInt(property_id), is_active: 1 });
  showToast('Tenant updated!', 'success');
  hideModal();
  renderTenants();
}

async function deactivateTenant(id) {
  if (confirm('Remove this tenant? They will be marked as inactive.')) {
    await API.delete(`/tenants/${id}`);
    showToast('Tenant removed', '');
    renderTenants();
  }
}

// ========== PROPERTIES ==========
async function renderProperties() {
  const properties = await API.get('/properties');
  const types = await API.get('/property-types');

  let html = `
    <div class="card">
      <div class="card-header">
        <h3>All Properties (${properties.length})</h3>
        <button class="btn btn-primary" onclick="showAddPropertyModal()">+ Add Property</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr>
            <th>Name</th><th>Type</th><th>Monthly Rent</th><th>Elec. Rate</th><th>Tenant</th><th>Actions</th>
          </tr></thead>
          <tbody>
  `;

  if (properties.length === 0) {
    html += `<tr><td colspan="7" class="empty-state">No properties yet. Click "Add Property" to start.</td></tr>`;
  } else {
    let currentGroup = '';
    properties.forEach(p => {
      if (p.group_name && p.group_name !== currentGroup) {
        currentGroup = p.group_name;
        html += `<tr class="group-row"><td colspan="7"><strong>📁 ${currentGroup}</strong></td></tr>`;
      }
      html += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge badge-warning">${p.type_name}</span></td>
          <td class="amount">${formatCurrency(p.monthly_rent)}</td>
          <td>₹${p.rate_per_unit}/unit</td>
          <td>${p.tenant_name || '<em style="color:var(--text-light)">Vacant</em>'}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editProperty(${p.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteProperty(${p.id})">Delete</button>
          </td>
        </tr>
      `;
    });
  }

  html += `</tbody></table></div></div>`;
  document.getElementById('pageContent').innerHTML = html;
  window._propertyTypes = types;
}

function showAddPropertyModal() {
  const types = window._propertyTypes || [];
  showModal(`
    <div class="modal-header">
      <h2>Add New Property</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Property Name *</label>
      <input type="text" id="propName" placeholder="e.g. Unit A1, Shop 3">
    </div>
    <div class="form-group">
      <label>Property Type *</label>
      <select id="propType">
        ${types.map(t => `<option value="${t.id}">${t.name} (₹${t.rate_per_unit}/unit)</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Monthly Rent (₹)</label>
      <input type="number" id="propRent" placeholder="0" value="0">
    </div>
    <div class="form-group">
      <label>Address / Location</label>
      <input type="text" id="propAddress" placeholder="Optional">
    </div>
    <button class="btn btn-primary" onclick="saveProperty()">Save Property</button>
  `);
}

async function saveProperty() {
  const name = document.getElementById('propName').value.trim();
  const property_type_id = document.getElementById('propType').value;
  const monthly_rent = parseFloat(document.getElementById('propRent').value) || 0;
  const address = document.getElementById('propAddress').value.trim();

  if (!name || !property_type_id) {
    showToast('Name and Type are required', 'error');
    return;
  }

  const result = await API.post('/properties', { name, property_type_id: parseInt(property_type_id), monthly_rent, address });
  if (result.error) {
    showToast(result.error, 'error');
  } else {
    showToast('Property added!', 'success');
    hideModal();
    renderProperties();
  }
}

async function editProperty(id) {
  const properties = await API.get('/properties');
  const prop = properties.find(p => p.id === id);
  if (!prop) return;

  const types = window._propertyTypes || [];
  showModal(`
    <div class="modal-header">
      <h2>Edit Property</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Property Name *</label>
      <input type="text" id="propName" value="${prop.name}">
    </div>
    <div class="form-group">
      <label>Property Type *</label>
      <select id="propType">
        ${types.map(t => `<option value="${t.id}" ${t.id === prop.property_type_id ? 'selected' : ''}>${t.name} (₹${t.rate_per_unit}/unit)</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Monthly Rent (₹)</label>
      <input type="number" id="propRent" value="${prop.monthly_rent}">
    </div>
    <div class="form-group">
      <label>Address / Location</label>
      <input type="text" id="propAddress" value="${prop.address || ''}">
    </div>
    <button class="btn btn-primary" onclick="updateProperty(${id})">Update Property</button>
  `);
}

async function updateProperty(id) {
  const name = document.getElementById('propName').value.trim();
  const property_type_id = document.getElementById('propType').value;
  const monthly_rent = parseFloat(document.getElementById('propRent').value) || 0;
  const address = document.getElementById('propAddress').value.trim();

  if (!name || !property_type_id) {
    showToast('Name and Type are required', 'error');
    return;
  }

  await API.put(`/properties/${id}`, { name, property_type_id: parseInt(property_type_id), monthly_rent, address });
  showToast('Property updated!', 'success');
  hideModal();
  renderProperties();
}

async function deleteProperty(id) {
  if (confirm('Delete this property? This cannot be undone.')) {
    await API.delete(`/properties/${id}`);
    showToast('Property deleted', '');
    renderProperties();
  }
}

// ========== SETTINGS (Rate Management) ==========
async function renderSettings() {
  const types = await API.get('/property-types');

  let html = `
    <div class="card">
      <div class="card-header">
        <h3>Electricity Rates by Property Type</h3>
        <button class="btn btn-primary" onclick="showAddTypeModal()">+ Add Type</button>
      </div>
      <p style="color:var(--text-light);margin-bottom:15px;font-size:0.9rem;">
        Set the per-unit electricity rate for each property type. This rate is used when generating bills.
      </p>
      <div class="table-container">
        <table>
          <thead><tr>
            <th>Property Type</th><th>Rate (₹/unit)</th><th>Description</th><th>Actions</th>
          </tr></thead>
          <tbody>
            ${types.map(t => `
              <tr>
                <td><strong>${t.name}</strong></td>
                <td class="amount">₹${t.rate_per_unit}/unit</td>
                <td>${t.description || '-'}</td>
                <td>
                  <button class="btn btn-sm btn-outline" onclick="editType(${t.id}, '${t.name}', ${t.rate_per_unit}, '${t.description || ''}')">Edit</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('pageContent').innerHTML = html;
}

function showAddTypeModal() {
  showModal(`
    <div class="modal-header">
      <h2>Add Property Type</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Type Name *</label>
      <input type="text" id="typeName" placeholder="e.g. 3 BHK">
    </div>
    <div class="form-group">
      <label>Rate per Unit (₹) *</label>
      <input type="number" id="typeRate" placeholder="8" step="0.5">
    </div>
    <div class="form-group">
      <label>Description</label>
      <input type="text" id="typeDesc" placeholder="Optional description">
    </div>
    <button class="btn btn-primary" onclick="saveType()">Save Type</button>
  `);
}

async function saveType() {
  const name = document.getElementById('typeName').value.trim();
  const rate_per_unit = parseFloat(document.getElementById('typeRate').value);
  const description = document.getElementById('typeDesc').value.trim();

  if (!name || !rate_per_unit) {
    showToast('Name and Rate are required', 'error');
    return;
  }

  const result = await API.post('/property-types', { name, rate_per_unit, description });
  if (result.error) {
    showToast(result.error, 'error');
  } else {
    showToast('Property type added!', 'success');
    hideModal();
    renderSettings();
  }
}

function editType(id, name, rate, desc) {
  showModal(`
    <div class="modal-header">
      <h2>Edit Rate: ${name}</h2>
      <button class="modal-close" onclick="hideModal()">×</button>
    </div>
    <div class="form-group">
      <label>Type Name</label>
      <input type="text" id="typeName" value="${name}">
    </div>
    <div class="form-group">
      <label>Rate per Unit (₹)</label>
      <input type="number" id="typeRate" value="${rate}" step="0.5">
    </div>
    <div class="form-group">
      <label>Description</label>
      <input type="text" id="typeDesc" value="${desc}">
    </div>
    <button class="btn btn-primary" onclick="updateType(${id})">Update Rate</button>
  `);
}

async function updateType(id) {
  const name = document.getElementById('typeName').value.trim();
  const rate_per_unit = parseFloat(document.getElementById('typeRate').value);
  const description = document.getElementById('typeDesc').value.trim();

  if (!name || !rate_per_unit) {
    showToast('Name and Rate are required', 'error');
    return;
  }

  await API.put(`/property-types/${id}`, { name, rate_per_unit, description });
  showToast('Rate updated!', 'success');
  hideModal();
  renderSettings();
}

// Initial load
loadPage('dashboard');
