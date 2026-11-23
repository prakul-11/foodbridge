/**
 * FoodBridge — Client-side Application
 * Handles real-time API communication, dynamic rendering,
 * master database tables, live previews, exports, and claims.
 */

const app = {
  // Application State
  state: {
    currentTab: 'explore',
    currentMasterSubtab: 'all-listings',
    currentRole: 'ngo',
    listings: [],
    claims: [],
    restaurants: [],
    ngos: [],
    activityLogs: [],
    stats: {},
    allEntriesData: null,
  },

  // Boot up
  async init() {
    console.log('Initializing FoodBridge client application...');
    this.bindEvents();
    await Promise.all([
      this.loadStats(),
      this.loadRestaurants(),
      this.loadNgos(),
      this.loadListings(),
      this.loadClaimsTracker(),
      this.loadAllEntries()
    ]);
    this.populateSampleListingForm();
    this.updateLivePreview();
  },

  bindEvents() {
    // Escape key closes modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal('claim-modal');
        this.closeModal('details-modal');
      }
    });
  },

  // ==========================================
  // NAVIGATION & TAB SWITCHING
  // ==========================================
  switchTab(tabId) {
    this.state.currentTab = tabId;

    // Update nav button states
    document.querySelectorAll('.nav-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Specific tab refresh triggers
    if (tabId === 'all-entries') {
      this.loadAllEntries();
    } else if (tabId === 'claims-tracker') {
      this.loadClaimsTracker();
    } else if (tabId === 'explore') {
      this.loadListings();
    }

    window.scrollTo({ top: 380, behavior: 'smooth' });
  },

  switchMasterSubtab(subtabId) {
    this.state.currentMasterSubtab = subtabId;

    document.querySelectorAll('.master-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-sub') === subtabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.querySelectorAll('.subpane-table').forEach(pane => {
      if (pane.id === `subpane-${subtabId}`) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    this.filterMasterTable();
  },

  switchPartnerSubtab(role) {
    const restBtn = document.getElementById('subtab-btn-rest');
    const ngoBtn = document.getElementById('subtab-btn-ngo');
    const restPane = document.getElementById('partner-form-rest');
    const ngoPane = document.getElementById('partner-form-ngo');

    if (role === 'restaurant') {
      restBtn.classList.add('active');
      ngoBtn.classList.remove('active');
      restPane.classList.add('active');
      ngoPane.classList.remove('active');
    } else {
      restBtn.classList.remove('active');
      ngoBtn.classList.add('active');
      restPane.classList.remove('active');
      ngoPane.classList.add('active');
    }
  },

  onRoleChange(role) {
    this.state.currentRole = role;
    if (role === 'restaurant') {
      this.showToast('Switched to Restaurant Partner mode. You can list surplus food.');
      this.switchTab('list-food');
    } else if (role === 'ngo') {
      this.showToast('Switched to NGO mode. You can browse and claim surplus food.');
      this.switchTab('explore');
    } else if (role === 'admin') {
      this.showToast('Switched to Platform Admin mode. Viewing all master entries.');
      this.switchTab('all-entries');
    }
  },

  // ==========================================
  // DATA FETCHING & RENDERING
  // ==========================================
  async loadStats() {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      this.state.stats = data;

      // Update counters in Hero
      document.getElementById('stat-meals-rescued').textContent = data.totalServingsRescued || 0;
      document.getElementById('stat-active-listings').textContent = `${data.availableListings || 0} listings`;
      document.getElementById('stat-restaurants-count').textContent = data.totalRestaurants || 0;
      document.getElementById('stat-ngos-count').textContent = data.totalNgos || 0;
      document.getElementById('stat-co2-prevented').textContent = `${data.estCo2PreventedKg || 0} kg`;

      // Update Header Ticker & Pill
      document.getElementById('global-meals-badge').textContent = `🍲 ${data.totalServingsRescued || 0} Meals Rescued`;

      // Update Impact Tab
      document.getElementById('impact-co2-stat').textContent = `${data.estCo2PreventedKg || 0} kg CO₂ Saved`;
      document.getElementById('impact-meals-stat').textContent = `${data.totalServingsDistributed || data.totalServingsRescued || 0} Meals Served`;
      document.getElementById('impact-pickups-stat').textContent = `${data.collectedListings || 0} Rescues Completed`;
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  },

  async loadRestaurants() {
    try {
      const res = await fetch('/api/restaurants');
      const data = await res.json();
      this.state.restaurants = data;

      // Populate restaurant dropdown in listing form
      const select = document.getElementById('form-restaurant-select');
      select.innerHTML = '<option value="">-- Choose Partner Restaurant --</option>';
      data.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${r.name} (${r.city})`;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error('Error loading restaurants:', err);
    }
  },

  async loadNgos() {
    try {
      const res = await fetch('/api/ngos');
      const data = await res.json();
      this.state.ngos = data;

      // Populate NGO select in claim modal
      const select = document.getElementById('claim-ngo-select');
      select.innerHTML = '<option value="">-- Choose Your NGO Profile --</option>';
      data.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n.id;
        opt.textContent = `${n.name} (Reg: ${n.registration_number})`;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error('Error loading NGOs:', err);
    }
  },

  async loadListings() {
    const grid = document.getElementById('listings-grid');
    grid.innerHTML = '<div class="loading-state">Loading fresh listings...</div>';

    try {
      const res = await fetch('/api/listings');
      const data = await res.json();
      this.state.listings = data;
      this.renderListingsGrid(data);
    } catch (err) {
      console.error('Error loading listings:', err);
      grid.innerHTML = '<div class="loading-state">Unable to load listings. Check server connection.</div>';
    }
  },

  renderListingsGrid(listings) {
    const grid = document.getElementById('listings-grid');
    if (!listings || listings.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">🍲</div>
          <h3>No matching surplus food listings found</h3>
          <p style="margin-top: 6px;">Try adjusting your search filters or list new surplus food from a kitchen.</p>
          <button class="btn btn-primary" style="margin-top: 16px;" onclick="app.switchTab('list-food')">List Surplus Food</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = listings.map(item => {
      const isAvailable = item.status === 'AVAILABLE';
      const isClaimed = item.status === 'CLAIMED';
      const isCollected = item.status === 'COLLECTED';

      return `
        <div class="listing-card">
          <div class="listing-card-header">
            <div>
              <span class="category-tag">${this.escapeHTML(item.category)} • ${this.escapeHTML(item.dietary || 'Vegetarian')}</span>
              <h3 class="listing-food-title" style="margin-top: 6px;">${this.escapeHTML(item.food_name)}</h3>
              <p class="listing-restaurant-sub">📍 ${this.escapeHTML(item.restaurant_name)}</p>
            </div>
            <span class="status-pill status-${item.status}">
              ${item.status === 'AVAILABLE' ? '🟢 ' : item.status === 'CLAIMED' ? '🟡 ' : '🔵 '}
              ${item.status}
            </span>
          </div>

          <!-- Quantity Highlight (Slide 05: QUANTITY 40 meal portions) -->
          <div class="listing-quantity-banner">
            <span class="qty-label">Quantity Available</span>
            <span class="qty-val">${item.quantity_servings} ${this.escapeHTML(item.quantity_unit || 'portions')}</span>
          </div>

          <!-- Prepared & Pickup Times Grid (Slide 05) -->
          <div class="listing-details-grid">
            <div class="detail-cell">
              <div class="detail-cell-label">Prepared At</div>
              <div class="detail-cell-val">⏱️ ${this.escapeHTML(item.prepared_at)}</div>
            </div>
            <div class="detail-cell">
              <div class="detail-cell-label">Pickup By</div>
              <div class="detail-cell-val">⏳ ${this.escapeHTML(item.pickup_deadline)}</div>
            </div>
          </div>

          <!-- Storage notes if provided -->
          ${item.storage_notes ? `
            <div class="storage-notes-tag">
              🧊 <strong>Storage:</strong> ${this.escapeHTML(item.storage_notes)}
            </div>
          ` : ''}

          <!-- Location & Contact -->
          <div class="listing-info-block">
            <span class="info-icon">📍</span>
            <div>
              <strong>Location:</strong> ${this.escapeHTML(item.pickup_address)}
            </div>
          </div>

          <div class="listing-info-block">
            <span class="info-icon">👤</span>
            <div>
              <strong>Contact:</strong> ${this.escapeHTML(item.contact_person)} (${this.escapeHTML(item.contact_phone || 'N/A')})
            </div>
          </div>

          ${item.special_instructions ? `
            <div class="listing-info-block" style="color: #64748b; font-style: italic;">
              <span class="info-icon">ℹ️</span>
              <div>${this.escapeHTML(item.special_instructions)}</div>
            </div>
          ` : ''}

          ${isClaimed ? `
            <div style="background: #fef3c7; border: 1px solid #fde047; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; color: #92400e; margin-top: 10px;">
              🤝 <strong>Claimed by:</strong> ${this.escapeHTML(item.claimed_by_ngo_name || 'Verified NGO')} (Volunteer en route)
            </div>
          ` : ''}

          ${isCollected ? `
            <div style="background: #e0f2fe; border: 1px solid #7dd3fc; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; color: #0369a1; margin-top: 10px;">
              🎉 <strong>Successfully Collected:</strong> ${this.escapeHTML(item.distribution_notes || 'Distributed to beneficiaries')}
            </div>
          ` : ''}

          <div class="listing-card-footer">
            <button class="btn btn-secondary btn-sm" onclick="app.viewEntryDetails('listing', ${item.id})">
              Details
            </button>

            ${isAvailable ? `
              <button class="btn btn-primary" onclick="app.openClaimModal(${item.id})">
                <span>🤝</span> Claim for NGO
              </button>
            ` : isClaimed ? `
              <button class="btn btn-secondary btn-sm" onclick="app.switchTab('claims-tracker')">
                View Pickup Dispatch
              </button>
            ` : `
              <span style="font-size: 0.8rem; color: #059669; font-weight: 600;">✓ Rescued</span>
            `}
          </div>
        </div>
      `;
    }).join('');
  },

  filterListings() {
    const term = (document.getElementById('explore-search').value || '').toLowerCase().trim();
    const category = document.getElementById('filter-category').value;
    const dietary = document.getElementById('filter-dietary').value;
    const status = document.getElementById('filter-status').value;

    const filtered = this.state.listings.filter(item => {
      // Search
      const matchSearch = !term ||
        item.food_name.toLowerCase().includes(term) ||
        item.restaurant_name.toLowerCase().includes(term) ||
        item.pickup_address.toLowerCase().includes(term);

      // Category
      const matchCategory = category === 'ALL' || item.category === category;

      // Dietary
      const matchDietary = dietary === 'ALL' || item.dietary === dietary;

      // Status
      const matchStatus = status === 'ALL' ? true :
        status === 'AVAILABLE' ? item.status === 'AVAILABLE' :
        item.status === status;

      return matchSearch && matchCategory && matchDietary && matchStatus;
    });

    this.renderListingsGrid(filtered);
  },

  resetExploreFilters() {
    document.getElementById('explore-search').value = '';
    document.getElementById('filter-category').value = 'ALL';
    document.getElementById('filter-dietary').value = 'ALL';
    document.getElementById('filter-status').value = 'AVAILABLE';
    this.renderListingsGrid(this.state.listings);
  },

  // ==========================================
  // CLAIMS & PICKUP TRACKER (Slide 04)
  // ==========================================
  async loadClaimsTracker() {
    const tbody = document.getElementById('claims-table-body');
    if (!tbody) return;

    try {
      const res = await fetch('/api/claims');
      const data = await res.json();
      this.state.claims = data;

      const confirmed = data.filter(c => c.status === 'CONFIRMED');
      const collected = data.filter(c => c.status === 'COLLECTED');
      const servings = data.reduce((sum, c) => sum + (c.quantity_servings || 0), 0);

      document.getElementById('claims-confirmed-count').textContent = confirmed.length;
      document.getElementById('claims-collected-count').textContent = collected.length;
      document.getElementById('claims-servings-count').textContent = servings;

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">No claims yet. Browse available food to submit a claim request.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.map(claim => {
        const isConfirmed = claim.status === 'CONFIRMED';
        const isCollected = claim.status === 'COLLECTED';

        return `
          <tr>
            <td><strong>#CLM-${claim.id}</strong></td>
            <td>
              <strong>${this.escapeHTML(claim.food_name || 'Food Item')}</strong>
              <div style="font-size: 0.775rem; color: #64748b;">${claim.quantity_servings || 'N/A'} portions</div>
            </td>
            <td>
              <strong>${this.escapeHTML(claim.restaurant_name || 'Restaurant')}</strong>
              <div style="font-size: 0.775rem; color: #64748b;">${this.escapeHTML(claim.pickup_address || '')}</div>
            </td>
            <td>
              <span class="badge badge-accent">🏢 ${this.escapeHTML(claim.ngo_name)}</span>
            </td>
            <td>
              <div>👤 ${this.escapeHTML(claim.volunteer_name)}</div>
              <div style="font-size: 0.775rem; color: #64748b;">📞 ${this.escapeHTML(claim.volunteer_phone)}</div>
              <div style="font-size: 0.775rem; color: #059669; font-weight: 600;">ETA: ${this.escapeHTML(claim.estimated_pickup_time)}</div>
            </td>
            <td>
              <span class="status-pill status-${claim.status === 'CONFIRMED' ? 'CLAIMED' : 'COLLECTED'}">
                ${claim.status}
              </span>
            </td>
            <td>
              <div class="action-btn-group">
                ${isConfirmed ? `
                  <button class="btn btn-primary btn-sm" onclick="app.confirmPickupCollection(${claim.id})">
                    ✓ Confirm Pickup & Distribute
                  </button>
                ` : `
                  <span style="font-size: 0.8rem; color: #059669; font-weight: 600;">✓ Distributed</span>
                `}
                <button class="btn btn-secondary btn-sm" onclick="app.viewEntryDetails('claim', ${claim.id})">
                  View
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Error loading claims:', err);
      tbody.innerHTML = `<tr><td colspan="7" class="loading-cell">Failed to load claims tracker.</td></tr>`;
    }
  },

  async confirmPickupCollection(claimId) {
    const notes = prompt('Enter distribution note (e.g. "Distributed 40 meals to shelter residents"):', 'Distributed to community shelter beneficiaries');
    if (notes === null) return; // User cancelled

    try {
      const res = await fetch(`/api/claims/${claimId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COLLECTED', distribution_notes: notes })
      });
      if (!res.ok) throw new Error('Failed to update status');

      this.showToast('🎉 Food collection confirmed and recorded as successfully distributed!');
      await this.loadStats();
      await this.loadClaimsTracker();
      await this.loadListings();
      await this.loadAllEntries();
    } catch (err) {
      alert('Error updating claim status: ' + err.message);
    }
  },

  // =========================================================
  // 🌟 ALL USER ENTRIES & MASTER DATABASE (EXPLICIT USER DEMAND)
  // =========================================================
  async loadAllEntries() {
    try {
      const res = await fetch('/api/all-entries');
      const data = await res.json();
      this.state.allEntriesData = data;

      // Update KPI counters
      document.getElementById('m-stat-listings').textContent = data.listings.length;
      document.getElementById('m-stat-claims').textContent = data.claims.length;
      document.getElementById('m-stat-restaurants').textContent = data.restaurants.length;
      document.getElementById('m-stat-ngos').textContent = data.ngos.length;
      document.getElementById('m-stat-logs').textContent = data.activityLogs.length;

      // Update subtab badge counters
      document.getElementById('count-sub-listings').textContent = data.listings.length;
      document.getElementById('count-sub-claims').textContent = data.claims.length;
      document.getElementById('count-sub-restaurants').textContent = data.restaurants.length;
      document.getElementById('count-sub-ngos').textContent = data.ngos.length;
      document.getElementById('count-sub-logs').textContent = data.activityLogs.length;

      // Update Nav pill badge
      const totalCount = data.listings.length + data.claims.length + data.restaurants.length + data.ngos.length;
      document.getElementById('total-entries-pill').textContent = totalCount;

      // Render all master tables
      this.renderMasterListingsTable(data.listings);
      this.renderMasterClaimsTable(data.claims);
      this.renderMasterRestaurantsTable(data.restaurants);
      this.renderMasterNgosTable(data.ngos);
      this.renderMasterLogsTable(data.activityLogs);
    } catch (err) {
      console.error('Error loading all entries:', err);
    }
  },

  renderMasterListingsTable(listings) {
    const tbody = document.getElementById('master-listings-tbody');
    document.getElementById('listing-table-count').textContent = `Showing ${listings.length} entries`;

    if (!listings || listings.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" class="loading-cell">No listings registered yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = listings.map(l => `
      <tr>
        <td><strong>#${l.id}</strong></td>
        <td>
          <strong>${this.escapeHTML(l.food_name)}</strong>
        </td>
        <td><span class="category-tag">${this.escapeHTML(l.category)}</span></td>
        <td><strong>${l.quantity_servings}</strong> ${this.escapeHTML(l.quantity_unit || 'portions')}</td>
        <td>${this.escapeHTML(l.dietary || 'Veg')}</td>
        <td>${this.escapeHTML(l.prepared_at)}</td>
        <td><strong>${this.escapeHTML(l.pickup_deadline)}</strong></td>
        <td>
          <div>${this.escapeHTML(l.restaurant_name)}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${this.escapeHTML(l.pickup_address)}</div>
        </td>
        <td>
          <span class="status-pill status-${l.status}">${l.status}</span>
        </td>
        <td>
          ${l.claimed_by_ngo_name ? `<span class="badge badge-accent">🏢 ${this.escapeHTML(l.claimed_by_ngo_name)}</span>` : '<span style="color:#94a3b8">—</span>'}
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-secondary btn-sm" onclick="app.viewEntryDetails('listing', ${l.id})" title="View complete entry details">
              👁️ View
            </button>
            <select style="font-size: 0.75rem; padding: 3px 6px;" onchange="app.updateListingStatusDirectly(${l.id}, this.value)">
              <option value="" disabled selected>Status...</option>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="CLAIMED">CLAIMED</option>
              <option value="COLLECTED">COLLECTED</option>
            </select>
            <button class="btn btn-danger btn-sm" onclick="app.deleteListingEntry(${l.id})" title="Delete entry">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  renderMasterClaimsTable(claims) {
    const tbody = document.getElementById('master-claims-tbody');
    document.getElementById('claims-table-count').textContent = `Showing ${claims.length} entries`;

    if (!claims || claims.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="loading-cell">No claims submitted yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = claims.map(c => `
      <tr>
        <td><strong>#CLM-${c.id}</strong></td>
        <td>#${c.listing_id}</td>
        <td><strong>${this.escapeHTML(c.food_name || 'Surplus Item')}</strong></td>
        <td><span class="badge badge-accent">🏢 ${this.escapeHTML(c.ngo_name)}</span></td>
        <td>${this.escapeHTML(c.volunteer_name)}</td>
        <td>${this.escapeHTML(c.volunteer_phone)}</td>
        <td><strong>${this.escapeHTML(c.estimated_pickup_time)}</strong></td>
        <td><span class="status-pill status-${c.status === 'CONFIRMED' ? 'CLAIMED' : 'COLLECTED'}">${c.status}</span></td>
        <td style="font-size: 0.75rem; color: #64748b;">${c.created_at || 'Just now'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="app.viewEntryDetails('claim', ${c.id})">
            👁️ View
          </button>
        </td>
      </tr>
    `).join('');
  },

  renderMasterRestaurantsTable(restaurants) {
    const tbody = document.getElementById('master-restaurants-tbody');
    document.getElementById('restaurants-table-count').textContent = `Showing ${restaurants.length} entries`;

    if (!restaurants || restaurants.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="loading-cell">No restaurants registered yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = restaurants.map(r => `
      <tr>
        <td><strong>#R-${r.id}</strong></td>
        <td><strong>${this.escapeHTML(r.name)}</strong></td>
        <td>${this.escapeHTML(r.contact_person)}</td>
        <td>${this.escapeHTML(r.phone)}</td>
        <td>${this.escapeHTML(r.address)}, <strong>${this.escapeHTML(r.city)}</strong></td>
        <td><code>${this.escapeHTML(r.fssai_license || 'Verified FSSAI')}</code></td>
        <td>${this.escapeHTML(r.operating_hours || 'Standard Hours')}</td>
        <td><span class="status-pill status-AVAILABLE">✓ Verified</span></td>
        <td style="font-size: 0.75rem; color: #64748b;">${r.created_at || 'Registered'}</td>
      </tr>
    `).join('');
  },

  renderMasterNgosTable(ngos) {
    const tbody = document.getElementById('master-ngos-tbody');
    document.getElementById('ngos-table-count').textContent = `Showing ${ngos.length} entries`;

    if (!ngos || ngos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="loading-cell">No NGOs registered yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = ngos.map(n => `
      <tr>
        <td><strong>#NGO-${n.id}</strong></td>
        <td><strong>${this.escapeHTML(n.name)}</strong></td>
        <td><code>${this.escapeHTML(n.registration_number)}</code></td>
        <td>${this.escapeHTML(n.contact_person)}</td>
        <td>${this.escapeHTML(n.phone)}</td>
        <td>${this.escapeHTML(n.address)}, <strong>${this.escapeHTML(n.city)}</strong></td>
        <td><strong>${n.beneficiaries_daily || 50}</strong> people/day</td>
        <td>🚐 ${this.escapeHTML(n.vehicle_type || 'Van')}</td>
        <td style="font-size: 0.75rem; color: #64748b;">${n.created_at || 'Registered'}</td>
      </tr>
    `).join('');
  },

  renderMasterLogsTable(logs) {
    const tbody = document.getElementById('master-logs-tbody');
    document.getElementById('logs-table-count').textContent = `Showing ${logs.length} entries`;

    if (!logs || logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">No audit actions recorded yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td>#${l.id}</td>
        <td style="font-size: 0.775rem; color: #64748b; white-space: nowrap;">${l.created_at}</td>
        <td><span class="category-tag">${this.escapeHTML(l.event_type)}</span></td>
        <td><span class="badge badge-light" style="color: #334155; background: #e2e8f0;">${this.escapeHTML(l.actor_type)}</span></td>
        <td><strong>${this.escapeHTML(l.actor_name)}</strong></td>
        <td>${this.escapeHTML(l.description)}</td>
      </tr>
    `).join('');
  },

  filterMasterTable() {
    if (!this.state.allEntriesData) return;
    const term = (document.getElementById('master-search-input').value || '').toLowerCase().trim();
    const status = document.getElementById('master-status-filter').value;
    const category = document.getElementById('master-category-filter').value;

    const sub = this.state.currentMasterSubtab;

    if (sub === 'all-listings') {
      const filtered = this.state.allEntriesData.listings.filter(l => {
        const matchSearch = !term ||
          l.food_name.toLowerCase().includes(term) ||
          l.restaurant_name.toLowerCase().includes(term) ||
          l.pickup_address.toLowerCase().includes(term) ||
          (l.contact_person && l.contact_person.toLowerCase().includes(term));
        const matchStatus = status === 'ALL' || l.status === status;
        const matchCategory = category === 'ALL' || l.category === category;
        return matchSearch && matchStatus && matchCategory;
      });
      this.renderMasterListingsTable(filtered);
    } else if (sub === 'all-claims') {
      const filtered = this.state.allEntriesData.claims.filter(c => {
        const matchSearch = !term ||
          c.ngo_name.toLowerCase().includes(term) ||
          (c.volunteer_name && c.volunteer_name.toLowerCase().includes(term)) ||
          (c.food_name && c.food_name.toLowerCase().includes(term));
        return matchSearch;
      });
      this.renderMasterClaimsTable(filtered);
    } else if (sub === 'all-restaurants') {
      const filtered = this.state.allEntriesData.restaurants.filter(r => {
        return !term ||
          r.name.toLowerCase().includes(term) ||
          r.city.toLowerCase().includes(term) ||
          r.contact_person.toLowerCase().includes(term);
      });
      this.renderMasterRestaurantsTable(filtered);
    } else if (sub === 'all-ngos') {
      const filtered = this.state.allEntriesData.ngos.filter(n => {
        return !term ||
          n.name.toLowerCase().includes(term) ||
          n.registration_number.toLowerCase().includes(term) ||
          n.city.toLowerCase().includes(term);
      });
      this.renderMasterNgosTable(filtered);
    } else if (sub === 'all-logs') {
      const filtered = this.state.allEntriesData.activityLogs.filter(l => {
        return !term ||
          l.description.toLowerCase().includes(term) ||
          l.actor_name.toLowerCase().includes(term) ||
          l.event_type.toLowerCase().includes(term);
      });
      this.renderMasterLogsTable(filtered);
    }
  },

  async updateListingStatusDirectly(id, newStatus) {
    try {
      const res = await fetch(`/api/listings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (!res.ok) throw new Error('Failed to update status');

      this.showToast(`Listing #${id} status updated to ${newStatus}`);
      await this.loadStats();
      await this.loadListings();
      await this.loadAllEntries();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteListingEntry(id) {
    if (!confirm(`Are you sure you want to permanently delete listing #${id}?`)) return;

    try {
      const res = await fetch(`/api/listings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete listing');

      this.showToast(`Listing #${id} deleted successfully`);
      await this.loadStats();
      await this.loadListings();
      await this.loadAllEntries();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  // ==========================================
  // EXPORT TO CSV & JSON
  // ==========================================
  exportEntriesCSV() {
    if (!this.state.allEntriesData) return alert('Data not loaded yet');
    const sub = this.state.currentMasterSubtab;
    let filename = `foodbridge_${sub}_${new Date().toISOString().slice(0, 10)}.csv`;
    let rows = [];

    if (sub === 'all-listings') {
      const items = this.state.allEntriesData.listings;
      rows.push(['ID', 'Food Name', 'Category', 'Servings', 'Unit', 'Dietary', 'Prepared At', 'Pickup Deadline', 'Restaurant', 'Address', 'Status', 'Claimed By NGO']);
      items.forEach(l => {
        rows.push([l.id, l.food_name, l.category, l.quantity_servings, l.quantity_unit, l.dietary, l.prepared_at, l.pickup_deadline, l.restaurant_name, l.pickup_address, l.status, l.claimed_by_ngo_name || '']);
      });
    } else if (sub === 'all-claims') {
      const items = this.state.allEntriesData.claims;
      rows.push(['Claim ID', 'Listing ID', 'Food Item', 'NGO Name', 'Volunteer', 'Phone', 'ETA', 'Status', 'Created At']);
      items.forEach(c => {
        rows.push([c.id, c.listing_id, c.food_name || '', c.ngo_name, c.volunteer_name, c.volunteer_phone, c.estimated_pickup_time, c.status, c.created_at]);
      });
    } else if (sub === 'all-restaurants') {
      const items = this.state.allEntriesData.restaurants;
      rows.push(['ID', 'Restaurant Name', 'Contact Person', 'Phone', 'Email', 'Address', 'City', 'FSSAI License']);
      items.forEach(r => {
        rows.push([r.id, r.name, r.contact_person, r.phone, r.email, r.address, r.city, r.fssai_license]);
      });
    } else if (sub === 'all-ngos') {
      const items = this.state.allEntriesData.ngos;
      rows.push(['ID', 'NGO Name', 'Registration No', 'Contact Person', 'Phone', 'Email', 'Address', 'City', 'Daily Beneficiaries', 'Vehicle']);
      items.forEach(n => {
        rows.push([n.id, n.name, n.registration_number, n.contact_person, n.phone, n.email, n.address, n.city, n.beneficiaries_daily, n.vehicle_type]);
      });
    } else {
      const items = this.state.allEntriesData.activityLogs;
      rows.push(['Log ID', 'Timestamp', 'Event Type', 'Actor Type', 'Actor Name', 'Description']);
      items.forEach(l => {
        rows.push([l.id, l.created_at, l.event_type, l.actor_type, l.actor_name, l.description]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast(`Exported ${sub} table to ${filename}`);
  },

  exportEntriesJSON() {
    if (!this.state.allEntriesData) return alert('Data not loaded yet');
    const filename = `foodbridge_full_database_dump_${new Date().toISOString().slice(0, 10)}.json`;
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.state.allEntriesData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast(`Exported complete database dump to ${filename}`);
  },

  // ==========================================
  // FORM SUBMISSIONS (Listings, Rest, NGO)
  // ==========================================
  onSelectRestaurantForListing(restId) {
    if (!restId) return;
    const r = this.state.restaurants.find(item => item.id === Number(restId));
    if (r) {
      document.getElementById('form-pickup-address').value = `${r.address}, ${r.city}`;
      document.getElementById('form-contact-person').value = r.contact_person;
      document.getElementById('form-contact-phone').value = r.phone;
      this.updateLivePreview();
    }
  },

  populateSampleListingForm() {
    // Fill Slide 05 Example ("Vegetable pulao", 40 meal portions, 6:00 PM, 8:00 PM)
    if (this.state.restaurants.length > 0) {
      document.getElementById('form-restaurant-select').value = this.state.restaurants[0].id;
    }
    document.getElementById('form-food-name').value = 'Vegetable Pulao with Fresh Mint Raita';
    document.getElementById('form-category').value = 'Cooked Meals';
    document.getElementById('form-quantity').value = 40;
    document.getElementById('form-quantity-unit').value = 'meal portions';
    document.getElementById('form-dietary').value = 'Vegetarian';
    document.getElementById('form-prepared_at' || 'form-prepared-at').value = 'Today 6:00 PM';
    document.getElementById('form-pickup-deadline').value = 'Today 8:00 PM';
    document.getElementById('form-storage-notes').value = 'Held in thermal warmer >65°C, untouched banquet excess';
    document.getElementById('form-packaging').value = 'Packed in food-grade containers';
    document.getElementById('form-pickup-address').value = 'Plot 42, Bandra West, Linking Road, Mumbai';
    document.getElementById('form-contact-person').value = 'Chef Rajesh Sharma';
    document.getElementById('form-contact-phone').value = '+91 98201 12345';
    document.getElementById('form-special-instructions').value = 'Dispatch through kitchen back service entrance. Ask for Rajesh.';
    document.getElementById('form-safety-check').checked = true;
    this.updateLivePreview();
  },

  updateLivePreview() {
    const card = document.getElementById('live-preview-card');
    if (!card) return;

    const restSelect = document.getElementById('form-restaurant-select');
    const restName = restSelect && restSelect.selectedIndex > 0 ? restSelect.options[restSelect.selectedIndex].text : 'Select Restaurant';
    const foodName = document.getElementById('form-food-name').value || 'Surplus Meal Title';
    const category = document.getElementById('form-category').value || 'Cooked Meals';
    const qty = document.getElementById('form-quantity').value || '40';
    const unit = document.getElementById('form-quantity-unit').value || 'meal portions';
    const dietary = document.getElementById('form-dietary').value || 'Vegetarian';
    const prepAt = document.getElementById('form-prepared-at').value || 'Today 6:00 PM';
    const pickupBy = document.getElementById('form-pickup-deadline').value || 'Today 8:00 PM';
    const storage = document.getElementById('form-storage-notes').value || 'Maintained hot in insulated warmer';
    const addr = document.getElementById('form-pickup-address').value || 'Restaurant address and city';
    const contact = document.getElementById('form-contact-person').value || 'Chef / Manager';

    card.innerHTML = `
      <div class="listing-card-header">
        <div>
          <span class="category-tag">${this.escapeHTML(category)} • ${this.escapeHTML(dietary)}</span>
          <h3 class="listing-food-title" style="margin-top: 6px;">${this.escapeHTML(foodName)}</h3>
          <p class="listing-restaurant-sub">📍 ${this.escapeHTML(restName)}</p>
        </div>
        <span class="status-pill status-AVAILABLE">🟢 AVAILABLE</span>
      </div>

      <div class="listing-quantity-banner">
        <span class="qty-label">Quantity Available</span>
        <span class="qty-val">${qty} ${this.escapeHTML(unit)}</span>
      </div>

      <div class="listing-details-grid">
        <div class="detail-cell">
          <div class="detail-cell-label">Prepared At</div>
          <div class="detail-cell-val">⏱️ ${this.escapeHTML(prepAt)}</div>
        </div>
        <div class="detail-cell">
          <div class="detail-cell-label">Pickup By</div>
          <div class="detail-cell-val">⏳ ${this.escapeHTML(pickupBy)}</div>
        </div>
      </div>

      <div class="storage-notes-tag">
        🧊 <strong>Storage:</strong> ${this.escapeHTML(storage)}
      </div>

      <div class="listing-info-block">
        <span class="info-icon">📍</span>
        <div><strong>Location:</strong> ${this.escapeHTML(addr)}</div>
      </div>

      <div class="listing-info-block">
        <span class="info-icon">👤</span>
        <div><strong>Contact:</strong> ${this.escapeHTML(contact)}</div>
      </div>
    `;
  },

  async handleListingSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-listing-btn');
    btn.disabled = true;
    btn.textContent = 'Publishing...';

    const restSelect = document.getElementById('form-restaurant-select');
    const restId = Number(restSelect.value);
    const restName = restSelect.selectedIndex > 0 ? restSelect.options[restSelect.selectedIndex].text.split(' (')[0] : 'Restaurant Partner';

    const payload = {
      restaurant_id: restId || null,
      restaurant_name: restName,
      food_name: document.getElementById('form-food-name').value.trim(),
      category: document.getElementById('form-category').value,
      quantity_servings: Number(document.getElementById('form-quantity').value) || 1,
      quantity_unit: document.getElementById('form-quantity-unit').value,
      dietary: document.getElementById('form-dietary').value,
      prepared_at: document.getElementById('form-prepared-at').value.trim(),
      pickup_deadline: document.getElementById('form-pickup-deadline').value.trim(),
      storage_notes: document.getElementById('form-storage-notes').value.trim(),
      packaging_type: document.getElementById('form-packaging').value,
      pickup_address: document.getElementById('form-pickup-address').value.trim(),
      contact_person: document.getElementById('form-contact-person').value.trim(),
      contact_phone: document.getElementById('form-contact-phone').value.trim(),
      special_instructions: document.getElementById('form-special-instructions').value.trim()
    };

    try {
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to publish listing');
      }

      const created = await res.json();
      this.showToast(`🎉 Surplus food listed successfully! ID #${created.id} is now available for nearby NGOs.`);

      // Reset form
      document.getElementById('food-listing-form').reset();
      this.updateLivePreview();

      // Refresh data
      await this.loadStats();
      await this.loadListings();
      await this.loadAllEntries();

      // Switch to explore tab to see it live
      setTimeout(() => this.switchTab('explore'), 1200);
    } catch (err) {
      alert('Error creating listing: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>🚀</span> Publish Available Listing';
    }
  },

  async handleRestaurantSubmit(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('rest-name').value.trim(),
      contact_person: document.getElementById('rest-contact').value.trim(),
      phone: document.getElementById('rest-phone').value.trim(),
      email: document.getElementById('rest-email').value.trim(),
      address: document.getElementById('rest-address').value.trim(),
      city: document.getElementById('rest-city').value.trim(),
      area: document.getElementById('rest-area').value.trim(),
      fssai_license: document.getElementById('rest-license').value.trim(),
      operating_hours: document.getElementById('rest-hours').value.trim()
    };

    try {
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to register restaurant');

      const data = await res.json();
      this.showToast(`Restaurant "${data.name}" registered successfully!`);
      e.target.reset();

      await this.loadRestaurants();
      await this.loadStats();
      await this.loadAllEntries();
      this.switchTab('list-food');
    } catch (err) {
      alert('Error registering restaurant: ' + err.message);
    }
  },

  async handleNgoSubmit(e) {
    e.preventDefault();
    const payload = {
      name: document.getElementById('ngo-name').value.trim(),
      registration_number: document.getElementById('ngo-reg').value.trim(),
      contact_person: document.getElementById('ngo-contact').value.trim(),
      phone: document.getElementById('ngo-phone').value.trim(),
      email: document.getElementById('ngo-email').value.trim(),
      address: document.getElementById('ngo-address').value.trim(),
      city: document.getElementById('ngo-city').value.trim(),
      beneficiaries_daily: Number(document.getElementById('ngo-beneficiaries').value) || 50,
      vehicle_type: document.getElementById('ngo-vehicle').value
    };

    try {
      const res = await fetch('/api/ngos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to register NGO');

      const data = await res.json();
      this.showToast(`Verified NGO "${data.name}" onboarded!`);
      e.target.reset();

      await this.loadNgos();
      await this.loadStats();
      await this.loadAllEntries();
      this.switchTab('explore');
    } catch (err) {
      alert('Error registering NGO: ' + err.message);
    }
  },

  // ==========================================
  // CLAIM MODAL & SUBMISSION (Slide 04)
  // ==========================================
  openClaimModal(listingId) {
    const listing = this.state.listings.find(l => l.id === listingId);
    if (!listing) return;

    document.getElementById('claim-listing-id').value = listing.id;
    document.getElementById('modal-food-title').textContent = `Claim: ${listing.food_name}`;

    const summary = document.getElementById('modal-listing-summary');
    summary.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <strong style="font-size: 1.05rem;">${this.escapeHTML(listing.food_name)}</strong>
        <span class="badge badge-accent">${listing.quantity_servings} ${this.escapeHTML(listing.quantity_unit || 'portions')}</span>
      </div>
      <div style="font-size: 0.85rem; color: #475569;">
        📍 <strong>Kitchen:</strong> ${this.escapeHTML(listing.restaurant_name)}<br>
        🏠 <strong>Address:</strong> ${this.escapeHTML(listing.pickup_address)}<br>
        ⏳ <strong>Pickup Deadline:</strong> ${this.escapeHTML(listing.pickup_deadline)}<br>
        👤 <strong>Kitchen Contact:</strong> ${this.escapeHTML(listing.contact_person)} (${this.escapeHTML(listing.contact_phone)})
      </div>
    `;

    document.getElementById('claim-modal').classList.remove('hidden');
  },

  onNgoSelectInClaim(ngoId) {
    if (!ngoId) return;
    const n = this.state.ngos.find(item => item.id === Number(ngoId));
    if (n) {
      document.getElementById('claim-volunteer-name').value = n.contact_person;
      document.getElementById('claim-volunteer-phone').value = n.phone;
    }
  },

  async handleClaimSubmit(e) {
    e.preventDefault();
    const listingId = Number(document.getElementById('claim-listing-id').value);
    const ngoSelect = document.getElementById('claim-ngo-select');
    const ngoId = Number(ngoSelect.value);
    const ngoName = ngoSelect.options[ngoSelect.selectedIndex].text.split(' (')[0];

    const payload = {
      listing_id: listingId,
      ngo_id: ngoId || null,
      ngo_name: ngoName,
      estimated_pickup_time: document.getElementById('claim-eta').value.trim(),
      volunteer_name: document.getElementById('claim-volunteer-name').value.trim(),
      volunteer_phone: document.getElementById('claim-volunteer-phone').value.trim(),
      notes: document.getElementById('claim-notes').value.trim()
    };

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit claim');
      }

      this.closeModal('claim-modal');
      this.showToast('🤝 Food claim successfully registered! The kitchen has been notified.');

      await this.loadStats();
      await this.loadListings();
      await this.loadClaimsTracker();
      await this.loadAllEntries();

      this.switchTab('claims-tracker');
    } catch (err) {
      alert('Error claiming food: ' + err.message);
    }
  },

  // ==========================================
  // VIEW ENTRY DETAILS MODAL
  // ==========================================
  viewEntryDetails(type, id) {
    const modal = document.getElementById('details-modal');
    const title = document.getElementById('details-modal-title');
    const body = document.getElementById('details-modal-body');

    let item = null;
    if (type === 'listing') {
      item = (this.state.allEntriesData ? this.state.allEntriesData.listings : this.state.listings).find(l => l.id === id);
      title.textContent = `Food Listing #${id} — ${item ? item.food_name : ''}`;
    } else if (type === 'claim') {
      item = (this.state.allEntriesData ? this.state.allEntriesData.claims : this.state.claims).find(c => c.id === id);
      title.textContent = `Claim Record #${id} — ${item ? item.ngo_name : ''}`;
    }

    if (!item) return;

    body.innerHTML = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <pre style="white-space: pre-wrap; font-family: monospace; font-size: 0.85rem; color: #0f172a;">${this.escapeHTML(JSON.stringify(item, null, 2))}</pre>
      </div>
      <div style="display: flex; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="app.closeModal('details-modal')">Close</button>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  // ==========================================
  // UTILITIES & MODALS
  // ==========================================
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  },

  closeModalOnClickOutside(event, modalId) {
    if (event.target.id === modalId) {
      this.closeModal(modalId);
    }
  },

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  },

  async resetDemoData() {
    if (!confirm('Reset database with clean initial sample data according to PPT slides?')) return;
    try {
      const res = await fetch('/api/reset-demo', { method: 'POST' });
      if (!res.ok) throw new Error('Reset failed');
      this.showToast('✅ Demo database reset and re-seeded with Slide 05/07 sample entries!');
      await this.init();
    } catch (err) {
      alert('Error resetting demo: ' + err.message);
    }
  },

  escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
