/**
 * ZOOSH Production Schedule — Excel-Style Estimate Module
 * Recreates the Excel estimation model and calculation experience from 'samle estimate.xlsx'.
 * 
 * Connected directly to Clients & Projects:
 * - View 1: Projects Overview Dashboard (projects, product counts, completed estimate counts, total mfg costs, total selling values).
 * - View 2: Project Estimate Workspace (combined project summary, product tabs with photos, active Excel estimation sheet).
 * - Row 1 Grand Totals Highlight Bar (Wood CFT, C. Lab, P. Mat., P. Lab., Packing, F. Expense, Fabric, U. Lab., Foam, 25% Profit, 30% Profit, T. Qtn Amt.).
 * - 16 Manufacturing Cost Categories table (Mahogany, Wood Ash, Carpenter, Polish Material, Polish Labour, Foam, Fabric, Upholstery Labour, Packing, Factory Expense, Metal Work, Rattan, Rope, Consumables, Ar. Marble, Plywood).
 * - Wood Estimation Cut List with mixed units (L in ft, W in in, H in in, Qty, CFT = (L*W*H*Qty)/144).
 * - Profit margins (25%, 30%, custom editable %), cost per unit vs total for quantity, selling price per unit vs total quotation amount.
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Estimate = {
  activeProjectId: null,
  activeFurnitureId: null,
  searchQuery: '',
  activeTab: 'sheet', // 'sheet' | 'summary' | 'print'
  tempEstimate: null,

  openProject(projectId) {
    this.activeProjectId = projectId;
    const project = (window.Zoosh.State.getState().projects || []).find(p => p.id === projectId);
    const furnitureList = (window.Zoosh.State.getState().furniture || []).filter(f => f.projectId === projectId);
    
    if (furnitureList.length > 0) {
      // Default to the first furniture item, specifically Sitout Chair if present
      const preferred = furnitureList.find(f => (f.name || '').toLowerCase().includes('sitout')) || 
                        furnitureList.find(f => (f.name || '').toLowerCase().includes('chair')) || 
                        furnitureList[0];
      this.activeFurnitureId = preferred.id;
    } else {
      this.activeFurnitureId = null;
    }

    this.tempEstimate = null;
    if (window.Zoosh.App) {
      window.Zoosh.App.navigateTo('estimate');
    } else {
      this.render(document.getElementById('view-container'));
    }
  },

  openProduct(projectId, furnitureId) {
    this.activeProjectId = projectId;
    this.activeFurnitureId = furnitureId;
    this.tempEstimate = null;
    if (window.Zoosh.App) {
      window.Zoosh.App.navigateTo('estimate');
    } else {
      this.render(document.getElementById('view-container'));
    }
  },

  closeProject() {
    this.activeProjectId = null;
    this.activeFurnitureId = null;
    this.tempEstimate = null;
    this.render(document.getElementById('view-container'));
  },

  render(container) {
    if (!container) return;

    if (this.activeProjectId) {
      this.renderProjectWorkspace(container, this.activeProjectId);
    } else {
      this.renderProjectsDashboard(container);
    }
  },

  // =========================================================================
  // VIEW 1: PROJECTS ESTIMATE DASHBOARD
  // =========================================================================

  renderProjectsDashboard(container) {
    const state = window.Zoosh.State.getState();
    const projects = state.projects || [];
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));

    // Calculate factory-wide estimate KPIs
    let factoryTotalMfgCost = 0;
    let factoryTotalSelling = 0;
    let factoryTotalProducts = 0;
    let factoryEstimatedProducts = 0;

    const projectSummaries = projects.map(p => {
      const summary = window.Zoosh.State.getProjectEstimatesSummary(p.id);
      factoryTotalMfgCost += summary.totalMfgCost;
      factoryTotalSelling += summary.totalSellingValue;
      factoryTotalProducts += summary.totalProducts;
      factoryEstimatedProducts += summary.estimatedCount;
      const client = clientsMap.get(p.clientId) || {};
      return { project: p, client, summary };
    });

    // Filter by search query
    let filtered = projectSummaries;
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = projectSummaries.filter(item => {
        const pName = (item.project.name || '').toLowerCase();
        const cName = (item.client.name || item.project.clientName || '').toLowerCase();
        const loc = (item.project.location || '').toLowerCase();
        return pName.includes(q) || cName.includes(q) || loc.includes(q);
      });
    }

    const factoryProfit = factoryTotalSelling - factoryTotalMfgCost;
    const factoryMargin = factoryTotalMfgCost > 0 ? (Math.round((factoryProfit / factoryTotalMfgCost) * 1000) / 10) : 0;

    if (window.Zoosh.App) {
      window.Zoosh.App.updateMobileHeader('Estimates Dashboard', false);
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Top Title & Search Banner -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 22px;">📊</span>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: var(--text-main); letter-spacing: -0.5px;">
                Excel-Style Costing &amp; Estimates
              </h1>
              <span class="badge badge-primary" style="font-size: 11px; padding: 2px 7px;">Excel Architecture</span>
            </div>
            <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 3px;">
              Project-based furniture estimation sheets recreating the 16 manufacturing categories, wood CFT cut list, and profit tier calculations.
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="position: relative; width: 260px;">
              <input 
                type="text" 
                class="form-input" 
                placeholder="Search projects or clients..." 
                value="${this.searchQuery}" 
                oninput="window.Zoosh.Views.Estimate.handleSearch(this.value)"
                style="padding-left: 32px; font-size: 12.5px;"
              />
              <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;">🔍</span>
            </div>
          </div>
        </div>

        <!-- Factory Estimate Summary KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px;">
          <div class="card-panel" style="padding: 16px 18px; border-left: 4px solid #10b981;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
              Total Estimated Mfg Cost
            </div>
            <div style="font-size: 22px; font-weight: 800; color: var(--text-main); font-family: var(--font-mono); margin-top: 4px;">
              ₹${factoryTotalMfgCost.toLocaleString('en-IN')}
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
              Materials + Labour + Factory Overheads
            </div>
          </div>

          <div class="card-panel" style="padding: 16px 18px; border-left: 4px solid #3b82f6;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
              Total Estimated Selling Value
            </div>
            <div style="font-size: 22px; font-weight: 800; color: #2563eb; font-family: var(--font-mono); margin-top: 4px;">
              ₹${factoryTotalSelling.toLocaleString('en-IN')}
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
              Expected Quotation Realization
            </div>
          </div>

          <div class="card-panel" style="padding: 16px 18px; border-left: 4px solid #059669;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
              Expected Factory Profit
            </div>
            <div style="font-size: 22px; font-weight: 800; color: #059669; font-family: var(--font-mono); margin-top: 4px;">
              ₹${factoryProfit.toLocaleString('en-IN')}
            </div>
            <div style="font-size: 11.5px; color: #059669; font-weight: 600; margin-top: 4px;">
              ${factoryMargin}% Average Margin
            </div>
          </div>

          <div class="card-panel" style="padding: 16px 18px; border-left: 4px solid #8b5cf6;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">
              Products Costed
            </div>
            <div style="font-size: 22px; font-weight: 800; color: var(--text-main); font-family: var(--font-mono); margin-top: 4px;">
              ${factoryEstimatedProducts} / ${factoryTotalProducts}
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">
              ${projects.length} Total Projects in Production
            </div>
          </div>
        </div>

        <!-- Projects Table -->
        <div class="card-panel">
          <div class="card-panel-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div class="card-panel-title">Production Projects (${filtered.length})</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                Select any project to open all its furniture products and individual Excel estimation sheets.
              </div>
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">
              Featured: <strong>Ansar Changaramkulam</strong> (Excel Sample)
            </span>
          </div>

          <div class="card-panel-body" style="padding: 0; overflow-x: auto;">
            ${filtered.length === 0 ? `
              <div style="padding: 40px; text-align: center; color: var(--text-muted);">
                No projects matched your search "${this.searchQuery}".
              </div>
            ` : `
              <table class="table" style="margin: 0; width: 100%;">
                <thead>
                  <tr>
                    <th style="width: 240px;">Client &amp; Project</th>
                    <th style="width: 140px;">Products</th>
                    <th style="width: 160px;">Estimate Status</th>
                    <th style="width: 140px; text-align: right;">Total Mfg Cost</th>
                    <th style="width: 140px; text-align: right;">Total Selling</th>
                    <th style="width: 120px; text-align: right;">Profit Margin</th>
                    <th style="width: 130px; text-align: center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map(item => {
                    const p = item.project;
                    const c = item.client;
                    const s = item.summary;
                    const isAllEstimated = s.totalProducts > 0 && s.estimatedCount >= s.totalProducts;
                    const isAnsar = (p.name || '').includes('Ansar');

                    return `
                      <tr style="cursor: pointer; background: ${isAnsar ? '#f0fdf4' : 'transparent'};" onclick="window.Zoosh.Views.Estimate.openProject('${p.id}')">
                        <td>
                          <div style="font-weight: 700; color: var(--text-main); font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
                            ${p.name}
                            ${isAnsar ? `<span class="badge badge-success" style="font-size: 10px; padding: 1px 5px;">Excel Model</span>` : ''}
                          </div>
                          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                            Client: <strong>${c.name || p.clientName}</strong> &bull; ${p.location}
                          </div>
                          ${p.quotationRef ? `
                            <div style="font-size: 10.5px; color: #047857; margin-top: 2px;">
                              Quotation: ${p.quotationRef.quotationNo}
                            </div>
                          ` : ''}
                        </td>
                        <td>
                          <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">
                            ${s.totalProducts} Furniture Items
                          </div>
                          <div style="display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap;">
                            ${(s.items || []).slice(0, 4).map(it => `
                              <span style="display: inline-block; width: 18px; height: 18px; border-radius: 4px; background: #e2e8f0; font-size: 10px; text-align: center; line-height: 18px; overflow: hidden;" title="${it.furniture.name}">
                                ${it.furniture.photo ? `<img src="${it.furniture.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : '🪑'}
                              </span>
                            `).join('')}
                            ${s.totalProducts > 4 ? `<span style="font-size: 10px; color: var(--text-muted); line-height: 18px;">+${s.totalProducts - 4}</span>` : ''}
                          </div>
                        </td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                              <div style="width: ${s.totalProducts > 0 ? (s.estimatedCount / s.totalProducts) * 100 : 0}%; height: 100%; background: ${isAllEstimated ? '#10b981' : '#3b82f6'};"></div>
                            </div>
                            <span style="font-size: 11.5px; font-weight: 700; font-family: var(--font-mono); color: var(--text-main);">
                              ${s.estimatedCount}/${s.totalProducts}
                            </span>
                          </div>
                          <div style="font-size: 10.5px; color: ${isAllEstimated ? '#059669' : 'var(--text-muted)'}; margin-top: 3px; font-weight: 600;">
                            ${isAllEstimated ? '✓ All Estimated' : (s.estimatedCount > 0 ? 'In Progress' : 'Pending Estimates')}
                          </div>
                        </td>
                        <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: var(--text-main);">
                          ₹${s.totalMfgCost.toLocaleString('en-IN')}
                        </td>
                        <td style="text-align: right; font-family: var(--font-mono); font-weight: 700; font-size: 13px; color: #2563eb;">
                          ₹${s.totalSellingValue.toLocaleString('en-IN')}
                        </td>
                        <td style="text-align: right;">
                          <div style="font-family: var(--font-mono); font-weight: 700; font-size: 12.5px; color: #059669;">
                            +₹${s.totalProfit.toLocaleString('en-IN')}
                          </div>
                          <div style="font-size: 10.5px; color: var(--text-muted);">
                            ${s.overallProfitMargin}% margin
                          </div>
                        </td>
                        <td style="text-align: center;">
                          <button 
                            class="btn btn-primary btn-sm" 
                            style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"
                            onclick="event.stopPropagation(); window.Zoosh.Views.Estimate.openProject('${p.id}')"
                          >
                            Open Estimates &rarr;
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `;
  },

  handleSearch(val) {
    this.searchQuery = val;
    this.render(document.getElementById('view-container'));
  },

  // =========================================================================
  // VIEW 2: PROJECT ESTIMATE WORKSPACE (COMBINED SUMMARY + EXCEL SHEET)
  // =========================================================================

  renderProjectWorkspace(container, projectId) {
    const state = window.Zoosh.State.getState();
    const project = (state.projects || []).find(p => p.id === projectId);
    if (!project) {
      this.closeProject();
      return;
    }

    const client = (state.clients || []).find(c => c.id === project.clientId) || {};
    const furnitureList = (state.furniture || []).filter(f => f.projectId === projectId);
    const summary = window.Zoosh.State.getProjectEstimatesSummary(projectId);

    // Ensure activeFurnitureId is valid
    if (!this.activeFurnitureId && furnitureList.length > 0) {
      this.activeFurnitureId = furnitureList[0].id;
    }

    const activeFurniture = furnitureList.find(f => f.id === this.activeFurnitureId) || furnitureList[0] || null;

    // Load or initialize active estimate into tempEstimate
    if (!this.tempEstimate || this.tempEstimate.furnitureId !== (activeFurniture ? activeFurniture.id : null)) {
      if (activeFurniture) {
        this.tempEstimate = window.Zoosh.State.getEstimate(activeFurniture.id);
        // Ensure synchronized client & project names
        this.tempEstimate.clientName = client.name || project.clientName || 'Client';
        this.tempEstimate.projectName = project.name || 'Project';
        this.tempEstimate.productName = activeFurniture.name || activeFurniture.furnitureName || 'Product';
        this.tempEstimate.productQty = parseInt(activeFurniture.qty, 10) || parseInt(this.tempEstimate.productQty, 10) || 1;
        if (!this.tempEstimate.photo && (activeFurniture.photo || activeFurniture.image)) {
          this.tempEstimate.photo = activeFurniture.photo || activeFurniture.image;
        }
        this.recalculateTempEstimateTotals();
      } else {
        this.tempEstimate = null;
      }
    }

    if (window.Zoosh.App) {
      window.Zoosh.App.updateMobileHeader(`Estimate: ${project.name}`, true, () => window.Zoosh.Views.Estimate.closeProject());
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <!-- Workspace Navigation Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Estimate.closeProject()" style="padding: 5px 12px; font-weight: 600;">
              &larr; Back to All Projects
            </button>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-primary" style="font-family: var(--font-mono); font-weight: 700;">
                ${client.code || client.clientCode || 'PROJ'}
              </span>
              <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: var(--text-main);">
                ${project.name}
              </h2>
              <span style="font-size: 13px; color: var(--text-muted);">&bull; ${project.location}</span>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <button 
              class="btn btn-secondary btn-sm" 
              onclick="window.Zoosh.Views.Estimate.exportCurrentEstimateCsv()" 
              style="display: flex; align-items: center; gap: 6px; font-size: 12px;"
              title="Export Current Estimate Sheet to CSV"
            >
              📥 Export CSV
            </button>
            <button 
              class="btn btn-secondary btn-sm" 
              onclick="window.Zoosh.Views.Estimate.printSheet()" 
              style="display: flex; align-items: center; gap: 6px; font-size: 12px;"
              title="Printable Specification View"
            >
              🖨️ Print Sheet
            </button>
            <button 
              class="btn btn-primary btn-sm" 
              onclick="window.Zoosh.Views.Estimate.saveCurrentEstimate()" 
              style="display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700; padding: 6px 14px; background: #059669; border-color: #059669;"
            >
              💾 Save Estimate
            </button>
          </div>
        </div>

        <!-- Combined Project Estimate Summary Header Card -->
        <div class="card-panel" style="background: linear-gradient(to right, #ffffff, #f0fdf4); border: 1.5px solid #a7f3d0;">
          <div class="card-panel-body" style="padding: 16px 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 12px;">
              <div>
                <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #065f46; letter-spacing: 0.6px; display: flex; align-items: center; gap: 5px;">
                  <span>📈</span> COMBINED PROJECT ESTIMATE SUMMARY
                </div>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">
                  Aggregate totals of all <strong>${summary.totalProducts} furniture products</strong> under project "${project.name}".
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge ${summary.estimatedCount >= summary.totalProducts ? 'badge-on-schedule' : 'badge-upholstery'}" style="font-size: 11.5px; font-weight: 700; padding: 3px 8px;">
                  ${summary.estimatedCount} of ${summary.totalProducts} Estimated
                </span>
              </div>
            </div>

            <!-- Summary Financial Metrics Ribbon -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; padding-top: 10px; border-top: 1px solid #d1fae5;">
              <div>
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #047857;">Total Mfg Cost</div>
                <div style="font-size: 20px; font-weight: 800; color: var(--text-main); font-family: var(--font-mono); margin-top: 2px;">
                  ₹${summary.totalMfgCost.toLocaleString('en-IN')}
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">Combined item costs</div>
              </div>

              <div>
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e40af;">Total Selling Value</div>
                <div style="font-size: 20px; font-weight: 800; color: #1e40af; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${summary.totalSellingValue.toLocaleString('en-IN')}
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">Total Quotation Price</div>
              </div>

              <div>
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #065f46;">Combined Profit</div>
                <div style="font-size: 20px; font-weight: 800; color: #059669; font-family: var(--font-mono); margin-top: 2px;">
                  +₹${summary.totalProfit.toLocaleString('en-IN')}
                </div>
                <div style="font-size: 10.5px; color: #059669; font-weight: 700; margin-top: 1px;">
                  ${summary.overallProfitMargin}% Overall Margin
                </div>
              </div>

              <div>
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #b45309;">Total Wood CFT</div>
                <div style="font-size: 20px; font-weight: 800; color: #b45309; font-family: var(--font-mono); margin-top: 2px;">
                  ${summary.totalWoodCft} CFT
                </div>
                <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">Timber requirement</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Product Selector Ribbon / Tabs -->
        <div class="card-panel" style="padding: 12px 16px;">
          <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>Project Products (${furnitureList.length} Items) &mdash; Select Product Sheet:</span>
            <span style="font-size: 11px; color: #059669; font-weight: 600;">Each product maintains its own independent calculation sheet</span>
          </div>

          <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;">
            ${furnitureList.map((furn, idx) => {
              const isSelected = activeFurniture && activeFurniture.id === furn.id;
              const isSaved = Boolean(state.estimates && state.estimates[furn.id] && state.estimates[furn.id].isSaved !== false);
              const est = state.estimates && state.estimates[furn.id];
              const sellingVal = est && est.totals ? est.totals.totalSellingPrice : 0;
              const photoUrl = furn.photo || furn.image || (furn.originalQuotationData && furn.originalQuotationData.photoUrl) || (est && est.photo) || null;

              return `
                <div 
                  onclick="window.Zoosh.Views.Estimate.selectProductTab('${furn.id}')"
                  style="
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 14px;
                    border-radius: 8px;
                    cursor: pointer;
                    user-select: none;
                    white-space: nowrap;
                    transition: all 0.15s ease;
                    border: 2px solid ${isSelected ? '#10b981' : '#e2e8f0'};
                    background: ${isSelected ? '#ecfdf5' : '#ffffff'};
                    box-shadow: ${isSelected ? '0 2px 6px rgba(16, 185, 129, 0.15)' : 'none'};
                  "
                >
                  ${photoUrl ? `
                    <img src="${photoUrl}" alt="${furn.name}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; flex-shrink: 0;" />
                  ` : `
                    <div style="width: 36px; height: 36px; border-radius: 6px; background: #f1f5f9; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #94a3b8; flex-shrink: 0;">
                      🪑
                    </div>
                  `}
                  <div>
                    <div style="font-size: 13px; font-weight: 700; color: ${isSelected ? '#065f46' : 'var(--text-main)'};">
                      ${furn.name || furn.furnitureName}
                    </div>
                    <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; margin-top: 1px;">
                      <span>Qty: <strong>${furn.qty || 1}</strong></span>
                      <span>&bull;</span>
                      ${isSaved ? `
                        <span style="color: #059669; font-weight: 700;">✓ ₹${sellingVal.toLocaleString('en-IN')}</span>
                      ` : `
                        <span style="color: #f59e0b; font-weight: 600;">Draft</span>
                      `}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Active Product Excel-Style Estimation Sheet -->
        ${activeFurniture ? this.renderExcelSpreadsheet(activeFurniture, project, client) : `
          <div class="card-panel" style="padding: 40px; text-align: center; color: var(--text-muted);">
            No furniture products found under this project.
          </div>
        `}
      </div>
    `;
  },

  selectProductTab(furnitureId) {
    if (this.activeFurnitureId === furnitureId) return;
    // Auto-save previous sheet if modified
    if (this.tempEstimate && this.activeFurnitureId) {
      window.Zoosh.State.saveEstimate(this.activeFurnitureId, this.tempEstimate);
    }
    this.activeFurnitureId = furnitureId;
    this.tempEstimate = null;
    this.render(document.getElementById('view-container'));
  },

  // =========================================================================
  // VIEW 3: THE EXCEL SPREADSHEET RECREATION
  // =========================================================================

  renderExcelSpreadsheet(furniture, project, client) {
    const est = this.tempEstimate;
    if (!est) return '';

    const totals = est.totals || {};
    const costRows = est.costRows || [];
    const woodRows = est.woodRows || [];

    // Extract highlight bar values (Row 1 from Excel sample)
    const highlightMetrics = this.getHighlightBarMetrics(est);

    return `
      <div id="excel-estimate-sheet-container" style="display: flex; flex-direction: column; gap: 16px;">
        
        <!-- Product Information Header Card (Excel Header A2:G3) -->
        <div class="card-panel" style="border-top: 4px solid #10b981;">
          <div class="card-panel-body" style="padding: 16px 20px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
              
              <!-- Left: Image & Product Identifiers -->
              <div style="display: flex; gap: 16px; align-items: flex-start;">
                <!-- Product Image with quick change / preview -->
                <div style="position: relative; flex-shrink: 0;">
                  ${est.photo ? `
                    <img id="est-product-img" src="${est.photo}" alt="${est.productName}" style="width: 88px; height: 88px; object-fit: cover; border-radius: 8px; border: 2px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.06);" />
                  ` : `
                    <div id="est-product-img-placeholder" style="width: 88px; height: 88px; border-radius: 8px; background: #f8fafc; border: 2px dashed #cbd5e1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; font-size: 28px;">
                      🪑
                      <span style="font-size: 9.5px; font-weight: 600; margin-top: 4px; color: #64748b;">No Image</span>
                    </div>
                  `}
                  <label 
                    class="btn btn-secondary btn-sm" 
                    style="position: absolute; bottom: -8px; right: -8px; padding: 2px 6px; font-size: 10px; border-radius: 12px; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.15);"
                    title="Upload or change product photo"
                  >
                    📷 Change
                    <input type="file" accept="image/*" style="display: none;" onchange="window.Zoosh.Views.Estimate.handlePhotoUpload(this)" />
                  </label>
                </div>

                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge badge-primary" style="font-family: var(--font-mono); font-size: 11px; font-weight: 700;">
                      Product #${est.productNo || '1'}
                    </span>
                    <span style="font-size: 12px; color: var(--text-muted);">
                      Client: <strong>${est.clientName}</strong> &bull; Project: <strong>${est.projectName}</strong>
                    </span>
                  </div>

                  <div style="margin-top: 6px;">
                    <input 
                      type="text" 
                      class="form-input" 
                      value="${est.productName}" 
                      oninput="window.Zoosh.Views.Estimate.updateProductField('productName', this.value)"
                      style="font-size: 18px; font-weight: 800; color: var(--text-main); padding: 4px 8px; border: 1px solid transparent; background: transparent; width: 100%; max-width: 380px; letter-spacing: -0.3px;"
                      title="Click to edit product name"
                    />
                  </div>

                  <div style="font-size: 12px; color: var(--text-muted); display: flex; align-items: center; gap: 14px; margin-top: 4px;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span>Estimate Date:</span>
                      <input 
                        type="date" 
                        class="form-input" 
                        value="${est.estimateDate || window.Zoosh.Config.CURRENT_DATE}" 
                        onchange="window.Zoosh.Views.Estimate.updateProductField('estimateDate', this.value)"
                        style="padding: 2px 6px; font-size: 11.5px; width: 130px;"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right: Quantity & Unit Cost Summary (Excel J3:K3) -->
              <div style="display: flex; gap: 16px; align-items: center; background: #f8fafc; padding: 12px 18px; border-radius: 8px; border: 1px solid var(--border-light);">
                <div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">Product Quantity</div>
                  <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
                    <input 
                      type="number" 
                      min="1" 
                      class="form-input" 
                      value="${est.productQty || 1}" 
                      oninput="window.Zoosh.Views.Estimate.updateProductQuantity(this.value)"
                      style="width: 75px; font-size: 16px; font-weight: 800; font-family: var(--font-mono); text-align: center; padding: 4px;"
                    />
                    <span style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Units</span>
                  </div>
                </div>

                <div style="height: 38px; width: 1px; background: #cbd5e1;"></div>

                <div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); letter-spacing: 0.5px;">Cost / Item (Unit)</div>
                  <div style="font-size: 20px; font-weight: 800; color: var(--text-main); font-family: var(--font-mono); margin-top: 4px;">
                    ₹${(totals.unitCost || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style="height: 38px; width: 1px; background: #cbd5e1;"></div>

                <div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #1e40af; letter-spacing: 0.5px;">Total Mfg Cost</div>
                  <div style="font-size: 20px; font-weight: 800; color: #1e40af; font-family: var(--font-mono); margin-top: 4px;">
                    ₹${(totals.totalCost || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ROW 1 GRAND TOTALS HIGHLIGHT BAR (Excel Recreation Row 1) -->
        <div class="card-panel" style="background: #064e3b; border: 1px solid #065f46; color: #ffffff; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #6ee7b7; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> ROW 1 GRAND TOTALS HIGHLIGHT BAR &mdash; RECONSTRUCTED FROM EXCEL
            </div>
            <div style="font-size: 11px; color: #a7f3d0;">
              All totals multiplied across full quantity (${est.productQty || 1} units)
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(95px, 1fr)); gap: 8px;">
            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">W. CFT</div>
              <div id="hl-metric-woodCft" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ${highlightMetrics.woodCft}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">C. Lab</div>
              <div id="hl-metric-cLab" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.cLab.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">P. Mat.</div>
              <div id="hl-metric-pMat" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.pMat.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">P. Lab.</div>
              <div id="hl-metric-pLab" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.pLab.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">Packing</div>
              <div id="hl-metric-packing" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.packing.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">F. Expense</div>
              <div id="hl-metric-fExpense" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.fExpense.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">Fabric</div>
              <div id="hl-metric-fabric" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.fabric.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">U. Lab.</div>
              <div id="hl-metric-uLab" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.uLab.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(255,255,255,0.08); padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #a7f3d0; font-weight: 700;">Foam</div>
              <div id="hl-metric-foam" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); margin-top: 2px;">
                ₹${highlightMetrics.foam.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(16, 185, 129, 0.25); border: 1px solid #10b981; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #6ee7b7; font-weight: 700;">25% Profit</div>
              <div id="hl-metric-profit25" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #ffffff; margin-top: 2px;">
                ₹${highlightMetrics.profit25.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(59, 130, 246, 0.25); border: 1px solid #3b82f6; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; color: #93c5fd; font-weight: 700;">30% Profit</div>
              <div id="hl-metric-profit30" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #ffffff; margin-top: 2px;">
                ₹${highlightMetrics.profit30.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #10b981; color: #064e3b; padding: 8px; border-radius: 6px; text-align: center;">
              <div style="font-size: 10px; text-transform: uppercase; font-weight: 800;">T. Qtn Amt.</div>
              <div id="hl-metric-totalSelling" style="font-size: 14px; font-weight: 900; font-family: var(--font-mono); margin-top: 2px;">
                ₹${(totals.totalSellingPrice || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        <!-- MAIN SPREADSHEET 2-COLUMN GRID (Manufacturing Costs Table vs Wood Cut List) -->
        <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 18px; align-items: flex-start;">
          
          <!-- LEFT COLUMN: MANUFACTURING COST CATEGORIES (Editable Rows & Categories) -->
          <div class="card-panel" style="padding: 0; overflow: hidden; border: 1.5px solid var(--border-light);">
            <!-- Suggestions datalist for category names -->
            <datalist id="cost-category-suggestions">
              <option value="Mahogany">
              <option value="Wood Ash">
              <option value="Teak Wood">
              <option value="Rosewood / Sheesham">
              <option value="Oak Wood">
              <option value="Pine Wood">
              <option value="Plywood (Marine 710)">
              <option value="Plywood (Commercial 303)">
              <option value="MDF / HDHMR Board">
              <option value="Veneer Sheet">
              <option value="Carpenter">
              <option value="Polish Material">
              <option value="Polish Labour">
              <option value="PU Polish">
              <option value="Melamine Polish">
              <option value="Foam">
              <option value="Foam 32D / 40D">
              <option value="Fabric">
              <option value="Fabric Velvet">
              <option value="Leatherette">
              <option value="Genuine Leather">
              <option value="Upholstery Labour">
              <option value="Packing">
              <option value="Factory Expense">
              <option value="Metal Work">
              <option value="Brass Inlay &amp; Fittings">
              <option value="Rattan">
              <option value="Rope">
              <option value="Consumables">
              <option value="Ar. Marble">
              <option value="Italian Marble">
              <option value="Granite Top">
              <option value="Fluted Glass">
              <option value="Toughened Glass">
              <option value="Hardware &amp; Hinges">
              <option value="Transportation / Freight">
            </datalist>

            <div class="card-panel-header" style="background: #f8fafc; padding: 12px 16px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <div class="card-panel-title" style="font-size: 14px; font-weight: 800; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                  <span>📋</span> Manufacturing Cost Categories
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  Edit category names &bull; Rate &times; Qty calculation &bull; Direct amount entries.
                </div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button 
                  type="button" 
                  class="btn btn-secondary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.resetStandardCategories()"
                  style="padding: 4px 8px; font-size: 11px; color: #64748b;"
                  title="Reset to 16 original standard Excel categories"
                >
                  ↺ Reset 16 Categories
                </button>
                <button 
                  type="button" 
                  class="btn btn-primary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.addCostRow()"
                  style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; background: #059669; border-color: #059669; display: flex; align-items: center; gap: 4px;"
                >
                  <span>➕</span> Add Particular / Category
                </button>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table class="table" style="margin: 0; width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #f1f5f9; font-size: 11px;">
                    <th style="width: 34px; text-align: center; padding: 6px;">#</th>
                    <th style="padding: 6px 10px;">Particulars / Category</th>
                    <th style="width: 85px; text-align: right; padding: 6px 8px;">Rate (₹)</th>
                    <th style="width: 65px; text-align: right; padding: 6px 8px;">Qty</th>
                    <th style="width: 95px; text-align: right; padding: 6px 8px;">Amount (₹)</th>
                    <th style="width: 32px; padding: 4px; text-align: center;"></th>
                  </tr>
                </thead>
                <tbody id="excel-cost-rows-tbody">
                  ${costRows.map((row, idx) => {
                    const rowNameEsc = (row.name || '').replace(/"/g, '&quot;');
                    return `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 6px; font-family: var(--font-mono);">
                          ${idx + 1}
                        </td>
                        <td style="padding: 4px 8px;">
                          <input 
                            type="text" 
                            id="cost-name-${idx}"
                            list="cost-category-suggestions"
                            class="form-input" 
                            value="${rowNameEsc}" 
                            placeholder="Enter particular / category..."
                            oninput="window.Zoosh.Views.Estimate.updateCostRowName(${idx}, this.value)"
                            onchange="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'name', this.value)"
                            style="padding: 3px 8px; font-size: 12.5px; font-weight: 600; width: 100%; border: 1px solid #cbd5e1; border-radius: 4px; background: #ffffff; color: var(--text-main);"
                          />
                        </td>
                        <td style="padding: 4px 6px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            id="cost-rate-${idx}"
                            class="form-input" 
                            value="${row.rate || 0}" 
                            oninput="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'rate', this.value)"
                            style="padding: 3px 6px; font-size: 12px; font-family: var(--font-mono); text-align: right; width: 80px;"
                          />
                        </td>
                        <td style="padding: 4px 6px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            id="cost-qty-${idx}"
                            class="form-input" 
                            value="${row.qty !== undefined ? row.qty : 1}" 
                            oninput="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'qty', this.value)"
                            style="padding: 3px 6px; font-size: 12px; font-family: var(--font-mono); text-align: right; width: 60px;"
                          />
                        </td>
                        <td style="padding: 4px 6px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            id="cost-amount-${idx}"
                            class="form-input" 
                            value="${row.amount || 0}" 
                            oninput="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'amount', this.value, true)"
                            style="padding: 3px 6px; font-size: 12px; font-weight: 700; font-family: var(--font-mono); text-align: right; width: 90px; background: ${row.isDirect ? '#fffbeb' : '#ffffff'};"
                            title="${row.isDirect ? 'Direct amount entry' : 'Calculated: Rate × Qty'}"
                          />
                        </td>
                        <td style="text-align: center; padding: 4px;">
                          <button 
                            type="button"
                            class="btn btn-secondary btn-sm" 
                            onclick="window.Zoosh.Views.Estimate.deleteCostRow(${idx})"
                            style="padding: 2px 5px; font-size: 12px; color: #ef4444; border: 1px solid transparent; background: transparent; cursor: pointer; border-radius: 4px; line-height: 1;"
                            onmouseover="this.style.background='#fee2e2'; this.style.borderColor='#fca5a5'"
                            onmouseout="this.style.background='transparent'; this.style.borderColor='transparent'"
                            title="Delete row"
                          >&times;</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                  <tr style="background: #f8fafc; border-top: 1px dashed #cbd5e1;">
                    <td colspan="6" style="padding: 8px 10px; text-align: left;">
                      <button 
                        type="button" 
                        class="btn btn-secondary btn-sm" 
                        onclick="window.Zoosh.Views.Estimate.addCostRow()"
                        style="padding: 4px 12px; font-size: 12px; font-weight: 700; color: #059669; border: 1.5px dashed #10b981; background: #ecfdf5; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; border-radius: 6px;"
                      >
                        <span>➕</span> Add Particular / Category
                      </button>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 800;">
                    <td colspan="4" style="text-align: right; padding: 10px; font-size: 13px; text-transform: uppercase;">
                      Cost / Item (=SUM):
                    </td>
                    <td id="cost-total-unit-cost" style="text-align: right; padding: 10px; font-size: 15px; font-family: var(--font-mono); color: #059669;">
                      ₹${(totals.unitCost || 0).toLocaleString('en-IN')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <!-- RIGHT COLUMN: WOOD ESTIMATION CUT LIST & CFT CALCULATOR -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="card-panel" style="padding: 0; overflow: hidden; border: 1.5px solid var(--border-light);">
              <div class="card-panel-header" style="background: #fefce8; padding: 12px 16px; border-bottom: 1px solid #fef08a; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div class="card-panel-title" style="font-size: 14px; font-weight: 800; color: #854d0e; display: flex; align-items: center; gap: 6px;">
                    <span>🪵</span> Wood Estimation &mdash; CFT Cut List
                  </div>
                  <div style="font-size: 11.5px; color: #a16207; margin-top: 2px;">
                    Formula: <strong>CFT = (Length &times; Width &times; Height &times; Qty) / 144</strong>
                  </div>
                </div>
                <button 
                  type="button" 
                  class="btn btn-secondary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.addWoodRow()"
                  style="padding: 3px 8px; font-size: 11.5px;"
                >
                  + Add Piece
                </button>
              </div>

              <!-- Mixed Units Banner -->
              <div style="background: #fffbeb; padding: 6px 14px; font-size: 11px; color: #92400e; border-bottom: 1px solid #fde68a; display: flex; justify-content: space-between;">
                <span>Units: <strong>L in Feet (ft)</strong> &bull; <strong>W in Inches (in)</strong> &bull; <strong>Thickness/H in Inches (in)</strong></span>
                <span>Divisor: <strong>144</strong></span>
              </div>

              <div style="overflow-x: auto;">
                <table class="table" style="margin: 0; width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #fefce8; font-size: 11px;">
                      <th style="padding: 6px 10px;">Part / Description</th>
                      <th style="width: 58px; text-align: right; padding: 6px 4px;">L (ft)</th>
                      <th style="width: 58px; text-align: right; padding: 6px 4px;">W (in)</th>
                      <th style="width: 58px; text-align: right; padding: 6px 4px;">H (in)</th>
                      <th style="width: 48px; text-align: right; padding: 6px 4px;">Qty</th>
                      <th style="width: 72px; text-align: right; padding: 6px 8px;">CFT</th>
                      <th style="width: 28px; padding: 4px;"></th>
                    </tr>
                  </thead>
                  <tbody id="excel-wood-rows-tbody">
                    ${woodRows.map((w, idx) => `
                      <tr style="border-bottom: 1px solid #fef9c3;">
                        <td style="padding: 4px 8px;">
                          <input 
                            type="text" 
                            class="form-input" 
                            value="${w.part || `Part ${idx + 1}`}" 
                            onchange="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'part', this.value)"
                            style="padding: 2px 6px; font-size: 11.5px; width: 100%; font-weight: 600;"
                          />
                        </td>
                        <td style="padding: 4px 2px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            class="form-input" 
                            value="${w.length || 0}" 
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'length', this.value)"
                            style="padding: 2px 4px; font-size: 11.5px; font-family: var(--font-mono); text-align: right; width: 54px;"
                          />
                        </td>
                        <td style="padding: 4px 2px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            class="form-input" 
                            value="${w.width || 0}" 
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'width', this.value)"
                            style="padding: 2px 4px; font-size: 11.5px; font-family: var(--font-mono); text-align: right; width: 54px;"
                          />
                        </td>
                        <td style="padding: 4px 2px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            class="form-input" 
                            value="${w.thickness || 0}" 
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'thickness', this.value)"
                            style="padding: 2px 4px; font-size: 11.5px; font-family: var(--font-mono); text-align: right; width: 54px;"
                          />
                        </td>
                        <td style="padding: 4px 2px; text-align: right;">
                          <input 
                            type="number" 
                            min="1"
                            class="form-input" 
                            value="${w.qty || 1}" 
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'qty', this.value)"
                            style="padding: 2px 4px; font-size: 11.5px; font-family: var(--font-mono); text-align: right; width: 44px;"
                          />
                        </td>
                        <td style="padding: 4px 8px; text-align: right; font-family: var(--font-mono); font-weight: 700; font-size: 12px; color: #854d0e;">
                          ${w.cft || 0}
                        </td>
                        <td style="text-align: center; padding: 2px;">
                          <button 
                            class="btn btn-secondary btn-sm" 
                            onclick="window.Zoosh.Views.Estimate.deleteWoodRow(${idx})"
                            style="padding: 1px 4px; font-size: 10px; color: #ef4444;"
                            title="Delete cut piece"
                          >&times;</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background: #fefce8; border-top: 2px solid #fde047; font-weight: 800;">
                      <td colspan="5" style="text-align: right; padding: 8px; font-size: 12px; text-transform: uppercase;">
                        Total CFT (1 Unit):
                      </td>
                      <td style="text-align: right; padding: 8px; font-size: 14px; font-family: var(--font-mono); color: #854d0e;">
                        ${totals.unitWoodCft || 0}
                      </td>
                      <td></td>
                    </tr>
                    <tr style="background: #fef9c3; font-weight: 800;">
                      <td colspan="5" style="text-align: right; padding: 8px; font-size: 12px; text-transform: uppercase;">
                        Total CFT for Full Quantity (${est.productQty || 1} Units):
                      </td>
                      <td style="text-align: right; padding: 8px; font-size: 14px; font-family: var(--font-mono); color: #b45309;">
                        ${totals.totalWoodCft || 0}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Quick Sync Button to Mahogany / Wood Ash -->
              <div style="padding: 10px 14px; background: #fffbeb; border-top: 1px solid #fde68a; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #92400e;">Transfer CFT to Cost Table:</span>
                <div style="display: flex; gap: 6px;">
                  <button 
                    type="button" 
                    class="btn btn-secondary btn-sm" 
                    onclick="window.Zoosh.Views.Estimate.applyCftToCostCategory('mahogany')"
                    style="font-size: 11px; padding: 2px 8px; font-weight: 600;"
                  >
                    &rarr; Mahogany (${totals.unitWoodCft || 0} CFT)
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-secondary btn-sm" 
                    onclick="window.Zoosh.Views.Estimate.applyCftToCostCategory('wood_ash')"
                    style="font-size: 11px; padding: 2px 8px; font-weight: 600;"
                  >
                    &rarr; Wood Ash
                  </button>
                </div>
              </div>
            </div>

            <!-- GRAND TOTALS, PROFIT TIERS & PRICING CARDS -->
            <div class="card-panel" style="padding: 16px; border: 1.5px solid #10b981; background: #f0fdf4;">
              <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #065f46; letter-spacing: 0.6px; margin-bottom: 12px; display: flex; justify-content: space-between;">
                <span>💰 GRAND TOTALS &amp; PROFIT CALCULATION</span>
                <span>Quantity: <strong>${est.productQty || 1} Units</strong></span>
              </div>

              <!-- Profit Tiers Selection -->
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                <!-- 25% Profit -->
                <div 
                  onclick="window.Zoosh.Views.Estimate.selectProfitTier('25')"
                  style="
                    border: 2px solid ${est.selectedProfitTier === '25' ? '#10b981' : '#cbd5e1'};
                    background: ${est.selectedProfitTier === '25' ? '#ffffff' : '#f8fafc'};
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    box-shadow: ${est.selectedProfitTier === '25' ? '0 2px 6px rgba(16, 185, 129, 0.15)' : 'none'};
                  "
                >
                  <div style="font-size: 11px; font-weight: 700; color: #065f46; display: flex; justify-content: space-between;">
                    <span>25% Profit</span>
                    ${est.selectedProfitTier === '25' ? '<span>✓ Active</span>' : ''}
                  </div>
                  <div id="gt-profit25-amount" style="font-size: 14px; font-weight: 800; font-family: var(--font-mono); color: var(--text-main); margin-top: 3px;">
                    +₹${(totals.profit25 || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-profit25-total" style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                    Total: ₹${((totals.totalCost || 0) + (totals.profit25 || 0)).toLocaleString('en-IN')}
                  </div>
                </div>

                <!-- 30% Profit -->
                <div 
                  onclick="window.Zoosh.Views.Estimate.selectProfitTier('30')"
                  style="
                    border: 2px solid ${est.selectedProfitTier === '30' ? '#3b82f6' : '#cbd5e1'};
                    background: ${est.selectedProfitTier === '30' ? '#ffffff' : '#f8fafc'};
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    box-shadow: ${est.selectedProfitTier === '30' ? '0 2px 6px rgba(59, 130, 246, 0.15)' : 'none'};
                  "
                >
                  <div style="font-size: 11px; font-weight: 700; color: #1e40af; display: flex; justify-content: space-between;">
                    <span>30% Profit</span>
                    ${est.selectedProfitTier === '30' ? '<span>✓ Active</span>' : ''}
                  </div>
                  <div id="gt-profit30-amount" style="font-size: 14px; font-weight: 800; font-family: var(--font-mono); color: var(--text-main); margin-top: 3px;">
                    +₹${(totals.profit30 || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-profit30-total" style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                    Total: ₹${((totals.totalCost || 0) + (totals.profit30 || 0)).toLocaleString('en-IN')}
                  </div>
                </div>

                <!-- Custom Editable Profit % -->
                <div 
                  onclick="window.Zoosh.Views.Estimate.selectProfitTier('custom')"
                  style="
                    border: 2px solid ${est.selectedProfitTier === 'custom' ? '#8b5cf6' : '#cbd5e1'};
                    background: ${est.selectedProfitTier === 'custom' ? '#ffffff' : '#f8fafc'};
                    padding: 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    box-shadow: ${est.selectedProfitTier === 'custom' ? '0 2px 6px rgba(139, 92, 246, 0.15)' : 'none'};
                  "
                >
                  <div style="font-size: 11px; font-weight: 700; color: #6d28d9; display: flex; justify-content: space-between;">
                    <span>Custom Margin</span>
                    ${est.selectedProfitTier === 'custom' ? '<span>✓ Active</span>' : ''}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                    <input 
                      type="number" 
                      min="0" 
                      max="200" 
                      value="${est.customProfitPercent || 25}" 
                      oninput="window.Zoosh.Views.Estimate.updateCustomProfitPercent(this.value)"
                      style="width: 50px; padding: 1px 4px; font-size: 13px; font-weight: 800; font-family: var(--font-mono); text-align: center; border: 1px solid #cbd5e1; border-radius: 4px;"
                    />
                    <span style="font-size: 12px; font-weight: 700;">%</span>
                    <span id="gt-custom-profit-amount" style="font-size: 12px; font-family: var(--font-mono); font-weight: 700; margin-left: 4px;">
                      +₹${(totals.customProfitAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Final Pricing Highlight -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #a7f3d0;">
                <div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted);">Selling Price Per Unit</div>
                  <div id="gt-unit-selling-price" style="font-size: 20px; font-weight: 900; font-family: var(--font-mono); color: #065f46; margin-top: 2px;">
                    ₹${(totals.unitSellingPrice || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-unit-mfg-cost" style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">Mfg: ₹${(totals.unitCost || 0).toLocaleString('en-IN')} / unit</div>
                </div>

                <div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #047857;">TOTAL QUOTATION AMOUNT</div>
                  <div id="gt-total-selling-price" style="font-size: 22px; font-weight: 900; font-family: var(--font-mono); color: #059669; margin-top: 2px;">
                    ₹${(totals.totalSellingPrice || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-active-profit-amount" style="font-size: 10.5px; color: #059669; font-weight: 700; margin-top: 2px;">
                    Net Profit: +₹${(totals.activeProfitAmount || totals.profit25 || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <!-- Footer Actions -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 10px; border-top: 1px solid #d1fae5;">
                <button 
                  type="button" 
                  class="btn btn-secondary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.resetToSampleExcelModel()"
                  style="font-size: 11px; padding: 4px 8px; color: #64748b;"
                  title="Prefill with exact Sitout Chair numbers from uploaded Excel file"
                >
                  🔄 Reset to Excel Sample
                </button>

                <button 
                  type="button" 
                  class="btn btn-primary" 
                  onclick="window.Zoosh.Views.Estimate.saveCurrentEstimate()"
                  style="padding: 8px 20px; font-weight: 800; font-size: 13px; background: #059669; border-color: #059669; display: flex; align-items: center; gap: 6px;"
                >
                  💾 Save Product Estimate
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // =========================================================================
  // CALCULATION LOGIC & STATE MUTATION
  // =========================================================================

  recalculateTempEstimateTotals() {
    const est = this.tempEstimate;
    if (!est) return;

    const qty = parseInt(est.productQty, 10) || 1;
    est.productQty = qty;

    // 1. Recalculate Wood Cut List
    let unitWoodCft = 0;
    (est.woodRows || []).forEach(w => {
      const l = parseFloat(w.length) || 0;
      const width = parseFloat(w.width) || 0;
      const th = parseFloat(w.thickness) || 0;
      const wQty = parseFloat(w.qty) || 1;
      // Formula: (Length(ft) * Width(in) * Thickness(in) * Quantity) / 144
      const cft = (l * width * th * wQty) / 144;
      w.cft = Math.round(cft * 10000) / 10000;
      unitWoodCft += cft;
    });

    unitWoodCft = Math.round(unitWoodCft * 1000) / 1000;
    const totalWoodCft = Math.round(unitWoodCft * qty * 1000) / 1000;

    // 2. Recalculate Cost Rows
    let unitCost = 0;
    (est.costRows || []).forEach(row => {
      if (row.isDirect) {
        // Direct entry: amount is authoritative
        row.amount = parseFloat(row.amount) || 0;
      } else {
        // Rate * Qty
        const r = parseFloat(row.rate) || 0;
        const q = parseFloat(row.qty) !== undefined ? parseFloat(row.qty) : 1;
        row.amount = Math.round(r * q * 100) / 100;
      }
      unitCost += row.amount;
    });

    unitCost = Math.round(unitCost);
    const totalCost = unitCost * qty;

    // 3. Profit Tiers & Total Selling Price
    const profit25 = Math.round(totalCost * 0.25);
    const profit30 = Math.round(totalCost * 0.30);
    const customProfitPercent = parseFloat(est.customProfitPercent) !== undefined ? parseFloat(est.customProfitPercent) : 25;
    const customProfitAmount = Math.round(totalCost * (customProfitPercent / 100));

    let activeProfitAmount = profit25;
    if (est.selectedProfitTier === '30') {
      activeProfitAmount = profit30;
    } else if (est.selectedProfitTier === 'custom') {
      activeProfitAmount = customProfitAmount;
    }

    const totalSellingPrice = totalCost + activeProfitAmount;
    const unitSellingPrice = Math.round(totalSellingPrice / qty);

    est.totals = {
      unitWoodCft: unitWoodCft,
      totalWoodCft: totalWoodCft,
      unitCost: unitCost,
      totalCost: totalCost,
      profit25: profit25,
      profit30: profit30,
      customProfitPercent: customProfitPercent,
      customProfitAmount: customProfitAmount,
      activeProfitAmount: activeProfitAmount,
      unitSellingPrice: unitSellingPrice,
      totalSellingPrice: totalSellingPrice
    };
  },

  getHighlightBarMetrics(est) {
    const qty = parseInt(est.productQty, 10) || 1;
    const totals = est.totals || {};

    const getRowTotal = (idKey, nameKeyword) => {
      const row = (est.costRows || []).find(r => 
        (r.id && r.id === idKey) || 
        (r.name && nameKeyword && r.name.toLowerCase().includes(nameKeyword))
      );
      return row ? (parseFloat(row.amount) || 0) * qty : 0;
    };

    return {
      woodCft: totals.totalWoodCft || 0,
      cLab: getRowTotal('carpenter', 'carpenter'),
      pMat: getRowTotal('polish_material', 'polish mat'),
      pLab: getRowTotal('polish_labour', 'polish lab'),
      packing: getRowTotal('packing', 'packing'),
      fExpense: getRowTotal('factory_expense', 'factory'),
      fabric: getRowTotal('fabric', 'fabric'),
      uLab: getRowTotal('upholstery_labour', 'upholstery'),
      foam: getRowTotal('foam', 'foam'),
      profit25: totals.profit25 || 0,
      profit30: totals.profit30 || 0,
      totalSelling: totals.totalSellingPrice || 0
    };
  },

  updateProductField(field, val) {
    if (!this.tempEstimate) return;
    this.tempEstimate[field] = val;
  },

  updateProductQuantity(val) {
    if (!this.tempEstimate) return;
    const q = parseInt(val, 10);
    this.tempEstimate.productQty = (q && q > 0) ? q : 1;
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
  },

  updateCostRowName(idx, val) {
    if (!this.tempEstimate || !this.tempEstimate.costRows || !this.tempEstimate.costRows[idx]) return;
    this.tempEstimate.costRows[idx].name = val;
  },

  updateCostRow(idx, field, val, isDirectAmount = false) {
    if (!this.tempEstimate || !this.tempEstimate.costRows || !this.tempEstimate.costRows[idx]) return;
    const row = this.tempEstimate.costRows[idx];

    if (field === 'amount' && isDirectAmount) {
      row.amount = parseFloat(val) || 0;
      row.isDirect = true;
    } else if (field === 'rate' || field === 'qty') {
      row[field] = parseFloat(val) || 0;
      row.isDirect = false;
      row.amount = Math.round((parseFloat(row.rate) || 0) * (parseFloat(row.qty) || 0));
      const amtInput = document.getElementById(`cost-amount-${idx}`);
      if (amtInput && !amtInput.matches(':focus')) {
        amtInput.value = row.amount;
        amtInput.style.background = '#ffffff';
      }
    } else if (field === 'name') {
      row.name = val;
      return;
    } else {
      row[field] = val;
    }

    this.recalculateTempEstimateTotals();
    this.refreshCalculatedDOMElements();
  },

  addCostRow(suggestedName = '', rate = 0, qty = 1, amount = 0, isDirect = false) {
    if (!this.tempEstimate) return;
    this.tempEstimate.costRows = this.tempEstimate.costRows || [];
    const newIdx = this.tempEstimate.costRows.length;
    this.tempEstimate.costRows.push({
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: suggestedName || '',
      rate: rate || 0,
      qty: qty !== undefined ? qty : 1,
      amount: amount || ((rate || 0) * (qty !== undefined ? qty : 1)),
      isDirect: isDirect || false,
      isCustom: true
    });
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));

    setTimeout(() => {
      const input = document.getElementById(`cost-name-${newIdx}`);
      if (input) {
        input.focus();
        input.select();
      }
    }, 60);

    if (window.Zoosh.Toast) {
      window.Zoosh.Toast.show('Added new particular / category row', 'success');
    }
  },

  addCustomCostRow() {
    this.addCostRow();
  },

  deleteCostRow(idx) {
    if (!this.tempEstimate || !this.tempEstimate.costRows || !this.tempEstimate.costRows[idx]) return;
    const deletedName = this.tempEstimate.costRows[idx].name || `Row #${idx + 1}`;
    this.tempEstimate.costRows.splice(idx, 1);
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));

    if (window.Zoosh.Toast) {
      window.Zoosh.Toast.show(`Deleted "${deletedName}"`, 'info');
    }
  },

  resetStandardCategories() {
    if (!this.tempEstimate) return;
    if (!confirm('Reset cost categories to standard 16 Excel rows? Any custom changes or rows will be reset.')) return;

    if (window.Zoosh.State && window.Zoosh.State.STANDARD_COST_CATEGORIES) {
      this.tempEstimate.costRows = window.Zoosh.State.STANDARD_COST_CATEGORIES.map(cat => ({
        id: cat.id,
        name: cat.name,
        rate: cat.defaultRate,
        qty: cat.defaultQty,
        amount: cat.defaultAmount,
        isDirect: cat.isDirect
      }));
    } else {
      this.tempEstimate.costRows = [
        { id: 'mahogany', name: 'Mahogany', rate: 2500, qty: 0, amount: 0, isDirect: false },
        { id: 'wood_ash', name: 'Wood Ash', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'carpenter', name: 'Carpenter', rate: 3000, qty: 0, amount: 0, isDirect: false },
        { id: 'polish_material', name: 'Polish Material', rate: 1500, qty: 0, amount: 0, isDirect: false },
        { id: 'polish_labour', name: 'Polish Labour', rate: 2400, qty: 0, amount: 0, isDirect: false },
        { id: 'foam', name: 'Foam', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'fabric', name: 'Fabric', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'upholstery_labour', name: 'Upholstery Labour', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'packing', name: 'Packing', rate: 250, qty: 1, amount: 250, isDirect: true },
        { id: 'factory_expense', name: 'Factory Expense', rate: 500, qty: 1, amount: 500, isDirect: true },
        { id: 'metal_work', name: 'Metal Work', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'rattan', name: 'Rattan', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'rope', name: 'Rope', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'consumables', name: 'Consumables', rate: 30, qty: 1, amount: 30, isDirect: true },
        { id: 'ar_marble', name: 'Ar. Marble', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'plywood', name: 'Plywood', rate: 0, qty: 0, amount: 0, isDirect: false }
      ];
    }

    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
    if (window.Zoosh.Toast) {
      window.Zoosh.Toast.show('Reset to standard 16 Excel categories', 'success');
    }
  },

  refreshCalculatedDOMElements() {
    const est = this.tempEstimate;
    if (!est) return;
    const totals = est.totals || {};
    const highlightMetrics = this.getHighlightBarMetrics(est);

    const setTxt = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };

    setTxt('cost-total-unit-cost', `₹${(totals.unitCost || 0).toLocaleString('en-IN')}`);

    setTxt('hl-metric-woodCft', String(highlightMetrics.woodCft));
    setTxt('hl-metric-cLab', `₹${(highlightMetrics.cLab || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-pMat', `₹${(highlightMetrics.pMat || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-pLab', `₹${(highlightMetrics.pLab || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-packing', `₹${(highlightMetrics.packing || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-fExpense', `₹${(highlightMetrics.fExpense || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-fabric', `₹${(highlightMetrics.fabric || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-uLab', `₹${(highlightMetrics.uLab || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-foam', `₹${(highlightMetrics.foam || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-profit25', `₹${(highlightMetrics.profit25 || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-profit30', `₹${(highlightMetrics.profit30 || 0).toLocaleString('en-IN')}`);
    setTxt('hl-metric-totalSelling', `₹${(totals.totalSellingPrice || 0).toLocaleString('en-IN')}`);

    setTxt('gt-profit25-amount', `+₹${(totals.profit25 || 0).toLocaleString('en-IN')}`);
    setTxt('gt-profit25-total', `Total: ₹${((totals.totalCost || 0) + (totals.profit25 || 0)).toLocaleString('en-IN')}`);
    setTxt('gt-profit30-amount', `+₹${(totals.profit30 || 0).toLocaleString('en-IN')}`);
    setTxt('gt-profit30-total', `Total: ₹${((totals.totalCost || 0) + (totals.profit30 || 0)).toLocaleString('en-IN')}`);
    setTxt('gt-custom-profit-amount', `+₹${(totals.customProfitAmount || 0).toLocaleString('en-IN')}`);
    setTxt('gt-unit-selling-price', `₹${(totals.unitSellingPrice || 0).toLocaleString('en-IN')}`);
    setTxt('gt-unit-mfg-cost', `Mfg: ₹${(totals.unitCost || 0).toLocaleString('en-IN')} / unit`);
    setTxt('gt-total-selling-price', `₹${(totals.totalSellingPrice || 0).toLocaleString('en-IN')}`);
    setTxt('gt-active-profit-amount', `Net Profit: +₹${(totals.activeProfitAmount || totals.profit25 || 0).toLocaleString('en-IN')}`);
  },

  updateWoodRow(idx, field, val) {
    if (!this.tempEstimate || !this.tempEstimate.woodRows[idx]) return;
    const w = this.tempEstimate.woodRows[idx];
    if (field === 'part') {
      w.part = val;
    } else {
      w[field] = parseFloat(val) || 0;
    }

    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
  },

  addWoodRow() {
    if (!this.tempEstimate) return;
    this.tempEstimate.woodRows = this.tempEstimate.woodRows || [];
    this.tempEstimate.woodRows.push({
      part: `Part ${this.tempEstimate.woodRows.length + 1}`,
      length: 2,
      width: 2,
      thickness: 1.5,
      qty: 2,
      cft: 0.0833
    });
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
  },

  deleteWoodRow(idx) {
    if (!this.tempEstimate || !this.tempEstimate.woodRows[idx]) return;
    this.tempEstimate.woodRows.splice(idx, 1);
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
  },

  applyCftToCostCategory(categoryId) {
    if (!this.tempEstimate) return;
    const catLower = String(categoryId || '').toLowerCase();
    const row = (this.tempEstimate.costRows || []).find(r => 
      r.id === categoryId || 
      (r.id && r.id.toLowerCase() === catLower) ||
      (r.name && r.name.toLowerCase() === catLower) ||
      (r.name && r.name.toLowerCase().includes(catLower))
    );
    if (!row) {
      alert(`Cost category ${categoryId} not found.`);
      return;
    }

    const cft = this.tempEstimate.totals.unitWoodCft || 0;
    row.qty = cft;
    row.isDirect = false;
    row.amount = Math.round((parseFloat(row.rate) || 0) * cft);
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));

    if (window.Zoosh.Toast) {
      window.Zoosh.Toast.show(`Transferred ${cft} CFT into ${row.name} quantity!`, 'success');
    }
  },

  selectProfitTier(tier) {
    if (!this.tempEstimate) return;
    this.tempEstimate.selectedProfitTier = tier;
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
  },

  updateCustomProfitPercent(val) {
    if (!this.tempEstimate) return;
    this.tempEstimate.customProfitPercent = parseFloat(val) || 0;
    this.tempEstimate.selectedProfitTier = 'custom';
    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
  },

  handlePhotoUpload(input) {
    if (!input || !input.files || !input.files[0]) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (this.tempEstimate) {
        this.tempEstimate.photo = dataUrl;
        this.render(document.getElementById('view-container'));
      }
    };
    reader.readAsDataURL(file);
  },

  saveCurrentEstimate() {
    if (!this.activeFurnitureId || !this.tempEstimate) return;

    this.recalculateTempEstimateTotals();
    const saved = window.Zoosh.State.saveEstimate(this.activeFurnitureId, this.tempEstimate);
    this.tempEstimate = saved;

    if (window.Zoosh.Toast) {
      window.Zoosh.Toast.show(`Estimate for "${saved.productName}" saved successfully!`, 'success');
    } else {
      alert(`Success: Estimate for "${saved.productName}" saved! Combined project summary updated.`);
    }

    this.render(document.getElementById('view-container'));
  },

  resetToSampleExcelModel() {
    if (!this.tempEstimate) return;
    if (!confirm('Reset current sheet to the exact Sitout Chair sample values from samle estimate.xlsx?')) return;

    this.tempEstimate.productName = 'Sitout Chair';
    this.tempEstimate.productQty = 2;
    this.tempEstimate.photo = 'assets/sample_chair.jpeg';
    this.tempEstimate.selectedProfitTier = '25';
    this.tempEstimate.customProfitPercent = 25;

    this.tempEstimate.costRows = [
      { id: 'mahogany', name: 'Mahogany', rate: 2500, qty: 1.408, amount: 3520, isDirect: false },
      { id: 'wood_ash', name: 'Wood Ash', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'carpenter', name: 'Carpenter', rate: 3000, qty: 1, amount: 3000, isDirect: false },
      { id: 'polish_material', name: 'Polish Material', rate: 1500, qty: 1, amount: 1500, isDirect: false },
      { id: 'polish_labour', name: 'Polish Labour', rate: 2400, qty: 1, amount: 2400, isDirect: false },
      { id: 'foam', name: 'Foam', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'fabric', name: 'Fabric', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'upholstery_labour', name: 'Upholstery Labour', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'packing', name: 'Packing', rate: 250, qty: 1, amount: 250, isDirect: true },
      { id: 'factory_expense', name: 'Factory Expense', rate: 500, qty: 1, amount: 500, isDirect: true },
      { id: 'metal_work', name: 'Metal Work', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'rattan', name: 'Rattan', rate: 470, qty: 2, amount: 940, isDirect: false },
      { id: 'rope', name: 'Rope', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'consumables', name: 'Consumables', rate: 30, qty: 1, amount: 30, isDirect: true },
      { id: 'ar_marble', name: 'Ar. Marble', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'plywood', name: 'Plywood', rate: 0, qty: 0, amount: 0, isDirect: false }
    ];

    this.tempEstimate.woodRows = [
      { part: 'Piece 1 (Back Rest Plank)', length: 4, width: 10, thickness: 1.5, qty: 1, cft: 0.4167 },
      { part: 'Piece 2 (Seat Rail)', length: 1.5, width: 7, thickness: 1.5, qty: 1, cft: 0.1094 },
      { part: 'Piece 3 (Leg Posts)', length: 2, width: 2.5, thickness: 1.5, qty: 4, cft: 0.2083 },
      { part: 'Piece 4 (Main Uprights)', length: 2, width: 2.5, thickness: 2, qty: 4, cft: 0.2778 },
      { part: 'Piece 5 (Cross Stretchers)', length: 2, width: 2.5, thickness: 1.5, qty: 2, cft: 0.1042 },
      { part: 'Piece 6 (Seat Base Plank)', length: 2, width: 11, thickness: 1.5, qty: 1, cft: 0.2292 },
      { part: 'Piece 7 (Arm Supports)', length: 2, width: 1.5, thickness: 1.5, qty: 2, cft: 0.0625 }
    ];

    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
  },

  exportCurrentEstimateCsv() {
    const est = this.tempEstimate;
    if (!est) return;

    let csv = `ZOOSH FURNITURE ESTIMATE REPORT\n`;
    csv += `Project,"${est.projectName}"\n`;
    csv += `Client,"${est.clientName}"\n`;
    csv += `Date,"${est.estimateDate}"\n`;
    csv += `Product,"${est.productName}",Qty,${est.productQty}\n\n`;

    csv += `MANUFACTURING COST CATEGORIES\n`;
    csv += `#,Particulars,Rate,Qty,Amount\n`;
    (est.costRows || []).forEach((r, idx) => {
      csv += `${idx + 1},"${r.name}",${r.rate || 0},${r.qty || 0},${r.amount || 0}\n`;
    });
    csv += `,"Cost/item (Unit Mfg Cost)",,,${est.totals.unitCost}\n`;
    csv += `,"Total Mfg Cost for ${est.productQty} units",,,${est.totals.totalCost}\n\n`;

    csv += `WOOD CUT LIST (CFT)\n`;
    csv += `#,Part,Length (ft),Width (in),Thickness (in),Qty,CFT\n`;
    (est.woodRows || []).forEach((w, idx) => {
      csv += `${idx + 1},"${w.part}",${w.length},${w.width},${w.thickness},${w.qty},${w.cft}\n`;
    });
    csv += `,"Unit Wood CFT",,,,,${est.totals.unitWoodCft}\n`;
    csv += `,"Total Wood CFT for ${est.productQty} units",,,,,${est.totals.totalWoodCft}\n\n`;

    csv += `PRICING & PROFIT SUMMARY\n`;
    csv += `Cost Per Unit,₹${est.totals.unitCost}\n`;
    csv += `Total Mfg Cost,₹${est.totals.totalCost}\n`;
    csv += `Profit Tier (${est.selectedProfitTier}%),₹${est.totals.activeProfitAmount || est.totals.profit25}\n`;
    csv += `Selling Price Per Unit,₹${est.totals.unitSellingPrice}\n`;
    csv += `Total Quotation Amount,₹${est.totals.totalSellingPrice}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Estimate_${(est.projectName || 'project').replace(/\s+/g, '_')}_${(est.productName || 'product').replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },

  printSheet() {
    window.print();
  }
};
