/**
 * Quotation Import & Production Mapping Modal
 * On-Demand integration between ZOOSH Quotation System and Production Schedule.
 * 
 * Complies with all Phase 1-11 constraints:
 * - Strictly on-demand fetching (0 background polling).
 * - Read-only query to Quotation System (0 modifications to quotation records).
 * - Strict separation between original quotation specs and manufacturing details.
 * - Manual conversion status management independent of quotation system.
 * - Duplicate import prevention.
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.QuotationImportModal = {
  isOpen: false,
  step: 'LIST', // 'LIST' | 'REVIEW'
  loading: false,
  error: null,
  
  quotations: [],
  searchQuery: '',
  conversionFilter: 'ALL', // 'ALL' | 'CONVERTED' | 'NOT_REVIEWED' | 'NOT_CONVERTED'
  importFilter: 'ALL',     // 'ALL' | 'NOT_IMPORTED' | 'IMPORTED'
  sortOrder: 'NEWEST',     // 'NEWEST' | 'OLDEST'

  selectedQuotation: null,
  selectedProductIds: new Set(),
  productionSpecs: {},
  projectForm: {},

  open() {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canCreate()) {
      alert('Permission Denied: Only Managers can import quotations into production.');
      return;
    }

    this.isOpen = true;
    this.step = 'LIST';
    this.error = null;
    this.selectedQuotation = null;

    this.renderModal();

    // Fetch quotations on-demand immediately on open
    if (this.quotations.length === 0) {
      this.fetchQuotations();
    }
  },

  close() {
    this.isOpen = false;
    const modalEl = document.getElementById('zoosh-quotation-import-modal-overlay');
    if (modalEl) modalEl.remove();
  },

  async fetchQuotations() {
    this.loading = true;
    this.error = null;
    this.renderContent();

    try {
      const client = window.Zoosh.Services && window.Zoosh.Services.QuotationClient;
      if (!client) {
        throw new Error('QuotationClient service is not available.');
      }

      this.quotations = await client.fetchQuotations();
      this.loading = false;
      this.renderContent();
    } catch (err) {
      console.error('Error fetching quotations:', err);
      this.loading = false;
      this.error = err.message || 'Failed to connect to Quotation Supabase backend.';
      this.renderContent();
    }
  },

  setConversionStatus(quotationId, status) {
    const q = this.quotations.find(item => String(item.id) === String(quotationId));
    if (!q) return;

    window.Zoosh.State.setQuotationConversionStatus(quotationId, status, {
      no: q.no,
      clientName: q.clientNormalized.name,
      date: q.date,
      grandTotal: q.totals.grandTotal
    });

    this.renderContent();
  },

  selectQuotationForReview(quotationId) {
    let q = this.quotations.find(item => String(item.id) === String(quotationId));
    if (!q) return;

    const tracking = window.Zoosh.State.getQuotationTracking(quotationId);
    if (tracking.conversionStatus !== 'CONVERTED') {
      alert('Only quotations marked as "Converted" can be imported into production. Please mark this quotation as Converted first.');
      return;
    }

    this.selectedQuotation = q;
    this.step = 'REVIEW';

    // Initialize all product IDs as selected by default
    const items = q.items || [];
    this.selectedProductIds = new Set(items.map(String));

    // Initialize production specifications pre-populated with reasonable manufacturing defaults
    this.productionSpecs = {};
    const itemData = q.itemData || {};
    const afState = q.afState || {};

    items.forEach(itemId => {
      const orig = itemData[itemId] || {};
      const af = afState[itemId] || {};

      // Auto-extract wood type or finish from afState if available
      let woodType = '';
      if (af.selections && af.selections.WOOD && Array.isArray(af.selections.WOOD.subtypes)) {
        woodType = af.selections.WOOD.subtypes.join(', ');
      }

      this.productionSpecs[itemId] = {
        name: orig.name || 'Custom Furniture Item',
        measurements: '',
        woodType: woodType,
        structure: 'Solid Frame with reinforced joinery',
        foam: '40 Density High-Resilience Foam',
        fabric: 'Standard Upholstery Specification',
        qty: parseInt(orig.qty, 10) || 1,
        flowTypeId: 'preset_1', // Carpentry -> Polish -> Upholstery default
        notes: ''
      };
    });

    // Check if client exists to pre-populate project name & location
    const client = q.clientNormalized;
    const existingClient = this.findMatchingClient(client.name, client.phone);

    const defaultDeadline = window.Zoosh.State._calculateDefaultDeadline 
      ? window.Zoosh.State._calculateDefaultDeadline(21) 
      : '2026-11-30';

    this.projectForm = {
      name: `${client.name} - ${q.no}`,
      location: existingClient ? (existingClient.location || client.location) : (client.location || 'Factory Floor'),
      confirmedDate: window.Zoosh.Config.CURRENT_DATE,
      deliveryDeadline: defaultDeadline,
      notes: `Imported from Quotation ${q.no} on ${new Date().toLocaleDateString()}.`
    };

    // If itemPhotos not yet loaded, fetch asynchronously in background and hydrate thumbnails
    if (!q.itemPhotos && window.Zoosh.Services && window.Zoosh.Services.QuotationClient) {
      window.Zoosh.Services.QuotationClient.fetchQuotationById(quotationId).then(fullQ => {
        if (fullQ && fullQ.itemPhotos) {
          q.itemPhotos = fullQ.itemPhotos;
          if (this.selectedQuotation && String(this.selectedQuotation.id) === String(quotationId)) {
            this.selectedQuotation.itemPhotos = fullQ.itemPhotos;
            if (this.step === 'REVIEW') {
              this.renderContent();
            }
          }
        }
      }).catch(err => {
        console.warn('Could not load quotation photos:', err);
      });
    }

    this.renderContent();
  },

  findMatchingClient(name, phone) {
    const clients = (window.Zoosh.State && window.Zoosh.State.getState().clients) || [];
    const cleanPhone = (phone || '').replace(/\D/g, '');
    const cleanName = (name || '').trim().toLowerCase();

    if (cleanPhone && cleanPhone.length >= 7) {
      const match = clients.find(c => (c.phone || '').replace(/\D/g, '').includes(cleanPhone));
      if (match) return match;
    }

    if (cleanName) {
      return clients.find(c => (c.name || '').trim().toLowerCase() === cleanName) || null;
    }

    return null;
  },

  toggleProductSelection(itemId) {
    itemId = String(itemId);
    if (this.selectedProductIds.has(itemId)) {
      this.selectedProductIds.delete(itemId);
    } else {
      this.selectedProductIds.add(itemId);
    }
    this.renderContent();
  },

  toggleSelectAllProducts() {
    const items = (this.selectedQuotation && this.selectedQuotation.items) || [];
    if (this.selectedProductIds.size === items.length) {
      this.selectedProductIds.clear();
    } else {
      this.selectedProductIds = new Set(items.map(String));
    }
    this.renderContent();
  },

  handleProductionFieldChange(itemId, field, value) {
    if (!this.productionSpecs[itemId]) {
      this.productionSpecs[itemId] = {};
    }
    this.productionSpecs[itemId][field] = value;
  },

  handleProjectFormFieldChange(field, value) {
    this.projectForm[field] = value;
  },

  confirmAndCreateProject() {
    if (this.selectedProductIds.size === 0) {
      alert('Please select at least one product to import into the production project.');
      return;
    }

    if (!this.projectForm.name || !this.projectForm.name.trim()) {
      alert('Please enter a valid project name.');
      return;
    }

    if (!this.projectForm.deliveryDeadline) {
      alert('Please specify a fixed delivery deadline for the production schedule.');
      return;
    }

    const q = this.selectedQuotation;
    const clientNorm = q.clientNormalized;
    const itemData = q.itemData || {};

    const selectedProducts = Array.from(this.selectedProductIds).map(itemId => {
      const orig = itemData[itemId] || {};
      const prod = this.productionSpecs[itemId] || {};
      const photoUrl = (q.itemPhotos && q.itemPhotos[itemId]) || null;

      const unitRate = parseFloat(orig.unit) || 0;
      const qty = parseInt(orig.qty, 10) || 1;

      return {
        itemId: itemId,
        photoUrl: photoUrl,
        photo: photoUrl,
        image: photoUrl,
        original: {
          name: orig.name || '',
          spec: orig.spec || '',
          measurements: '',
          unit: unitRate,
          qty: qty,
          utype: orig.utype || 'nos',
          total: unitRate * qty,
          photoUrl: photoUrl
        },
        production: {
          name: prod.name || orig.name || 'Furniture Item',
          measurements: prod.measurements || '',
          woodType: prod.woodType || '',
          structure: prod.structure || '',
          foam: prod.foam || '',
          fabric: prod.fabric || '',
          qty: parseInt(prod.qty, 10) || qty,
          flowTypeId: prod.flowTypeId || 'preset_1',
          notes: prod.notes || ''
        }
      };
    });

    const payload = {
      quotation: q,
      clientData: {
        name: clientNorm.name,
        location: clientNorm.location,
        phone: clientNorm.phone
      },
      projectData: {
        name: this.projectForm.name.trim(),
        location: this.projectForm.location.trim(),
        confirmedDate: this.projectForm.confirmedDate,
        deliveryDeadline: this.projectForm.deliveryDeadline,
        notes: this.projectForm.notes.trim()
      },
      selectedProducts: selectedProducts
    };

    try {
      const result = window.Zoosh.State.importProjectFromQuotation(payload);

      if (result.duplicate) {
        const proceed = confirm(`${result.message}\n\nDo you want to import this quotation again as another separate project?`);
        if (!proceed) return;
        payload.allowDuplicate = true;
        const secondAttempt = window.Zoosh.State.importProjectFromQuotation(payload);
        if (!secondAttempt.success) {
          alert('Failed to import project: ' + secondAttempt.message);
          return;
        }
      }

      this.close();

      // Show toast message
      if (window.Zoosh.Toast) {
        window.Zoosh.Toast.show(`Project "${payload.projectData.name}" created successfully with ${selectedProducts.length} item(s)!`, 'success');
      } else {
        alert(`Success! Production project "${payload.projectData.name}" created with ${selectedProducts.length} item(s).`);
      }

      // Automatically navigate to the Projects view to show the new project
      if (window.Zoosh.Views && window.Zoosh.Views.Projects) {
        window.Zoosh.Views.Projects.activeTab = 'projects';
        window.Zoosh.Views.Projects.searchQuery = q.no;
        const container = document.getElementById('view-container');
        if (container) {
          window.Zoosh.Views.Projects.render(container);
        }
      }
    } catch (err) {
      console.error('Failed to import quotation:', err);
      alert('Error creating production project: ' + err.message);
    }
  },

  renderModal() {
    let overlay = document.getElementById('zoosh-quotation-import-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'zoosh-quotation-import-modal-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 16px;
      `;
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div style="
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        width: 100%;
        max-width: ${this.step === 'LIST' ? '960px' : '1080px'};
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--border-light);
      ">
        <!-- Modal Header -->
        <div style="
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: #ecfdf5; border: 1px solid #a7f3d0; display: flex; align-items: center; justify-content: center; color: #065f46; font-size: 18px;">
              📄
            </div>
            <div>
              <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--text-main);">
                ${this.step === 'LIST' ? 'Import Quotation into Production' : `Review &amp; Map Quotation: ${this.selectedQuotation.no}`}
              </h2>
              <div style="font-size: 11.5px; color: var(--text-muted); display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                <span>On-Demand Cross-Project Query</span>
                <span>•</span>
                <span style="display: inline-flex; align-items: center; gap: 4px; color: #059669; font-weight: 600;">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span>
                  Quotation Supabase (Read-Only)
                </span>
              </div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${this.step === 'LIST' ? `
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="window.Zoosh.QuotationImportModal.fetchQuotations()" 
                title="Refresh Quotations"
                style="display: flex; align-items: center; gap: 6px; font-size: 12px;"
              >
                <span>🔄</span> Refresh
              </button>
            ` : `
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                onclick="window.Zoosh.QuotationImportModal.step = 'LIST'; window.Zoosh.QuotationImportModal.renderContent();"
                style="display: flex; align-items: center; gap: 6px; font-size: 12px;"
              >
                ← Back to List
              </button>
            `}
            <button 
              type="button" 
              class="btn btn-secondary btn-sm" 
              onclick="window.Zoosh.QuotationImportModal.close()"
              style="padding: 4px 10px; font-size: 16px; line-height: 1;"
            >
              &times;
            </button>
          </div>
        </div>

        <!-- Modal Body Container -->
        <div id="zoosh-quotation-modal-content" style="flex: 1; overflow-y: auto; padding: 20px;">
          <!-- Content rendered dynamically -->
        </div>
      </div>
    `;

    this.renderContent();
  },

  renderContent() {
    const contentEl = document.getElementById('zoosh-quotation-modal-content');
    if (!contentEl) return;

    if (this.loading) {
      contentEl.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: var(--text-muted);">
          <div style="display: inline-block; width: 38px; height: 38px; border: 3px solid #e2e8f0; border-top-color: #10b981; border-radius: 50%; animation: zoosh-spin 0.8s linear infinite;"></div>
          <div style="margin-top: 14px; font-weight: 600; font-size: 14px; color: var(--text-main);">Fetching live quotations...</div>
          <div style="font-size: 12px; margin-top: 4px;">Connecting on-demand to Quotation Supabase backend</div>
        </div>
      `;
      return;
    }

    if (this.error) {
      contentEl.innerHTML = `
        <div style="padding: 30px 20px; text-align: center;">
          <div style="color: #ef4444; font-size: 32px; margin-bottom: 10px;">⚠️</div>
          <h3 style="margin: 0 0 8px 0; color: #991b1b; font-size: 15px;">Unable to Fetch Quotations</h3>
          <div style="color: var(--text-muted); font-size: 13px; max-width: 500px; margin: 0 auto 16px auto; line-height: 1.5;">
            ${this.error}
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.Zoosh.QuotationImportModal.fetchQuotations()">
            🔄 Try Again
          </button>
        </div>
      `;
      return;
    }

    if (this.step === 'LIST') {
      this.renderQuotationList(contentEl);
    } else {
      this.renderQuotationReview(contentEl);
    }
  },

  renderQuotationList(container) {
    const qList = this.getFilteredQuotations();

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Filter and Search Toolbar -->
        <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px; align-items: center; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid var(--border-light);">
          <div>
            <input 
              type="text" 
              class="form-input" 
              placeholder="Search Quotation # or Client name..." 
              value="${this.searchQuery}"
              oninput="window.Zoosh.QuotationImportModal.searchQuery = this.value; window.Zoosh.QuotationImportModal.renderContent();"
              style="margin: 0; font-size: 12.5px;"
            />
          </div>

          <div>
            <select 
              class="form-input" 
              onchange="window.Zoosh.QuotationImportModal.conversionFilter = this.value; window.Zoosh.QuotationImportModal.renderContent();"
              style="margin: 0; font-size: 12px;"
            >
              <option value="ALL" ${this.conversionFilter === 'ALL' ? 'selected' : ''}>Conversion: All</option>
              <option value="CONVERTED" ${this.conversionFilter === 'CONVERTED' ? 'selected' : ''}>✅ Converted (Eligible)</option>
              <option value="NOT_REVIEWED" ${this.conversionFilter === 'NOT_REVIEWED' ? 'selected' : ''}>⏳ Not Reviewed</option>
              <option value="NOT_CONVERTED" ${this.conversionFilter === 'NOT_CONVERTED' ? 'selected' : ''}>❌ Not Converted</option>
            </select>
          </div>

          <div>
            <select 
              class="form-input" 
              onchange="window.Zoosh.QuotationImportModal.importFilter = this.value; window.Zoosh.QuotationImportModal.renderContent();"
              style="margin: 0; font-size: 12px;"
            >
              <option value="ALL" ${this.importFilter === 'ALL' ? 'selected' : ''}>Import: All</option>
              <option value="NOT_IMPORTED" ${this.importFilter === 'NOT_IMPORTED' ? 'selected' : ''}>Not Imported</option>
              <option value="IMPORTED" ${this.importFilter === 'IMPORTED' ? 'selected' : ''}>Already Imported</option>
            </select>
          </div>

          <div>
            <select 
              class="form-input" 
              onchange="window.Zoosh.QuotationImportModal.sortOrder = this.value; window.Zoosh.QuotationImportModal.renderContent();"
              style="margin: 0; font-size: 12px;"
            >
              <option value="NEWEST" ${this.sortOrder === 'NEWEST' ? 'selected' : ''}>Newest First (Original)</option>
              <option value="OLDEST" ${this.sortOrder === 'OLDEST' ? 'selected' : ''}>Oldest First</option>
            </select>
          </div>
        </div>

        <!-- Conversion Policy Notice -->
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; font-size: 12px; color: #166534; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>ℹ️</span>
            <span><strong>Conversion Rule:</strong> Only quotations manually marked as <strong>Converted</strong> can be imported into production. Marking status here does not alter anything in the Quotation System.</span>
          </div>
          <span style="font-weight: 700; font-size: 11px; background: #dcfce7; padding: 2px 8px; border-radius: 4px;">Total Found: ${qList.length}</span>
        </div>

        <!-- Quotation List Cards -->
        ${qList.length === 0 ? `
          <div style="text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px;">
            No quotations found matching your current search or filter criteria.
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${qList.map(q => this.renderQuotationRow(q)).join('')}
          </div>
        `}
      </div>
    `;
  },

  renderQuotationRow(q) {
    const tracking = window.Zoosh.State.getQuotationTracking(q.id);
    const convStatus = tracking.conversionStatus || 'NOT_REVIEWED';
    const isImported = tracking.importStatus === 'IMPORTED' || tracking.linkedProjectIds.length > 0;

    let convBadge = '<span class="badge" style="background: #f1f5f9; color: #475569; font-size: 11px;">⏳ Not Reviewed</span>';
    if (convStatus === 'CONVERTED') {
      convBadge = '<span class="badge" style="background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700;">✅ Converted</span>';
    } else if (convStatus === 'NOT_CONVERTED') {
      convBadge = '<span class="badge" style="background: #fee2e2; color: #991b1b; font-size: 11px; font-weight: 700;">❌ Not Converted</span>';
    }

    let importBadge = '<span class="badge" style="background: #f8fafc; color: #64748b; font-size: 11px; border: 1px solid #e2e8f0;">Not Imported</span>';
    if (isImported) {
      importBadge = '<span class="badge" style="background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: 700; border: 1px solid #bae6fd;">Imported</span>';
    }

    const itemsCount = (q.items || []).length;
    const client = q.clientNormalized;
    const formattedTotal = '₹' + (q.totals.grandTotal || 0).toLocaleString('en-IN');

    return `
      <div style="
        border: 1px solid var(--border-light);
        border-radius: 8px;
        padding: 12px 16px;
        background: #ffffff;
        transition: all 0.2s ease;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      " onmouseover="this.style.borderColor='#10b981'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.04)';" onmouseout="this.style.borderColor='var(--border-light)'; this.style.boxShadow='none';">
        
        <!-- Left: QTN Details -->
        <div style="display: flex; align-items: flex-start; gap: 14px; flex: 2;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; text-align: center; min-width: 95px;">
            <div style="font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--text-main);">${q.no}</div>
            <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">${q.date || 'No Date'}</div>
          </div>

          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <strong style="font-size: 14px; color: var(--text-main);">${client.name}</strong>
              ${client.phone ? `<span style="font-size: 12px; color: var(--text-muted);">(${client.phone})</span>` : ''}
              ${client.location ? `<span style="font-size: 11px; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; color: #475569;">📍 ${client.location}</span>` : ''}
            </div>

            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 12px;">
              <span><strong>${itemsCount}</strong> product${itemsCount !== 1 ? 's' : ''}</span>
              <span>•</span>
              <span style="font-weight: 700; color: var(--text-main);">Total: ${formattedTotal}</span>
              ${q.totals.discountPercent > 0 ? `<span style="color: #059669; font-size: 11px;">(${q.totals.discountPercent}% disc)</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Middle: Status Badges & Quick Conversion Toggle -->
        <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1.2;">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${convBadge}
            ${importBadge}
          </div>

          <div style="display: flex; gap: 4px; margin-top: 2px;">
            <button 
              type="button" 
              class="btn btn-sm" 
              style="padding: 2px 7px; font-size: 10.5px; border-radius: 4px; background: ${convStatus === 'CONVERTED' ? '#dcfce7' : '#f8fafc'}; color: ${convStatus === 'CONVERTED' ? '#15803d' : '#64748b'}; border: 1px solid #cbd5e1;"
              onclick="window.Zoosh.QuotationImportModal.setConversionStatus('${q.id}', 'CONVERTED')"
              title="Mark as Converted"
            >
              Mark Converted
            </button>
            <button 
              type="button" 
              class="btn btn-sm" 
              style="padding: 2px 7px; font-size: 10.5px; border-radius: 4px; background: ${convStatus === 'NOT_CONVERTED' ? '#fee2e2' : '#f8fafc'}; color: ${convStatus === 'NOT_CONVERTED' ? '#991b1b' : '#64748b'}; border: 1px solid #cbd5e1;"
              onclick="window.Zoosh.QuotationImportModal.setConversionStatus('${q.id}', 'NOT_CONVERTED')"
              title="Mark as Not Converted"
            >
              Not Converted
            </button>
            <button 
              type="button" 
              class="btn btn-sm" 
              style="padding: 2px 5px; font-size: 10.5px; border-radius: 4px; background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0;"
              onclick="window.Zoosh.QuotationImportModal.setConversionStatus('${q.id}', 'NOT_REVIEWED')"
              title="Reset Status"
            >
              ↺
            </button>
          </div>
        </div>

        <!-- Right: Actions -->
        <div style="text-align: right; min-width: 170px;">
          ${convStatus === 'CONVERTED' ? `
            <button 
              type="button" 
              class="btn btn-primary btn-sm" 
              style="width: 100%; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; gap: 6px;"
              onclick="window.Zoosh.QuotationImportModal.selectQuotationForReview('${q.id}')"
            >
              ${isImported ? 'Re-Import / Add' : 'Review &amp; Import'} &rarr;
            </button>
          ` : `
            <button 
              type="button" 
              class="btn btn-secondary btn-sm" 
              style="width: 100%; font-size: 11.5px; opacity: 0.6; cursor: not-allowed;"
              title="Mark quotation as Converted above to enable import"
              disabled
            >
              Mark Converted First
            </button>
          `}
        </div>
      </div>
    `;
  },

  getFilteredQuotations() {
    let list = [...this.quotations];

    // Search filter
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter(item => {
        const noMatch = (item.no || '').toLowerCase().includes(q);
        const nameMatch = (item.clientNormalized.name || '').toLowerCase().includes(q);
        const locMatch = (item.clientNormalized.location || '').toLowerCase().includes(q);
        return noMatch || nameMatch || locMatch;
      });
    }

    // Conversion filter
    if (this.conversionFilter !== 'ALL') {
      list = list.filter(item => {
        const tracking = window.Zoosh.State.getQuotationTracking(item.id);
        const st = tracking.conversionStatus || 'NOT_REVIEWED';
        return st === this.conversionFilter;
      });
    }

    // Import filter
    if (this.importFilter !== 'ALL') {
      list = list.filter(item => {
        const tracking = window.Zoosh.State.getQuotationTracking(item.id);
        const isImp = tracking.importStatus === 'IMPORTED' || tracking.linkedProjectIds.length > 0;
        return this.importFilter === 'IMPORTED' ? isImp : !isImp;
      });
    }

    // Sort order
    list.sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || b.date || 0).getTime();
      return this.sortOrder === 'NEWEST' ? timeB - timeA : timeA - timeB;
    });

    return list;
  },

  renderQuotationReview(container) {
    const q = this.selectedQuotation;
    if (!q) return;

    const client = q.clientNormalized;
    const existingClient = this.findMatchingClient(client.name, client.phone);
    const items = q.items || [];
    const itemData = q.itemData || {};

    const presetOptions = (window.Zoosh.ProcessFlow && window.Zoosh.ProcessFlow.PRESETS) || [
      { id: 'preset_1', name: 'Quick Flow: Carpentry → Polish → Upholstery' },
      { id: 'preset_2', name: 'Direct Soft-Furnishing' },
      { id: 'preset_3', name: 'Carpentry & Polish' },
      { id: 'preset_5', name: 'Metal & Polish' }
    ];

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Top Reference Bar -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; border: 1px solid var(--border-light); border-radius: 8px; padding: 14px 16px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">Quotation Source Details</div>
            <div style="font-size: 16px; font-weight: 700; color: var(--text-main); margin-top: 4px;">${q.no}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Date: <strong>${q.date}</strong> • Total: <strong style="color: #059669;">₹${(q.totals.grandTotal || 0).toLocaleString('en-IN')}</strong> (${items.length} items)
            </div>
          </div>

          <div>
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">Client Matching Status</div>
            <div style="font-size: 13.5px; font-weight: 600; color: var(--text-main); margin-top: 4px; display: flex; align-items: center; gap: 6px;">
              ${existingClient ? `
                <span class="badge badge-success" style="font-size: 11px;">Matched Existing Client</span>
                <span>${existingClient.name} (${existingClient.code || existingClient.clientCode})</span>
              ` : `
                <span class="badge badge-primary" style="font-size: 11px;">New Client Will Be Created</span>
                <span>${client.name}</span>
              `}
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Phone: ${client.phone || 'N/A'} • Location: ${client.location || 'N/A'}
            </div>
          </div>
        </div>

        <!-- Target Project Details Form -->
        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: 8px; padding: 16px;">
          <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">
            Target Production Project Settings
          </h3>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 11.5px;">Project Name *</label>
              <input 
                type="text" 
                class="form-input" 
                value="${this.projectForm.name}" 
                oninput="window.Zoosh.QuotationImportModal.handleProjectFormFieldChange('name', this.value)"
              />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 11.5px;">Site / Delivery Location</label>
              <input 
                type="text" 
                class="form-input" 
                value="${this.projectForm.location}" 
                oninput="window.Zoosh.QuotationImportModal.handleProjectFormFieldChange('location', this.value)"
              />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 11.5px;">Confirmed Start Date</label>
              <input 
                type="date" 
                class="form-input" 
                value="${this.projectForm.confirmedDate}" 
                onchange="window.Zoosh.QuotationImportModal.handleProjectFormFieldChange('confirmedDate', this.value)"
              />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 11.5px;">Fixed Delivery Deadline *</label>
              <input 
                type="date" 
                class="form-input" 
                value="${this.projectForm.deliveryDeadline}" 
                onchange="window.Zoosh.QuotationImportModal.handleProjectFormFieldChange('deliveryDeadline', this.value)"
                required
              />
            </div>
          </div>
        </div>

        <!-- Product Selection & Separate Production Mapping -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: var(--text-main);">
                Product Mapping: Quotation Specs vs. Manufacturing Specs
              </h3>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                Original quotation specifications remain frozen as immutable references. Enter actual factory manufacturing details below.
              </div>
            </div>
            <button 
              type="button" 
              class="btn btn-secondary btn-sm" 
              onclick="window.Zoosh.QuotationImportModal.toggleSelectAllProducts()"
              style="font-size: 12px;"
            >
              ${this.selectedProductIds.size === items.length ? 'Deselect All' : 'Select All (' + items.length + ')'}
            </button>
          </div>

          <!-- Products List -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            ${items.map(itemId => {
              const orig = itemData[itemId] || {};
              const prod = this.productionSpecs[itemId] || {};
              const isSelected = this.selectedProductIds.has(String(itemId));
              const itemPhoto = (q.itemPhotos && q.itemPhotos[itemId]) || null;

              return `
                <div style="
                  border: 2px solid ${isSelected ? '#10b981' : '#e2e8f0'};
                  border-radius: 8px;
                  background: #ffffff;
                  overflow: hidden;
                  box-shadow: ${isSelected ? '0 2px 6px rgba(16, 185, 129, 0.08)' : 'none'};
                ">
                  <!-- Product Item Header -->
                  <div style="
                    background: ${isSelected ? '#f0fdf4' : '#f8fafc'};
                    padding: 8px 14px;
                    border-bottom: 1px solid ${isSelected ? '#bbf7d0' : '#e2e8f0'};
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  ">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin: 0; user-select: none;">
                      <input 
                        type="checkbox" 
                        ${isSelected ? 'checked' : ''} 
                        onchange="window.Zoosh.QuotationImportModal.toggleProductSelection('${itemId}')"
                        style="width: 17px; height: 17px; accent-color: #10b981; cursor: pointer;"
                      />
                      <strong style="font-size: 13.5px; color: var(--text-main);">
                        Item #${itemId}: ${orig.name || 'Unnamed Item'}
                      </strong>
                    </label>

                    <div style="font-size: 12px; color: var(--text-muted);">
                      Quoted Qty: <strong>${orig.qty} ${orig.utype || 'nos'}</strong> @ ₹${(parseFloat(orig.unit) || 0).toLocaleString('en-IN')}
                    </div>
                  </div>

                  <!-- Side-by-Side: Original (Frozen) vs Production (Editable) -->
                  <div style="
                    display: grid;
                    grid-template-columns: 1fr 1.3fr;
                    gap: 16px;
                    padding: 14px;
                    opacity: ${isSelected ? '1' : '0.45'};
                    pointer-events: ${isSelected ? 'auto' : 'none'};
                  ">
                    <!-- Left Column: Immutable Original Quotation Details -->
                    <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 12px;">
                      <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="display: flex; align-items: center; gap: 4px;"><span>🔒</span> Original Quotation Specs</span>
                        <span class="badge" style="font-size: 10px; background: #e2e8f0; color: #475569;">Reference</span>
                      </div>

                      <div style="display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start;">
                        ${itemPhoto ? `
                          <img src="${itemPhoto}" alt="${orig.name || 'Product'}" style="width: 58px; height: 58px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; flex-shrink: 0;" />
                        ` : `
                          <div style="width: 58px; height: 58px; border-radius: 6px; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #94a3b8; flex-shrink: 0;" title="No quotation photo">
                            🪑
                          </div>
                        `}
                        <div style="flex: 1; min-width: 0;">
                          <div style="font-size: 11px; color: var(--text-muted);">Quoted Product Name:</div>
                          <div style="font-weight: 700; color: var(--text-main); font-size: 13.5px; margin-top: 1px;">${orig.name || '—'}</div>
                        </div>
                      </div>

                      <div style="font-size: 12px; margin-bottom: 6px;">
                        <span style="color: var(--text-muted);">Description / Specs:</span>
                        <div style="color: #334155; margin-top: 2px; white-space: pre-wrap; font-size: 11.5px; line-height: 1.4; background: #ffffff; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">${orig.spec || 'No description provided.'}</div>
                      </div>

                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11.5px; margin-top: 8px;">
                        <div>
                          <span style="color: var(--text-muted);">Quoted Rate:</span>
                          <div style="font-weight: 600;">₹${(parseFloat(orig.unit) || 0).toLocaleString('en-IN')}</div>
                        </div>
                        <div>
                          <span style="color: var(--text-muted);">Item Total:</span>
                          <div style="font-weight: 600; color: #059669;">₹${((parseFloat(orig.unit) || 0) * (parseInt(orig.qty, 10) || 1)).toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    </div>

                    <!-- Right Column: Editable Manufacturing Details -->
                    <div style="background: #ffffff; border: 1px solid #10b981; border-radius: 6px; padding: 12px;">
                      <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #065f46; letter-spacing: 0.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                        <span>✏️</span> Factory Manufacturing Specs (Editable)
                      </div>

                      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div class="form-group" style="margin-bottom: 0;">
                          <label class="form-label" style="font-size: 11px;">Production Product Name</label>
                          <input 
                            type="text" 
                            class="form-input" 
                            value="${prod.name || orig.name || ''}" 
                            oninput="window.Zoosh.QuotationImportModal.handleProductionFieldChange('${itemId}', 'name', this.value)"
                            style="padding: 4px 8px; font-size: 12px;"
                          />
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                          <label class="form-label" style="font-size: 11px;">Production Qty</label>
                          <input 
                            type="number" 
                            min="1" 
                            class="form-input" 
                            value="${prod.qty || orig.qty || 1}" 
                            oninput="window.Zoosh.QuotationImportModal.handleProductionFieldChange('${itemId}', 'qty', this.value)"
                            style="padding: 4px 8px; font-size: 12px;"
                          />
                        </div>
                      </div>

                      <div style="margin-bottom: 8px;">
                        <label class="form-label" style="font-size: 11px;">Actual Manufacturing Measurements (e.g. 250 × 90 × 85 cm) *</label>
                        <input 
                          type="text" 
                          class="form-input" 
                          placeholder="e.g. 2400 x 950 x 850 mm / 8ft x 3ft" 
                          value="${prod.measurements || ''}" 
                          oninput="window.Zoosh.QuotationImportModal.handleProductionFieldChange('${itemId}', 'measurements', this.value)"
                          style="padding: 4px 8px; font-size: 12px;"
                        />
                      </div>

                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                        <div>
                          <label class="form-label" style="font-size: 11px;">Wood / Metal Structure</label>
                          <input 
                            type="text" 
                            class="form-input" 
                            placeholder="e.g. Teak Wood, MS Frame" 
                            value="${prod.woodType || ''}" 
                            oninput="window.Zoosh.QuotationImportModal.handleProductionFieldChange('${itemId}', 'woodType', this.value)"
                            style="padding: 4px 8px; font-size: 12px;"
                          />
                        </div>
                        <div>
                          <label class="form-label" style="font-size: 11px;">Foam &amp; Upholstery</label>
                          <input 
                            type="text" 
                            class="form-input" 
                            placeholder="e.g. 40D HR Foam, Velvet" 
                            value="${prod.foam || ''}" 
                            oninput="window.Zoosh.QuotationImportModal.handleProductionFieldChange('${itemId}', 'foam', this.value)"
                            style="padding: 4px 8px; font-size: 12px;"
                          />
                        </div>
                      </div>

                      <div style="margin-bottom: 0;">
                        <label class="form-label" style="font-size: 11px;">Department Flow Preset</label>
                        <select 
                          class="form-input" 
                          onchange="window.Zoosh.QuotationImportModal.handleProductionFieldChange('${itemId}', 'flowTypeId', this.value)"
                          style="padding: 4px 8px; font-size: 11.5px; margin-bottom: 0;"
                        >
                          ${presetOptions.map(p => `
                            <option value="${p.id}" ${prod.flowTypeId === p.id ? 'selected' : ''}>
                              ${p.name || p.id}
                            </option>
                          `).join('')}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Review Footer -->
        <div style="
          border-top: 1px solid var(--border-light);
          padding-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <button 
            type="button" 
            class="btn btn-secondary" 
            onclick="window.Zoosh.QuotationImportModal.step = 'LIST'; window.Zoosh.QuotationImportModal.renderContent();"
          >
            ← Back to Quotation List
          </button>

          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 12.5px; color: var(--text-muted);">
              Selected: <strong>${this.selectedProductIds.size}</strong> of ${items.length} items
            </span>
            <button 
              type="button" 
              class="btn btn-primary" 
              onclick="window.Zoosh.QuotationImportModal.confirmAndCreateProject()"
              style="padding: 10px 20px; font-weight: 700; font-size: 13px; display: inline-flex; align-items: center; gap: 8px;"
            >
              Confirm &amp; Create Production Project &rarr;
            </button>
          </div>
        </div>
      </div>
    `;
  }
};
