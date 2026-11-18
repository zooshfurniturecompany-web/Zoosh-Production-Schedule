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

  CATEGORY_SECTIONS: [
    { key: 'wood', title: 'Wood Species / Timber Options', icon: '🪵' },
    { key: 'carpentry', title: 'Carpentry & Structural', icon: '🔨' },
    { key: 'polish', title: 'Finishing & Polish', icon: '✨' },
    { key: 'upholstery', title: 'Upholstery & Soft Furnishing', icon: '🛋️' },
    { key: 'overheads', title: 'Factory Overheads & Packaging', icon: '📦' }
  ],

  getCategoryKey(row) {
    if (!row) return 'overheads';
    const cat = (row.category || '').toLowerCase();
    const name = (row.name || '').toLowerCase();
    const id = (row.id || '').toLowerCase();

    if (cat.includes('wood') || cat.includes('timber') || id === 'mahogany' || id === 'wood_ash' || id === 'teak' || name.includes('mahogany') || name.includes('wood ash') || name.includes('teak') || name.includes('timber')) {
      return 'wood';
    }
    if (cat.includes('carpenter') || cat.includes('structural') || id === 'carpenter' || id === 'plywood' || id === 'metal_work' || name.includes('carpenter') || name.includes('plywood') || name.includes('metal')) {
      return 'carpentry';
    }
    if (cat.includes('polish') || cat.includes('finish') || id === 'polish_material' || id === 'polish_labour' || name.includes('polish')) {
      return 'polish';
    }
    if (cat.includes('upholstery') || cat.includes('soft') || id === 'foam' || id === 'fabric' || id === 'upholstery_labour' || id === 'rattan' || id === 'rope' || name.includes('foam') || name.includes('fabric') || name.includes('upholstery') || name.includes('rattan') || name.includes('rope')) {
      return 'upholstery';
    }
    return 'overheads';
  },

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
      window.Zoosh.App.updateMobileHeader('Production Estimates', false);
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <!-- Clean ERP Page Heading (User Specified) -->
        <div class="view-header" style="margin-bottom: 0;">
          <div>
            <h1 class="view-header-title">Production Estimates</h1>
            <div class="view-header-subtitle">
              Manage product costing, manufacturing expenses, and estimated selling values.
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
                style="padding-left: 32px; font-size: 13px;"
              />
              <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 13px;">🔍</span>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Estimate.exportAllEstimatesCsv()" title="Export Summary to CSV">
              <span>📥</span> Export CSV
            </button>
          </div>
        </div>

        <!-- 4 Compact ERP Summary KPI Cards (User Specified) -->
        <div class="summary-cards-grid" style="margin-bottom: 0;">
          
          <!-- Card 1: Total Estimated Mfg Cost -->
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">Total Estimated Mfg Cost</span>
              <span style="font-size: 16px;">🏭</span>
            </div>
            <div class="metric-card-value" style="font-family: var(--font-mono); color: var(--text-main);">
              ₹${factoryTotalMfgCost.toLocaleString('en-IN')}
            </div>
            <div class="metric-card-hint">
              <span>Materials + Labour + Factory Overheads</span>
            </div>
          </div>

          <!-- Card 2: Total Estimated Selling Value -->
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">Total Estimated Selling Value</span>
              <span style="font-size: 16px;">📈</span>
            </div>
            <div class="metric-card-value" style="font-family: var(--font-mono); color: var(--primary-blue);">
              ₹${factoryTotalSelling.toLocaleString('en-IN')}
            </div>
            <div class="metric-card-hint">
              <span>Expected Quotation Realization</span>
            </div>
          </div>

          <!-- Card 3: Expected Factory Profit -->
          <div class="metric-card success">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">Expected Factory Profit</span>
              <span class="badge badge-success" style="font-size: 10px; padding: 1px 6px;">${factoryMargin}% Margin</span>
            </div>
            <div class="metric-card-value" style="font-family: var(--font-mono); color: var(--color-success);">
              ₹${factoryProfit.toLocaleString('en-IN')}
            </div>
            <div class="metric-card-hint">
              <span>Projected net manufacturing margin</span>
            </div>
          </div>

          <!-- Card 4: Products Costed -->
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">Products Costed</span>
              <span style="font-size: 16px;">📋</span>
            </div>
            <div class="metric-card-value" style="font-family: var(--font-mono); color: var(--text-main);">
              ${factoryEstimatedProducts} / ${factoryTotalProducts}
            </div>
            <div class="metric-card-hint">
              <span>${projects.length} Total Registered Projects</span>
            </div>
          </div>

        </div>

        <!-- Redesigned Production Projects Table (User Specified Columns) -->
        <div class="card-panel" style="margin-bottom: 0;">
          <div class="card-panel-header">
            <div>
              <div class="card-panel-title">Production Projects (${filtered.length})</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                Select any project to open all associated furniture products and individual Excel costing sheets.
              </div>
            </div>
            <span style="font-size: 12px; color: var(--text-muted);">
              Featured Sample: <strong>Ansar Changaramkulam</strong> (Excel Model)
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
                    <th style="min-width: 220px;">Project / Client</th>
                    <th style="min-width: 150px;">Products</th>
                    <th style="min-width: 170px;">Estimation Progress</th>
                    <th style="min-width: 140px; text-align: right;">Manufacturing Cost</th>
                    <th style="min-width: 140px; text-align: right;">Selling Value</th>
                    <th style="min-width: 140px; text-align: right;">Expected Profit</th>
                    <th style="min-width: 140px; text-align: center;">Action</th>
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
                      <tr style="cursor: pointer; transition: background-color 0.15s; ${isAnsar ? 'background: #F0FDF4;' : ''}" onclick="window.Zoosh.Views.Estimate.openProject('${p.id}')">
                        <!-- Column 1: Project / Client -->
                        <td>
                          <div style="font-weight: 600; color: var(--text-main); font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
                            ${p.name}
                            ${isAnsar ? `<span class="badge badge-success" style="font-size: 9.5px; padding: 1px 5px;">Excel Model</span>` : ''}
                          </div>
                          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                            Client: <strong>${c.name || p.clientName || 'Client'}</strong> &bull; ${p.location}
                          </div>
                          ${p.quotationRef ? `
                            <div style="font-size: 10.5px; color: var(--color-success-text); margin-top: 2px; font-family: var(--font-mono); font-weight: 600;">
                              📄 ${p.quotationRef.quotationNo}
                            </div>
                          ` : ''}
                        </td>

                        <!-- Column 2: Products -->
                        <td>
                          <div style="font-size: 12.5px; font-weight: 600; color: var(--text-main);">
                            ${s.totalProducts} Furniture Product${s.totalProducts !== 1 ? 's' : ''}
                          </div>
                          <div style="display: flex; gap: 5px; margin-top: 4px; align-items: center; flex-wrap: wrap;">
                            ${(s.items || []).slice(0, 4).map(it => `
                              <span style="display: inline-block; width: 22px; height: 22px; border-radius: 4px; border: 1px solid var(--border-color); background: #F8FAFC; overflow: hidden; vertical-align: middle;" title="${it.furniture.name}">
                                ${it.furniture.photo ? `<img src="${it.furniture.photo}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 11px; display: flex; align-items: center; justify-content: center; height: 100%;">🪑</span>`}
                              </span>
                            `).join('')}
                            ${s.totalProducts > 4 ? `<span style="font-size: 10.5px; color: var(--text-muted); font-weight: 600;">+${s.totalProducts - 4}</span>` : ''}
                          </div>
                        </td>

                        <!-- Column 3: Estimation Progress -->
                        <td>
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="progress-bar-container" style="flex: 1;">
                              <div class="progress-bar-fill ${isAllEstimated ? 'success' : ''}" style="width: ${s.totalProducts > 0 ? (s.estimatedCount / s.totalProducts) * 100 : 0}%;"></div>
                            </div>
                            <span style="font-size: 11.5px; font-weight: 700; font-family: var(--font-mono); color: var(--text-main);">
                              ${s.estimatedCount}/${s.totalProducts}
                            </span>
                          </div>
                          <div style="font-size: 10.5px; color: ${isAllEstimated ? 'var(--color-success)' : 'var(--text-muted)'}; margin-top: 3px; font-weight: 600;">
                            ${isAllEstimated ? '✓ All Costed' : (s.estimatedCount > 0 ? 'Costing in Progress' : 'Pending Costing')}
                          </div>
                        </td>

                        <!-- Column 4: Manufacturing Cost -->
                        <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; font-size: 13px; color: var(--text-main);">
                          ₹${s.totalMfgCost.toLocaleString('en-IN')}
                        </td>

                        <!-- Column 5: Selling Value -->
                        <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; font-size: 13px; color: var(--primary-blue);">
                          ₹${s.totalSellingValue.toLocaleString('en-IN')}
                        </td>

                        <!-- Column 6: Expected Profit -->
                        <td style="text-align: right;">
                          <div style="font-family: var(--font-mono); font-weight: 700; font-size: 12.5px; color: var(--color-success);">
                            +₹${s.totalProfit.toLocaleString('en-IN')}
                          </div>
                          <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 1px;">
                            ${s.overallProfitMargin}% margin
                          </div>
                        </td>

                        <!-- Column 7: Action -->
                        <td style="text-align: center;" onclick="event.stopPropagation()">
                          <button 
                            class="btn btn-primary btn-sm" 
                            style="padding: 4px 12px; font-size: 11.5px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"
                            onclick="window.Zoosh.Views.Estimate.openProject('${p.id}')"
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
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <!-- Workspace Navigation & Combined Project Command Bar -->
        <div class="card-panel" style="margin-bottom: 0; padding: 12px 18px; border: 1.5px solid var(--border-color); background: #FFFFFF; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Estimate.closeProject()" style="font-weight: 700; color: #0F172A; border: 1.5px solid #CBD5E1;">
                &larr; All Estimates
              </button>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge" style="font-family: var(--font-mono); font-weight: 800; font-size: 11.5px; padding: 3px 8px; background: #EFF6FF; border: 1.5px solid #BFDBFE; color: #1D4ED8;">
                  ${client.code || client.clientCode || 'PROJ'}
                </span>
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0F172A; letter-spacing: -0.01em;">
                  ${project.name}
                </h2>
                <span style="font-size: 13px; color: #475569; font-weight: 600;">&bull; ${project.location}</span>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge ${summary.estimatedCount >= summary.totalProducts ? 'badge-success' : 'badge-primary'}" style="font-size: 11.5px; font-weight: 700; padding: 4px 10px;">
                ${summary.estimatedCount} of ${summary.totalProducts} Costed
              </span>
              <button 
                class="btn btn-secondary btn-sm" 
                onclick="window.Zoosh.Views.Estimate.exportCurrentEstimateCsv()" 
                style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #0F172A; border: 1.5px solid #CBD5E1;"
                title="Export Current Estimate Sheet to CSV"
              >
                📥 Export CSV
              </button>
              <button 
                class="btn btn-secondary btn-sm" 
                onclick="window.Zoosh.Views.Estimate.printSheet()" 
                style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: #0F172A; border: 1.5px solid #CBD5E1;"
                title="Printable Specification View"
              >
                🖨️ Print Sheet
              </button>
              <button 
                class="btn btn-primary btn-sm" 
                onclick="window.Zoosh.Views.Estimate.saveCurrentEstimate()" 
                style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; padding: 6px 16px; box-shadow: 0 1px 4px rgba(37,99,235,0.35);"
              >
                💾 Save Estimate
              </button>
            </div>
          </div>

          <!-- Combined Project Estimate Summary Header Card -->
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1.5px solid #E2E8F0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #2563EB; letter-spacing: 0.06em; display: flex; align-items: center; gap: 6px;">
                <span>📈</span> COMBINED PROJECT ESTIMATE SUMMARY
              </div>
              <div style="font-size: 12px; color: #475569; font-weight: 600;">
                Aggregate totals of all <strong>${summary.totalProducts} furniture products</strong> under project "${project.name}".
              </div>
            </div>

            <!-- Summary Financial Metrics Ribbon -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
              <div style="background: #F8FAFC; border: 1.5px solid #CBD5E1; border-radius: 6px; padding: 8px 12px;">
                <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #475569;">Total Mfg Cost</div>
                <div style="font-size: 19px; font-weight: 800; color: #0F172A; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${summary.totalMfgCost.toLocaleString('en-IN')}
                </div>
                <div style="font-size: 11px; color: #64748B; font-weight: 600; margin-top: 1px;">Combined item costs</div>
              </div>

              <div style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 6px; padding: 8px 12px;">
                <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #1D4ED8;">Total Selling Value</div>
                <div style="font-size: 19px; font-weight: 800; color: #2563EB; font-family: var(--font-mono); margin-top: 2px;">
                  ₹${summary.totalSellingValue.toLocaleString('en-IN')}
                </div>
                <div style="font-size: 11px; color: #1D4ED8; font-weight: 600; margin-top: 1px;">Total Quotation Price</div>
              </div>

              <div style="background: #F0FDF4; border: 1.5px solid #BBF7D0; border-radius: 6px; padding: 8px 12px;">
                <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #15803D;">Combined Profit</div>
                <div style="font-size: 19px; font-weight: 800; color: #16A34A; font-family: var(--font-mono); margin-top: 2px;">
                  +₹${summary.totalProfit.toLocaleString('en-IN')}
                </div>
                <div style="font-size: 11px; color: #15803D; font-weight: 700; margin-top: 1px;">
                  ${summary.overallProfitMargin}% Overall Margin
                </div>
              </div>

              <div style="background: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 6px; padding: 8px 12px;">
                <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: #B45309;">Total Wood CFT</div>
                <div style="font-size: 19px; font-weight: 800; color: #B45309; font-family: var(--font-mono); margin-top: 2px;">
                  ${summary.totalWoodCft} CFT
                </div>
                <div style="font-size: 11px; color: #92400E; font-weight: 600; margin-top: 1px;">Timber requirement</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Product Selector Ribbon / Tabs -->
        <div class="card-panel" style="padding: 10px 14px; margin-bottom: 0; border: 1.5px solid var(--border-color); background: #FFFFFF; box-shadow: var(--shadow-sm);">
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #334155; letter-spacing: 0.05em; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>Project Products (${furnitureList.length} Items) &mdash; Select Product Sheet:</span>
            <span style="font-size: 11px; color: #2563EB; font-weight: 600;">Independent Excel calculation per product</span>
          </div>

          <div style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 2px;">
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
                    padding: 8px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.15s ease;
                    border: ${isSelected ? '2px solid #2563EB' : '1.5px solid #CBD5E1'};
                    background: ${isSelected ? '#EFF6FF' : '#FFFFFF'};
                    box-shadow: ${isSelected ? '0 2px 6px rgba(37,99,235,0.18)' : 'var(--shadow-sm)'};
                  "
                >
                  ${photoUrl ? `
                    <img src="${photoUrl}" alt="${furn.name}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 5px; border: 1.5px solid ${isSelected ? '#2563EB' : '#CBD5E1'}; flex-shrink: 0;" />
                  ` : `
                    <div style="width: 36px; height: 36px; border-radius: 5px; background: #F1F5F9; border: 1.5px solid #CBD5E1; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #475569; flex-shrink: 0;">
                      🪑
                    </div>
                  `}
                  <div>
                    <div style="font-size: 13.5px; font-weight: 800; color: ${isSelected ? '#1D4ED8' : '#0F172A'};">
                      ${furn.name || furn.furnitureName}
                    </div>
                    <div style="font-size: 11.5px; color: #475569; display: flex; align-items: center; gap: 6px; margin-top: 1px;">
                      <span>Qty: <strong style="color: #0F172A;">${furn.qty || 1}</strong></span>
                      <span>&bull;</span>
                      ${isSaved ? `
                        <span style="color: #16A34A; font-weight: 800;">✓ ₹${sellingVal.toLocaleString('en-IN')}</span>
                      ` : `
                        <span style="color: #D97706; font-weight: 700;">Draft</span>
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
        <div class="card-panel" style="border: 1.5px solid var(--border-color); border-top: 3px solid var(--primary-blue); margin-bottom: 0; background: #FFFFFF; box-shadow: var(--shadow-sm);">
          <div class="card-panel-body" style="padding: 12px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
              
              <!-- Left: Image & Product Identifiers -->
              <div style="display: flex; gap: 14px; align-items: center;">
                <!-- Product Image with quick change / preview -->
                <div style="position: relative; flex-shrink: 0;">
                  ${est.photo ? `
                    <img id="est-product-img" src="${est.photo}" alt="${est.productName}" style="width: 64px; height: 64px; object-fit: cover; border-radius: var(--radius-sm); border: 1.5px solid var(--border-color); box-shadow: var(--shadow-sm);" />
                  ` : `
                    <div id="est-product-img-placeholder" style="width: 64px; height: 64px; border-radius: var(--radius-sm); background: #f8fafc; border: 1.5px dashed var(--border-color); display: flex; flex-direction: column; align-items: center; justify-content: center; color: #475569; font-size: 20px;">
                      🪑
                      <span style="font-size: 9px; font-weight: 700; margin-top: 2px; color: var(--text-muted);">No Image</span>
                    </div>
                  `}
                  <label 
                    class="btn btn-secondary btn-sm" 
                    style="position: absolute; bottom: -5px; right: -5px; padding: 2px 5px; font-size: 9px; border-radius: 10px; cursor: pointer; font-weight: 700; border-color: #CBD5E1;"
                    title="Upload or change product photo"
                  >
                    📷 Change
                    <input type="file" accept="image/*" style="display: none;" onchange="window.Zoosh.Views.Estimate.handlePhotoUpload(this)" />
                  </label>
                </div>

                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge badge-primary" style="font-family: var(--font-mono); font-size: 11px; font-weight: 800; padding: 2px 7px;">
                      Product #${est.productNo || '1'}
                    </span>
                    <span style="font-size: 12.5px; color: #334155;">
                      Client: <strong style="color: #0F172A;">${est.clientName}</strong> &bull; Project: <strong style="color: #0F172A;">${est.projectName}</strong>
                    </span>
                  </div>

                  <div style="margin-top: 4px; display: flex; align-items: center; gap: 10px;">
                    <input 
                      type="text" 
                      class="form-input" 
                      value="${est.productName}" 
                      oninput="window.Zoosh.Views.Estimate.updateProductField('productName', this.value)"
                      style="font-size: 16px; font-weight: 800; color: #0F172A; padding: 5px 10px; border: 1.5px solid #CBD5E1; border-radius: var(--radius-sm); width: 260px;"
                      title="Click to edit product name"
                    />
                    <div style="display: flex; align-items: center; gap: 5px; font-size: 12px; color: #334155; font-weight: 600;">
                      <span>Date:</span>
                      <input 
                        type="date" 
                        class="form-input" 
                        value="${est.estimateDate || window.Zoosh.Config.CURRENT_DATE}" 
                        onchange="window.Zoosh.Views.Estimate.updateProductField('estimateDate', this.value)"
                        style="padding: 4px 8px; font-size: 12px; width: 130px; font-family: var(--font-mono); font-weight: 700; color: #0F172A;"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Right: Quantity & Unit Cost Summary (Excel J3:K3) -->
              <div style="display: flex; gap: 14px; align-items: center; background: #F1F5F9; padding: 8px 16px; border-radius: var(--radius-sm); border: 1.5px solid #CBD5E1;">
                <div>
                  <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 800; color: #334155; letter-spacing: 0.05em;">Product Quantity</div>
                  <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                    <input 
                      type="number" 
                      min="1" 
                      class="form-input" 
                      value="${est.productQty || 1}" 
                      oninput="window.Zoosh.Views.Estimate.updateProductQuantity(this.value)"
                      style="width: 65px; font-size: 15px; font-weight: 800; font-family: var(--font-mono); text-align: center; padding: 3px; border: 1.5px solid #2563EB; color: #0F172A;"
                    />
                    <span style="font-size: 12px; font-weight: 700; color: #334155;">Units</span>
                  </div>
                </div>

                <div style="height: 32px; width: 1.5px; background: #CBD5E1;"></div>

                <div>
                  <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 800; color: #334155; letter-spacing: 0.05em;">Cost / Item (Unit)</div>
                  <div style="font-size: 18px; font-weight: 800; color: #0F172A; font-family: var(--font-mono); margin-top: 2px;">
                    ₹${(totals.unitCost || 0).toLocaleString('en-IN')}
                  </div>
                </div>

                <div style="height: 32px; width: 1.5px; background: #CBD5E1;"></div>

                <div>
                  <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 800; color: #2563EB; letter-spacing: 0.05em;">Total Mfg Cost</div>
                  <div style="font-size: 18px; font-weight: 800; color: #2563EB; font-family: var(--font-mono); margin-top: 2px;">
                    ₹${(totals.totalCost || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ROW 1 GRAND TOTALS HIGHLIGHT BAR (Excel Recreation Row 1) -->
        <div class="card-panel" style="background: #0F172A; border: 1.5px solid #1E293B; border-top: 3px solid #2563EB; color: #FFFFFF; padding: 10px 14px; margin-bottom: 0; box-shadow: 0 4px 10px rgba(15,23,42,0.15);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #93C5FD; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> ROW 1 GRAND TOTALS HIGHLIGHT BAR &mdash; RECONSTRUCTED FROM EXCEL
            </div>
            <div style="font-size: 11.5px; color: #94A3B8; font-weight: 600;">
              Multiplied across batch quantity (${est.productQty || 1} units)
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(12, 1fr); gap: 6px;">
            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">W. CFT</div>
              <div id="hl-metric-woodCft" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ${highlightMetrics.woodCft}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">C. Lab</div>
              <div id="hl-metric-cLab" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.cLab.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">P. Mat.</div>
              <div id="hl-metric-pMat" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.pMat.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">P. Lab.</div>
              <div id="hl-metric-pLab" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.pLab.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">Packing</div>
              <div id="hl-metric-packing" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.packing.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">F. Expense</div>
              <div id="hl-metric-fExpense" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.fExpense.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">Fabric</div>
              <div id="hl-metric-fabric" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.fabric.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">U. Lab.</div>
              <div id="hl-metric-uLab" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.uLab.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #1E293B; border: 1px solid #334155; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #94A3B8; font-weight: 700;">Foam</div>
              <div id="hl-metric-foam" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #FFFFFF; margin-top: 1px;">
                ₹${highlightMetrics.foam.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(22, 163, 74, 0.25); border: 1.5px solid #22C55E; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #86EFAC; font-weight: 800;">25% Profit</div>
              <div id="hl-metric-profit25" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #4ADE80; margin-top: 1px;">
                ₹${highlightMetrics.profit25.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: rgba(37, 99, 235, 0.25); border: 1.5px solid #60A5FA; padding: 5px 6px; border-radius: 5px; text-align: center;">
              <div style="font-size: 9.5px; text-transform: uppercase; color: #BFDBFE; font-weight: 800;">30% Profit</div>
              <div id="hl-metric-profit30" style="font-size: 13.5px; font-weight: 800; font-family: var(--font-mono); color: #93C5FD; margin-top: 1px;">
                ₹${highlightMetrics.profit30.toLocaleString('en-IN')}
              </div>
            </div>

            <div style="background: #2563EB; border: 1.5px solid #3B82F6; color: #FFFFFF; padding: 5px 6px; border-radius: 5px; text-align: center; box-shadow: 0 2px 6px rgba(37,99,235,0.4);">
              <div style="font-size: 9.5px; text-transform: uppercase; font-weight: 800; opacity: 0.95;">T. Qtn Amt.</div>
              <div id="hl-metric-totalSelling" style="font-size: 14px; font-weight: 900; font-family: var(--font-mono); margin-top: 1px;">
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

            <div class="card-panel-header" style="background: #F1F5F9; padding: 10px 16px; border-bottom: 2px solid #CBD5E1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div>
                <div class="card-panel-title" style="font-size: 14.5px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 6px;">
                  <span>📋</span> Manufacturing Cost Categories
                </div>
                <div style="font-size: 11.5px; color: #334155; margin-top: 1px; font-weight: 600;">
                  Edit category names &bull; Rate &times; Qty calculation &bull; Direct amount entries.
                </div>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <button 
                  type="button" 
                  class="btn btn-secondary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.resetStandardCategories()"
                  style="padding: 4px 8px; font-size: 11px; font-weight: 700; color: #334155; border: 1.5px solid #CBD5E1;"
                  title="Reset to 16 original standard Excel categories"
                >
                  ↺ Reset 16 Categories
                </button>
                <button 
                  type="button" 
                  class="btn btn-primary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.addCostRow()"
                  style="padding: 5px 12px; font-size: 12px; font-weight: 800; display: flex; align-items: center; gap: 5px; box-shadow: 0 1px 3px rgba(37,99,235,0.35);"
                >
                  <span>➕</span> Add Particular / Category
                </button>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table class="table" style="margin: 0; width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: #E2E8F0; font-size: 11.5px; border-bottom: 2px solid #CBD5E1;">
                    <th style="width: 36px; text-align: center; padding: 8px 6px; font-weight: 800; color: #0F172A;">#</th>
                    <th style="padding: 8px 10px; font-weight: 800; color: #0F172A;">Particulars / Category</th>
                    <th style="width: 85px; text-align: right; padding: 8px 8px; font-weight: 800; color: #0F172A;">Rate (₹)</th>
                    <th style="width: 65px; text-align: right; padding: 8px 8px; font-weight: 800; color: #0F172A;">Qty</th>
                    <th style="width: 95px; text-align: right; padding: 8px 8px; font-weight: 800; color: #0F172A;">Amount (₹)</th>
                    <th style="width: 32px; padding: 4px; text-align: center;"></th>
                  </tr>
                </thead>
                <tbody id="excel-cost-rows-tbody">
                  ${this.CATEGORY_SECTIONS.map(section => {
                    const sectionRows = costRows.filter(r => this.getCategoryKey(r) === section.key);
                    if (sectionRows.length === 0) return '';
                    const sectionSubtotal = section.key === 'wood' 
                      ? (totals.catSubtotals && totals.catSubtotals.wood || 0)
                      : sectionRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);

                    return `
                      <tr class="cost-section-header" style="background: #E2E8F0; border-top: 2px solid #CBD5E1; border-bottom: 1.5px solid #CBD5E1;">
                        <td colspan="2" style="padding: 6px 10px; font-size: 11.5px; font-weight: 800; color: #0F172A; letter-spacing: 0.02em;">
                          <span style="font-size: 12px; margin-right: 4px;">${section.icon}</span> ${section.title}
                        </td>
                        <td colspan="2" style="padding: 6px 8px; font-size: 11px; color: #334155; font-weight: 700; text-align: right;">
                          ${section.key === 'wood' ? 'Active Wood Cost:' : 'Category Subtotal:'}
                        </td>
                        <td id="subtotal-${section.key}" style="padding: 6px 8px; text-align: right; font-size: 12.5px; font-weight: 800; font-family: var(--font-mono); color: #0F172A;">
                          ₹${Math.round(sectionSubtotal).toLocaleString('en-IN')}
                        </td>
                        <td></td>
                      </tr>

                      ${sectionRows.map(row => {
                        const idx = costRows.indexOf(row);
                        const rowNameEsc = (row.name || '').replace(/"/g, '&quot;');
                        const isWoodRow = section.key === 'wood';
                        const isSelectedWood = est.selectedWood === row.id;

                        return `
                          <tr style="border-bottom: 1px solid #E2E8F0; ${isSelectedWood ? 'background: #EFF6FF;' : ''}">
                            <td style="text-align: center; color: #334155; font-size: 11.5px; font-weight: 700; padding: 6px; font-family: var(--font-mono);">
                              ${idx + 1}
                            </td>
                            <td style="padding: 4px 8px;">
                              <div style="display: flex; align-items: center; gap: 6px;">
                                <input 
                                  type="text" 
                                  id="cost-name-${idx}"
                                  list="cost-category-suggestions"
                                  class="form-input" 
                                  value="${rowNameEsc}" 
                                  placeholder="Enter particular / category..."
                                  oninput="window.Zoosh.Views.Estimate.updateCostRowName(${idx}, this.value)"
                                  onchange="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'name', this.value)"
                                  style="padding: 4px 8px; font-size: 13px; font-weight: 700; flex: 1; border: 1.5px solid #CBD5E1; border-radius: 4px; background: #FFFFFF; color: #0F172A;"
                                />
                                ${isWoodRow ? `
                                  ${isSelectedWood ? `
                                    <span style="font-size: 10px; font-weight: 800; background: #2563EB; color: #FFFFFF; padding: 2px 7px; border-radius: 4px; white-space: nowrap;">★ Active Quote</span>
                                  ` : `
                                    <button 
                                      type="button" 
                                      class="btn btn-secondary btn-sm" 
                                      onclick="window.Zoosh.Views.Estimate.selectWoodVariant('${row.id}')"
                                      style="font-size: 10.5px; padding: 2px 6px; white-space: nowrap; font-weight: 700; color: #1D4ED8; border: 1.5px solid #BFDBFE;"
                                      title="Set this wood species as active quote"
                                    >Set Active</button>
                                  `}
                                ` : ''}
                              </div>
                            </td>
                            <td style="padding: 4px 6px; text-align: right;">
                              <input 
                                type="number" 
                                step="any"
                                id="cost-rate-${idx}"
                                class="form-input" 
                                value="${row.rate ? row.rate : ''}" 
                                placeholder="0"
                                onfocus="this.select()"
                                oninput="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'rate', this.value)"
                                style="padding: 4px 6px; font-size: 13px; font-weight: 700; font-family: var(--font-mono); text-align: right; width: 80px; border: 1.5px solid #CBD5E1; color: #0F172A;"
                                title="${isWoodRow ? 'Rate per CFT' : 'Rate'}"
                              />
                            </td>
                            <td style="padding: 4px 6px; text-align: right;">
                              <input 
                                type="number" 
                                step="any"
                                id="cost-qty-${idx}"
                                class="form-input" 
                                value="${row.qty !== undefined && row.qty !== 0 ? row.qty : ''}" 
                                placeholder="0"
                                onfocus="this.select()"
                                oninput="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'qty', this.value)"
                                style="padding: 4px 6px; font-size: 13px; font-weight: 700; font-family: var(--font-mono); text-align: right; width: 60px; border: 1.5px solid #CBD5E1; color: #0F172A;"
                                title="${isWoodRow ? 'Wood CFT' : 'Quantity'}"
                              />
                            </td>
                            <td style="padding: 4px 6px; text-align: right;">
                              <input 
                                type="number" 
                                step="any"
                                id="cost-amount-${idx}"
                                class="form-input" 
                                value="${row.amount ? row.amount : ''}" 
                                placeholder="0"
                                onfocus="this.select()"
                                oninput="window.Zoosh.Views.Estimate.updateCostRow(${idx}, 'amount', this.value, true)"
                                style="padding: 4px 6px; font-size: 13px; font-weight: 800; font-family: var(--font-mono); text-align: right; width: 90px; border: 1.5px solid ${row.isDirect ? '#F59E0B' : '#CBD5E1'}; background: ${row.isDirect ? '#FEF3C7' : '#FFFFFF'}; color: ${row.isDirect ? '#92400E' : '#0F172A'};"
                                title="${row.isDirect ? 'Direct amount entry' : 'Calculated: Rate × Qty'}"
                              />
                            </td>
                            <td style="text-align: center; padding: 4px;">
                              <button 
                                type="button" 
                                class="btn btn-secondary btn-sm" 
                                onclick="window.Zoosh.Views.Estimate.deleteCostRow(${idx})"
                                style="padding: 2px 5px; font-size: 13px; font-weight: 700; color: #EF4444; border: 1px solid transparent; background: transparent; cursor: pointer; border-radius: 4px; line-height: 1;"
                                onmouseover="this.style.background='#FEE2E2'; this.style.borderColor='#FCA5A5'"
                                onmouseout="this.style.background='transparent'; this.style.borderColor='transparent'"
                                title="Delete row"
                              >&times;</button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
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
                  <tr style="background: #f1f5f9; border-top: 1.5px solid #cbd5e1; font-weight: 700;">
                    <td colspan="4" style="text-align: right; padding: 8px 10px; font-size: 11.5px; text-transform: uppercase; color: #475569;">
                      Other Manufacturing Costs (Non-Wood Subtotal):
                    </td>
                    <td id="cost-subtotal-other-cost" style="text-align: right; padding: 8px; font-size: 13px; font-family: var(--font-mono); color: #1e293b; font-weight: 800;">
                      ₹${(totals.otherCost || 0).toLocaleString('en-IN')}
                    </td>
                    <td></td>
                  </tr>
                  <tr style="background: #f8fafc; border-top: 2px solid #cbd5e1; font-weight: 800;">
                    <td colspan="4" style="text-align: right; padding: 10px; font-size: 12.5px; text-transform: uppercase;">
                      Active Total Cost / Item (${totals.selectedWoodName || 'Active Wood'} + Other Costs):
                    </td>
                    <td id="cost-total-unit-cost" style="text-align: right; padding: 10px; font-size: 15px; font-family: var(--font-mono); color: #059669;">
                      ₹${(totals.unitCost || 0).toLocaleString('en-IN')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <!-- MULTI-WOOD COMPARATIVE PRICING PANEL -->
            <div style="background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 14px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
                <div>
                  <div style="font-size: 13px; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 6px;">
                    <span>🪵</span> Multi-Wood Actual Cost Comparison (Wood Cost + Other Cost)
                  </div>
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                    Wood Cut List: <strong>${totals.unitWoodCft || 0} CFT</strong> &bull; Non-Wood Other Costs: <strong>₹${(totals.otherCost || 0).toLocaleString('en-IN')}</strong> &bull; Qty: <strong>${est.productQty || 1} Units</strong>
                  </div>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                ${['mahogany', 'wood_ash', 'teak'].map(wKey => {
                  const wData = (totals.multiWoodComparison && totals.multiWoodComparison[wKey]) || {};
                  const isSelected = est.selectedWood === wKey;
                  return `
                    <div style="border: ${isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1'}; background: ${isSelected ? '#eff6ff' : '#ffffff'}; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; justify-content: space-between;">
                      <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                          <span style="font-size: 13.5px; font-weight: 800; color: #0f172a;">${wData.name || wKey}</span>
                          ${isSelected ? `<span style="font-size: 9.5px; font-weight: 700; background: #2563eb; color: #ffffff; padding: 2px 6px; border-radius: 4px;">Active Quote</span>` : ''}
                        </div>
                        
                        <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">
                          Rate: <strong>₹${(wData.rate || 0).toLocaleString('en-IN')}/CFT</strong>
                        </div>

                        <div style="font-size: 11.5px; display: flex; flex-direction: column; gap: 3px; padding: 6px 8px; background: ${isSelected ? '#ffffff' : '#f8fafc'}; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 8px;">
                          <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b;">Wood Cost:</span>
                            <strong id="mw-wood-cost-${wKey}" style="font-family: var(--font-mono); color: #854d0e;">₹${(wData.woodCost || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between;">
                            <span style="color: #64748b;">Other Mfg Cost:</span>
                            <strong id="mw-other-cost-${wKey}" style="font-family: var(--font-mono); color: #475569;">+₹${(totals.otherCost || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style="height: 1px; background: #e2e8f0; margin: 2px 0;"></div>
                          <div style="display: flex; justify-content: space-between; font-weight: 800;">
                            <span style="color: #0f172a;">Actual Unit Cost:</span>
                            <span id="mw-unit-cost-${wKey}" style="font-family: var(--font-mono); color: #059669;">₹${(wData.unitCost || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #64748b;">
                            <span>Total (${est.productQty || 1} units):</span>
                            <span id="mw-total-cost-${wKey}" style="font-family: var(--font-mono);">₹${(wData.totalCost || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>

                        <div style="font-size: 11px; display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px;">
                          <div style="display: flex; justify-content: space-between; color: #1e40af;">
                            <span>Quotation (25% Profit):</span>
                            <strong id="mw-sell25-${wKey}" style="font-family: var(--font-mono);">₹${(wData.sell25 || 0).toLocaleString('en-IN')}</strong>
                          </div>
                          <div style="display: flex; justify-content: space-between; color: #15803d;">
                            <span>Quotation (30% Profit):</span>
                            <strong id="mw-sell30-${wKey}" style="font-family: var(--font-mono);">₹${(wData.sell30 || 0).toLocaleString('en-IN')}</strong>
                          </div>
                        </div>
                      </div>

                      <button 
                        type="button" 
                        class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-sm"
                        onclick="window.Zoosh.Views.Estimate.selectWoodVariant('${wKey}')"
                        style="width: 100%; font-size: 11px; font-weight: 700; padding: 4px 6px;"
                      >
                        ${isSelected ? '✓ Selected for Quote' : 'Set as Active Quote &rarr;'}
                      </button>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN: WOOD ESTIMATION CUT LIST & CFT CALCULATOR -->
          <div style="display: flex; flex-direction: column; gap: 16px;">
            <div class="card-panel" style="padding: 0; overflow: hidden; border: 1.5px solid var(--border-color); background: #FFFFFF; box-shadow: var(--shadow-sm);">
              <div class="card-panel-header" style="background: #F8FAFC; padding: 12px 16px; border-bottom: 2px solid #CBD5E1; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div class="card-panel-title" style="font-size: 14px; font-weight: 800; color: #0F172A; display: flex; align-items: center; gap: 6px;">
                    <span>🪵</span> Wood Estimation &mdash; CFT Cut List
                  </div>
                  <div style="font-size: 11.5px; color: #1E40AF; margin-top: 3px; background: #EFF6FF; padding: 2px 8px; border-radius: 4px; display: inline-block; font-weight: 700; border: 1px solid #BFDBFE;">
                    Formula: CFT = (Length &times; Width &times; Height &times; Qty) / 144
                  </div>
                </div>
                <button 
                  type="button" 
                  class="btn btn-secondary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.addWoodRow()"
                  style="padding: 5px 12px; font-size: 12px; font-weight: 800; border: 1.5px solid #CBD5E1; color: #0F172A; background: #FFFFFF;"
                >
                  + Add Piece
                </button>
              </div>

              <!-- Mixed Units Banner -->
              <div style="background: #F1F5F9; padding: 6px 14px; font-size: 11px; color: #334155; border-bottom: 1.5px solid #CBD5E1; display: flex; justify-content: space-between; font-weight: 600;">
                <span>Units: <strong style="color: #0F172A;">L in Feet (ft)</strong> &bull; <strong style="color: #0F172A;">W in Inches (in)</strong> &bull; <strong style="color: #0F172A;">Thickness/H in Inches (in)</strong></span>
                <span>Divisor: <strong style="color: #0F172A;">144</strong></span>
              </div>

              <div style="overflow-x: auto;">
                <table class="table" style="margin: 0; width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: #E2E8F0; font-size: 11.5px; border-bottom: 2px solid #CBD5E1;">
                      <th style="padding: 8px 10px; font-weight: 800; color: #0F172A;">Part / Description</th>
                      <th style="width: 60px; text-align: right; padding: 8px 4px; font-weight: 800; color: #0F172A;">L (ft)</th>
                      <th style="width: 60px; text-align: right; padding: 8px 4px; font-weight: 800; color: #0F172A;">W (in)</th>
                      <th style="width: 60px; text-align: right; padding: 8px 4px; font-weight: 800; color: #0F172A;">H (in)</th>
                      <th style="width: 50px; text-align: right; padding: 8px 4px; font-weight: 800; color: #0F172A;">Qty</th>
                      <th style="width: 76px; text-align: right; padding: 8px 8px; font-weight: 800; color: #0F172A;">CFT</th>
                      <th style="width: 30px; padding: 4px;"></th>
                    </tr>
                  </thead>
                  <tbody id="excel-wood-rows-tbody">
                    ${woodRows.map((w, idx) => `
                      <tr style="border-bottom: 1px solid #E2E8F0;">
                        <td style="padding: 5px 8px;">
                          <input 
                            type="text" 
                            class="form-input" 
                            value="${w.part || `Part ${idx + 1}`}" 
                            onchange="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'part', this.value)"
                            style="padding: 3px 7px; font-size: 12.5px; width: 100%; font-weight: 700; color: #0F172A; border: 1.5px solid #CBD5E1; border-radius: 4px;"
                          />
                        </td>
                        <td style="padding: 5px 2px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            class="form-input" 
                            value="${w.length ? w.length : ''}" 
                            placeholder="0"
                            onfocus="this.select()"
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'length', this.value)"
                            style="padding: 3px 5px; font-size: 12.5px; font-family: var(--font-mono); font-weight: 700; text-align: right; width: 56px; color: #0F172A; border: 1.5px solid #CBD5E1;"
                          />
                        </td>
                        <td style="padding: 5px 2px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            class="form-input" 
                            value="${w.width ? w.width : ''}" 
                            placeholder="0"
                            onfocus="this.select()"
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'width', this.value)"
                            style="padding: 3px 5px; font-size: 12.5px; font-family: var(--font-mono); font-weight: 700; text-align: right; width: 56px; color: #0F172A; border: 1.5px solid #CBD5E1;"
                          />
                        </td>
                        <td style="padding: 5px 2px; text-align: right;">
                          <input 
                            type="number" 
                            step="any"
                            class="form-input" 
                            value="${w.thickness ? w.thickness : ''}" 
                            placeholder="0"
                            onfocus="this.select()"
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'thickness', this.value)"
                            style="padding: 3px 5px; font-size: 12.5px; font-family: var(--font-mono); font-weight: 700; text-align: right; width: 56px; color: #0F172A; border: 1.5px solid #CBD5E1;"
                          />
                        </td>
                        <td style="padding: 5px 2px; text-align: right;">
                          <input 
                            type="number" 
                            min="1"
                            class="form-input" 
                            value="${w.qty !== undefined && w.qty !== 0 ? w.qty : ''}" 
                            placeholder="0"
                            onfocus="this.select()"
                            oninput="window.Zoosh.Views.Estimate.updateWoodRow(${idx}, 'qty', this.value)"
                            style="padding: 3px 5px; font-size: 12.5px; font-family: var(--font-mono); font-weight: 700; text-align: right; width: 46px; color: #0F172A; border: 1.5px solid #CBD5E1;"
                          />
                        </td>
                        <td id="wood-cft-${idx}" style="padding: 5px 8px; text-align: right; font-family: var(--font-mono); font-weight: 800; font-size: 13px; color: #0F172A;">
                          ${w.cft || 0}
                        </td>
                        <td style="text-align: center; padding: 2px;">
                          <button 
                            class="btn btn-secondary btn-sm" 
                            onclick="window.Zoosh.Views.Estimate.deleteWoodRow(${idx})"
                            style="padding: 2px 5px; font-size: 11px; color: #DC2626; border: 1px solid #FECACA; background: #FEF2F2;"
                            title="Delete cut piece"
                          >&times;</button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                  <tfoot>
                    <tr style="background: #F8FAFC; border-top: 2px solid #CBD5E1; font-weight: 800;">
                      <td colspan="5" style="text-align: right; padding: 9px 10px; font-size: 12px; text-transform: uppercase; color: #0F172A;">
                        Total CFT (1 Unit):
                      </td>
                      <td id="wood-total-cft-unit" style="text-align: right; padding: 9px 8px; font-size: 15px; font-family: var(--font-mono); font-weight: 900; color: #0F172A;">
                        ${totals.unitWoodCft || 0}
                      </td>
                      <td></td>
                    </tr>
                    <tr style="background: #EFF6FF; border-top: 1.5px solid #BFDBFE; font-weight: 800;">
                      <td colspan="5" style="text-align: right; padding: 9px 10px; font-size: 12px; text-transform: uppercase; color: #1E40AF;">
                        Total CFT for Full Quantity (${est.productQty || 1} Units):
                      </td>
                      <td id="wood-total-cft-qty" style="text-align: right; padding: 9px 8px; font-size: 15px; font-family: var(--font-mono); font-weight: 900; color: #1D4ED8;">
                        ${totals.totalWoodCft || 0}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Quick Sync Button to Mahogany / Wood Ash / Teak -->
              <div style="padding: 10px 14px; background: #F8FAFC; border-top: 1.5px solid #CBD5E1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <span style="font-size: 11.5px; color: #0F172A; font-weight: 800;">Apply ${totals.unitWoodCft || 0} CFT to Wood:</span>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  <button 
                    type="button" 
                    class="btn btn-secondary btn-sm" 
                    onclick="window.Zoosh.Views.Estimate.applyCftToCostCategory('mahogany')"
                    style="font-size: 11.5px; padding: 3px 10px; font-weight: 700; ${est.selectedWood === 'mahogany' ? 'background: #2563EB; color: #FFFFFF; border-color: #2563EB;' : 'border: 1.5px solid #CBD5E1; color: #0F172A; background: #FFFFFF;'}"
                  >
                    ${est.selectedWood === 'mahogany' ? '✓ ' : '&rarr; '}Mahogany (${totals.unitWoodCft || 0} CFT)
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-secondary btn-sm" 
                    onclick="window.Zoosh.Views.Estimate.applyCftToCostCategory('wood_ash')"
                    style="font-size: 11.5px; padding: 3px 10px; font-weight: 700; ${est.selectedWood === 'wood_ash' ? 'background: #2563EB; color: #FFFFFF; border-color: #2563EB;' : 'border: 1.5px solid #CBD5E1; color: #0F172A; background: #FFFFFF;'}"
                  >
                    ${est.selectedWood === 'wood_ash' ? '✓ ' : '&rarr; '}Ash Wood
                  </button>
                  <button 
                    type="button" 
                    class="btn btn-secondary btn-sm" 
                    onclick="window.Zoosh.Views.Estimate.applyCftToCostCategory('teak')"
                    style="font-size: 11.5px; padding: 3px 10px; font-weight: 700; ${est.selectedWood === 'teak' ? 'background: #2563EB; color: #FFFFFF; border-color: #2563EB;' : 'border: 1.5px solid #CBD5E1; color: #0F172A; background: #FFFFFF;'}"
                  >
                    ${est.selectedWood === 'teak' ? '✓ ' : '&rarr; '}Teak
                  </button>
                </div>
              </div>
            </div>

            <!-- GRAND TOTALS, PROFIT TIERS & PRICING CARDS -->
            <div class="card-panel" style="padding: 16px; border: 1.5px solid var(--border-color); background: #FFFFFF; margin-bottom: 0; box-shadow: var(--shadow-sm);">
              <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: #0F172A; letter-spacing: 0.05em; margin-bottom: 12px; display: flex; justify-content: space-between;">
                <span>💰 GRAND TOTALS &amp; PROFIT CALCULATION</span>
                <span style="color: #334155;">Quantity: <strong style="color: #0F172A;">${est.productQty || 1} Units</strong></span>
              </div>

              <!-- Profit Tiers Selection -->
              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                <!-- 25% Profit -->
                <div 
                  onclick="window.Zoosh.Views.Estimate.selectProfitTier('25')"
                  style="
                    border: 2px solid ${est.selectedProfitTier === '25' ? '#16A34A' : '#CBD5E1'};
                    background: ${est.selectedProfitTier === '25' ? '#F0FDF4' : '#FFFFFF'};
                    padding: 10px;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: all 0.15s;
                  "
                >
                  <div style="font-size: 11.5px; font-weight: 800; color: ${est.selectedProfitTier === '25' ? '#15803D' : '#0F172A'}; display: flex; justify-content: space-between;">
                    <span>25% Profit</span>
                    ${est.selectedProfitTier === '25' ? '<span style="font-weight: 900; color: #16A34A;">✓ Active</span>' : ''}
                  </div>
                  <div id="gt-profit25-amount" style="font-size: 15px; font-weight: 900; font-family: var(--font-mono); color: #0F172A; margin-top: 3px;">
                    +₹${(totals.profit25 || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-profit25-total" style="font-size: 11px; font-weight: 600; color: #334155; margin-top: 2px;">
                    Total: ₹${((totals.totalCost || 0) + (totals.profit25 || 0)).toLocaleString('en-IN')}
                  </div>
                </div>

                <!-- 30% Profit -->
                <div 
                  onclick="window.Zoosh.Views.Estimate.selectProfitTier('30')"
                  style="
                    border: 2px solid ${est.selectedProfitTier === '30' ? '#2563EB' : '#CBD5E1'};
                    background: ${est.selectedProfitTier === '30' ? '#EFF6FF' : '#FFFFFF'};
                    padding: 10px;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: all 0.15s;
                  "
                >
                  <div style="font-size: 11.5px; font-weight: 800; color: ${est.selectedProfitTier === '30' ? '#1D4ED8' : '#0F172A'}; display: flex; justify-content: space-between;">
                    <span>30% Profit</span>
                    ${est.selectedProfitTier === '30' ? '<span style="font-weight: 900; color: #2563EB;">✓ Active</span>' : ''}
                  </div>
                  <div id="gt-profit30-amount" style="font-size: 15px; font-weight: 900; font-family: var(--font-mono); color: #0F172A; margin-top: 3px;">
                    +₹${(totals.profit30 || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-profit30-total" style="font-size: 11px; font-weight: 600; color: #334155; margin-top: 2px;">
                    Total: ₹${((totals.totalCost || 0) + (totals.profit30 || 0)).toLocaleString('en-IN')}
                  </div>
                </div>

                <!-- Custom Editable Profit % -->
                <div 
                  onclick="window.Zoosh.Views.Estimate.selectProfitTier('custom')"
                  style="
                    border: 2px solid ${est.selectedProfitTier === 'custom' ? '#7C3AED' : '#CBD5E1'};
                    background: ${est.selectedProfitTier === 'custom' ? '#FAF5FF' : '#FFFFFF'};
                    padding: 10px;
                    border-radius: var(--radius-sm);
                    cursor: pointer;
                    transition: all 0.15s;
                  "
                >
                  <div style="font-size: 11.5px; font-weight: 800; color: ${est.selectedProfitTier === 'custom' ? '#6D28D9' : '#0F172A'}; display: flex; justify-content: space-between;">
                    <span>Custom Margin</span>
                    ${est.selectedProfitTier === 'custom' ? '<span style="font-weight: 900; color: #7C3AED;">✓ Active</span>' : ''}
                  </div>
                  <div style="display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                    <input 
                      type="number" 
                      min="0" 
                      max="200" 
                      value="${est.customProfitPercent || 25}" 
                      oninput="window.Zoosh.Views.Estimate.updateCustomProfitPercent(this.value)"
                      style="width: 48px; padding: 2px 4px; font-size: 13px; font-weight: 800; font-family: var(--font-mono); text-align: center; border: 1.5px solid #CBD5E1; border-radius: 4px; color: #0F172A;"
                    />
                    <span style="font-size: 12px; font-weight: 800; color: #0F172A;">%</span>
                    <span id="gt-custom-profit-amount" style="font-size: 12.5px; font-family: var(--font-mono); font-weight: 800; margin-left: 2px; color: #16A34A;">
                      +₹${(totals.customProfitAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Final Pricing Highlight -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #F8FAFC; padding: 14px 18px; border-radius: var(--radius-sm); border: 2px solid #CBD5E1;">
                <div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #334155; letter-spacing: 0.05em;">Selling Price Per Unit</div>
                  <div id="gt-unit-selling-price" style="font-size: 22px; font-weight: 900; font-family: var(--font-mono); color: #0F172A; margin-top: 2px;">
                    ₹${(totals.unitSellingPrice || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-unit-mfg-cost" style="font-size: 12px; color: #475569; font-weight: 700; margin-top: 2px;">Mfg: ₹${(totals.unitCost || 0).toLocaleString('en-IN')} / unit</div>
                </div>

                <div>
                  <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #15803D; letter-spacing: 0.05em;">TOTAL QUOTATION AMOUNT</div>
                  <div id="gt-total-selling-price" style="font-size: 26px; font-weight: 900; font-family: var(--font-mono); color: #16A34A; margin-top: 2px;">
                    ₹${(totals.totalSellingPrice || 0).toLocaleString('en-IN')}
                  </div>
                  <div id="gt-active-profit-amount" style="font-size: 12px; color: #15803D; font-weight: 700; margin-top: 2px;">
                    Net Profit: +₹${(totals.activeProfitAmount || totals.profit25 || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              <!-- Footer Actions -->
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 14px; padding-top: 12px; border-top: 1.5px solid #CBD5E1;">
                <button 
                  type="button" 
                  class="btn btn-secondary btn-sm" 
                  onclick="window.Zoosh.Views.Estimate.resetToSampleExcelModel()"
                  style="font-size: 12px; padding: 6px 12px; font-weight: 700; color: #334155; border: 1.5px solid #CBD5E1; background: #FFFFFF;"
                  title="Prefill with exact Sitout Chair numbers from uploaded Excel file"
                >
                  🔄 Reset to Excel Sample
                </button>

                <button 
                  type="button" 
                  class="btn btn-primary" 
                  onclick="window.Zoosh.Views.Estimate.saveCurrentEstimate()"
                  style="padding: 10px 24px; font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px; border-radius: var(--radius-sm); box-shadow: 0 2px 6px rgba(37,99,235,0.35);"
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

    // 2. Category Subtotals & Non-Wood Other Costs
    let otherCost = 0;
    const catSubtotals = {
      wood: 0,
      carpentry: 0,
      polish: 0,
      upholstery: 0,
      overheads: 0
    };

    (est.costRows || []).forEach(row => {
      const catKey = this.getCategoryKey(row);
      const isWood = catKey === 'wood';

      if (row.isDirect) {
        row.amount = parseFloat(row.amount) || 0;
      } else if (!isWood) {
        const r = parseFloat(row.rate) || 0;
        const q = row.qty !== undefined ? parseFloat(row.qty) : 1;
        row.amount = Math.round(r * q * 100) / 100;
      }

      if (!isWood) {
        otherCost += row.amount;
        if (catSubtotals[catKey] !== undefined) {
          catSubtotals[catKey] += row.amount;
        }
      }
    });

    otherCost = Math.round(otherCost);

    // 3. Multi-Wood Comparative Cost Calculations
    const woodVariants = [
      { id: 'mahogany', name: 'Mahogany', defaultRate: 2500 },
      { id: 'wood_ash', name: 'Ash Wood', defaultRate: 3200 },
      { id: 'teak', name: 'Teak', defaultRate: 4500 }
    ];

    const selectedWood = est.selectedWood || 'mahogany';
    const multiWoodComparison = {};

    woodVariants.forEach(wv => {
      const row = (est.costRows || []).find(r => r.id === wv.id || (r.name && r.name.toLowerCase().includes(wv.name.toLowerCase())));
      const rate = row ? (parseFloat(row.rate) || wv.defaultRate) : wv.defaultRate;
      const woodCost = Math.round(unitWoodCft * rate);
      const unitMfgCost = woodCost + otherCost;
      const totalMfgCost = unitMfgCost * qty;
      const profit25 = Math.round(totalMfgCost * 0.25);
      const profit30 = Math.round(totalMfgCost * 0.30);
      const sell25 = totalMfgCost + profit25;
      const sell30 = totalMfgCost + profit30;

      multiWoodComparison[wv.id] = {
        id: wv.id,
        name: wv.name,
        rate: rate,
        cft: unitWoodCft,
        unitCft: unitWoodCft,
        woodCost: woodCost,
        otherCost: otherCost,
        actualCost: unitMfgCost,
        unitCost: unitMfgCost,
        totalCost: totalMfgCost,
        profit25: profit25,
        profit30: profit30,
        sell25: sell25,
        sell30: sell30,
        price25: Math.round(sell25 / qty),
        price30: Math.round(sell30 / qty),
        unitSell25: Math.round(sell25 / qty),
        unitSell30: Math.round(sell30 / qty)
      };

      if (row) {
        row.rate = rate;
        if (row.id === selectedWood) {
          row.qty = unitWoodCft;
          row.amount = woodCost;
          catSubtotals.wood = woodCost;
        } else {
          row.qty = 0;
          row.amount = 0;
        }
      }
    });

    const activeWoodData = multiWoodComparison[selectedWood] || multiWoodComparison['mahogany'];
    let unitCost = activeWoodData ? activeWoodData.unitCost : otherCost;
    const totalCost = unitCost * qty;

    // 4. Profit Tiers & Total Selling Price
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

    const woodNameMap = { mahogany: 'Mahogany', wood_ash: 'Ash Wood', teak: 'Teak' };

    est.totals = {
      unitWoodCft: unitWoodCft,
      totalWoodCft: totalWoodCft,
      otherCost: otherCost,
      catSubtotals: catSubtotals,
      selectedWood: selectedWood,
      selectedWoodName: woodNameMap[selectedWood] || selectedWood,
      multiWoodComparison: multiWoodComparison,
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
      row.amount = val === '' ? 0 : (parseFloat(val) || 0);
      row.isDirect = true;
    } else if (field === 'rate' || field === 'qty') {
      row[field] = val === '' ? 0 : (parseFloat(val) || 0);
      row.isDirect = false;
      const r = parseFloat(row.rate) || 0;
      const q = row.qty !== undefined ? parseFloat(row.qty) : 1;
      row.amount = Math.round(r * q * 100) / 100;
      const amtInput = document.getElementById(`cost-amount-${idx}`);
      if (amtInput && !amtInput.matches(':focus')) {
        amtInput.value = row.amount ? row.amount : '';
        amtInput.style.background = '#ffffff';
      }
    } else if (field === 'name') {
      row.name = val;
      return;
    } else if (field === 'category') {
      row.category = val;
      this.recalculateTempEstimateTotals();
      this.render(document.getElementById('view-container'));
      return;
    } else {
      row[field] = val;
    }

    this.recalculateTempEstimateTotals();
    this.refreshCalculatedDOMElements();
  },

  addCostRow(suggestedName = '', rate = 0, qty = 1, amount = 0, isDirect = false, category = 'Carpentry & Structural') {
    if (!this.tempEstimate) return;
    this.tempEstimate.costRows = this.tempEstimate.costRows || [];
    const newIdx = this.tempEstimate.costRows.length;
    this.tempEstimate.costRows.push({
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: suggestedName || '',
      category: category || 'Carpentry & Structural',
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
    if (!confirm('Reset cost categories to standard categorized Excel rows? Any custom changes or rows will be reset.')) return;

    if (window.Zoosh.State && window.Zoosh.State.STANDARD_COST_CATEGORIES) {
      this.tempEstimate.costRows = window.Zoosh.State.STANDARD_COST_CATEGORIES.map(cat => ({
        id: cat.id,
        name: cat.name,
        category: cat.category,
        rate: cat.defaultRate,
        qty: cat.defaultQty,
        amount: cat.defaultAmount,
        isDirect: cat.isDirect
      }));
    } else {
      this.tempEstimate.costRows = [
        { id: 'mahogany', name: 'Mahogany', category: 'Wood / Timber', rate: 2500, qty: 0, amount: 0, isDirect: false },
        { id: 'wood_ash', name: 'Wood Ash', category: 'Wood / Timber', rate: 3200, qty: 0, amount: 0, isDirect: false },
        { id: 'teak', name: 'Teak', category: 'Wood / Timber', rate: 4500, qty: 0, amount: 0, isDirect: false },
        { id: 'carpenter', name: 'Carpenter', category: 'Carpentry & Structural', rate: 3000, qty: 0, amount: 0, isDirect: false },
        { id: 'plywood', name: 'Plywood', category: 'Carpentry & Structural', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'metal_work', name: 'Metal Work', category: 'Carpentry & Structural', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'polish_material', name: 'Polish Material', category: 'Finishing & Polish', rate: 1500, qty: 0, amount: 0, isDirect: false },
        { id: 'polish_labour', name: 'Polish Labour', category: 'Finishing & Polish', rate: 2400, qty: 0, amount: 0, isDirect: false },
        { id: 'foam', name: 'Foam', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'fabric', name: 'Fabric', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'upholstery_labour', name: 'Upholstery Labour', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'rattan', name: 'Rattan', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'rope', name: 'Rope', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'packing', name: 'Packing', category: 'Factory & Overheads', rate: 250, qty: 1, amount: 250, isDirect: true },
        { id: 'factory_expense', name: 'Factory Expense', category: 'Factory & Overheads', rate: 500, qty: 1, amount: 500, isDirect: true },
        { id: 'consumables', name: 'Consumables', category: 'Factory & Overheads', rate: 30, qty: 1, amount: 30, isDirect: true },
        { id: 'ar_marble', name: 'Ar. Marble', category: 'Factory & Overheads', rate: 0, qty: 0, amount: 0, isDirect: false }
      ];
    }

    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));
    if (window.Zoosh.Toast) {
      window.Zoosh.Toast.show('Reset to standard categorized rows', 'success');
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
    setTxt('cost-subtotal-other-cost', `₹${(totals.otherCost || 0).toLocaleString('en-IN')}`);

    if (totals.catSubtotals) {
      setTxt('subtotal-wood', `₹${(totals.catSubtotals.wood || 0).toLocaleString('en-IN')}`);
      setTxt('subtotal-carpentry', `₹${(totals.catSubtotals.carpentry || 0).toLocaleString('en-IN')}`);
      setTxt('subtotal-polish', `₹${(totals.catSubtotals.polish || 0).toLocaleString('en-IN')}`);
      setTxt('subtotal-upholstery', `₹${(totals.catSubtotals.upholstery || 0).toLocaleString('en-IN')}`);
      setTxt('subtotal-overheads', `₹${(totals.catSubtotals.overheads || 0).toLocaleString('en-IN')}`);
    }

    if (totals.multiWoodComparison) {
      ['mahogany', 'wood_ash', 'teak'].forEach(wKey => {
        const w = totals.multiWoodComparison[wKey];
        if (w) {
          setTxt(`mw-wood-cost-${wKey}`, `₹${(w.woodCost || 0).toLocaleString('en-IN')}`);
          setTxt(`mw-other-cost-${wKey}`, `+₹${(totals.otherCost || 0).toLocaleString('en-IN')}`);
          setTxt(`mw-unit-cost-${wKey}`, `₹${(w.unitCost || 0).toLocaleString('en-IN')}`);
          setTxt(`mw-total-cost-${wKey}`, `₹${(w.totalCost || 0).toLocaleString('en-IN')}`);
          setTxt(`mw-sell25-${wKey}`, `₹${(w.sell25 || 0).toLocaleString('en-IN')}`);
          setTxt(`mw-sell30-${wKey}`, `₹${(w.sell30 || 0).toLocaleString('en-IN')}`);
        }
      });
    }

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
    if (!this.tempEstimate || !this.tempEstimate.woodRows || !this.tempEstimate.woodRows[idx]) return;
    const w = this.tempEstimate.woodRows[idx];
    if (field === 'part') {
      w.part = val;
    } else {
      w[field] = val === '' ? 0 : (parseFloat(val) || 0);
    }

    // Formula: (Length(ft) * Width(in) * Thickness(in) * Quantity) / 144
    const l = parseFloat(w.length) || 0;
    const width = parseFloat(w.width) || 0;
    const th = parseFloat(w.thickness) || 0;
    const wQty = parseFloat(w.qty) || 1;
    const cft = (l * width * th * wQty) / 144;
    w.cft = Math.round(cft * 10000) / 10000;

    const cftCell = document.getElementById(`wood-cft-${idx}`);
    if (cftCell) cftCell.textContent = w.cft || 0;

    this.recalculateTempEstimateTotals();
    const totalUnit = document.getElementById('wood-total-cft-unit');
    if (totalUnit) totalUnit.textContent = this.tempEstimate.totals.unitWoodCft || 0;
    const totalQty = document.getElementById('wood-total-cft-qty');
    if (totalQty) totalQty.textContent = this.tempEstimate.totals.totalWoodCft || 0;

    this.refreshCalculatedDOMElements();
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

    const cft = this.tempEstimate.totals ? (this.tempEstimate.totals.unitWoodCft || 0) : 0;
    this.tempEstimate.selectedWood = row.id;

    // Set CFT to the selected wood
    row.qty = cft;
    row.isDirect = false;
    row.amount = Math.round((parseFloat(row.rate) || 0) * cft);

    // Reset other wood rows
    (this.tempEstimate.costRows || []).forEach(r => {
      const catKey = this.getCategoryKey(r);
      if (catKey === 'wood' && r.id !== row.id) {
        r.qty = 0;
        r.amount = 0;
      }
    });

    this.recalculateTempEstimateTotals();
    this.render(document.getElementById('view-container'));

    if (window.Zoosh.Toast) {
      window.Zoosh.Toast.show(`Applied ${cft} CFT to ${row.name}`, 'success');
    }
  },

  selectWoodVariant(woodId) {
    this.applyCftToCostCategory(woodId);
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
    this.tempEstimate.selectedWood = 'mahogany';

    this.tempEstimate.costRows = [
      { id: 'mahogany', name: 'Mahogany', category: 'Wood / Timber', rate: 2500, qty: 1.408, amount: 3520, isDirect: false },
      { id: 'wood_ash', name: 'Wood Ash', category: 'Wood / Timber', rate: 3200, qty: 0, amount: 0, isDirect: false },
      { id: 'teak', name: 'Teak', category: 'Wood / Timber', rate: 4500, qty: 0, amount: 0, isDirect: false },
      { id: 'carpenter', name: 'Carpenter', category: 'Carpentry & Structural', rate: 3000, qty: 1, amount: 3000, isDirect: false },
      { id: 'plywood', name: 'Plywood', category: 'Carpentry & Structural', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'metal_work', name: 'Metal Work', category: 'Carpentry & Structural', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'polish_material', name: 'Polish Material', category: 'Finishing & Polish', rate: 1500, qty: 1, amount: 1500, isDirect: false },
      { id: 'polish_labour', name: 'Polish Labour', category: 'Finishing & Polish', rate: 2400, qty: 1, amount: 2400, isDirect: false },
      { id: 'foam', name: 'Foam', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'fabric', name: 'Fabric', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'upholstery_labour', name: 'Upholstery Labour', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'rattan', name: 'Rattan', category: 'Upholstery & Soft Furnishing', rate: 470, qty: 2, amount: 940, isDirect: false },
      { id: 'rope', name: 'Rope', category: 'Upholstery & Soft Furnishing', rate: 0, qty: 0, amount: 0, isDirect: false },
      { id: 'packing', name: 'Packing', category: 'Factory & Overheads', rate: 250, qty: 1, amount: 250, isDirect: true },
      { id: 'factory_expense', name: 'Factory Expense', category: 'Factory & Overheads', rate: 500, qty: 1, amount: 500, isDirect: true },
      { id: 'consumables', name: 'Consumables', category: 'Factory & Overheads', rate: 30, qty: 1, amount: 30, isDirect: true },
      { id: 'ar_marble', name: 'Ar. Marble', category: 'Factory & Overheads', rate: 0, qty: 0, amount: 0, isDirect: false }
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
    csv += `Product,"${est.productName}",Qty,${est.productQty}\n`;
    csv += `Selected Wood,"${(est.selectedWood || 'mahogany').toUpperCase()}"\n\n`;

    csv += `MANUFACTURING COST CATEGORIES\n`;
    csv += `#,Category,Particulars,Rate,Qty,Amount\n`;
    (est.costRows || []).forEach((r, idx) => {
      csv += `${idx + 1},"${r.category || this.getCategoryKey(r)}","${r.name}",${r.rate || 0},${r.qty || 0},${r.amount || 0}\n`;
    });
    csv += `,"Other Manufacturing Costs (Carpentry, Polish, Upholstery, Overheads)",,,,${est.totals.otherCost || 0}\n`;
    csv += `,"Cost/item (Unit Mfg Cost - ${est.selectedWood || 'Mahogany'})",,,,${est.totals.unitCost}\n`;
    csv += `,"Total Mfg Cost for ${est.productQty} units",,,,${est.totals.totalCost}\n\n`;

    csv += `MULTI-WOOD COMPARATIVE PRICING (WOOD COST + OTHER COST)\n`;
    csv += `Wood Species,Rate/CFT,Unit CFT,Wood Cost,Other Cost,Actual Unit Mfg Cost,Quotation @ 25%,Quotation @ 30%\n`;
    const comparison = (est.totals && est.totals.multiWoodComparison) ? Object.values(est.totals.multiWoodComparison) : [];
    comparison.forEach(item => {
      csv += `"${item.name}",${item.rate},${item.unitCft},${item.woodCost},${item.otherCost},${item.actualCost},${item.price25},${item.price30}\n`;
    });
    csv += `\n`;

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
  },

  exportAllEstimatesCsv() {
    const state = window.Zoosh.State.getState();
    const projects = state.projects || [];
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));

    let csv = "ZOOSH FACTORY ESTIMATES - PROJECT SUMMARY ROLLUP\n";
    csv += "Project,Client,Location,Total Products,Costed Products,Total Mfg Cost (INR),Total Selling Value (INR),Combined Profit (INR),Margin %\n";

    projects.forEach(p => {
      const summary = window.Zoosh.State.getProjectEstimatesSummary(p.id);
      const client = clientsMap.get(p.clientId) || {};
      csv += `"${p.name}","${client.name || p.clientName || ''}","${p.location || ''}",${summary.totalProducts},${summary.estimatedCount},${summary.totalMfgCost},${summary.totalSellingValue},${summary.totalProfit},${summary.overallProfitMargin}%\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Factory_Estimates_Summary_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};
