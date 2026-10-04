/**
 * Projects & Client/SRL View
 * 
 * Hierarchy:
 * CLIENT / SRL (SRL is client/customer short-form identifier)
 *   ↓
 * PROJECT
 *   ↓
 * FURNITURE ITEMS (NO SRL numbers on furniture items!)
 *   ↓
 * PRODUCTION PROCESSES
 *   ↓
 * EMPLOYEE
 *   ↓
 * SCHEDULE
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Projects = {
  activeTab: 'projects', // 'projects' | 'clients'
  activeProjectId: null,
  activeFurnitureId: null,
  searchQuery: '',
  statusFilter: 'ALL',

  render(container) {
    if (this.activeFurnitureId) {
      this.renderFurnitureDetailView(container, this.activeFurnitureId);
    } else if (this.activeProjectId) {
      this.renderProjectDetail(container, this.activeProjectId);
    } else {
      if (window.Zoosh.App) {
        window.Zoosh.App.updateMobileHeader(this.activeTab === 'clients' ? 'Clients / SRL' : 'Projects', false);
      }
      this.renderMainView(container);
    }
  },

  renderMainView(container) {
    const auth = window.Zoosh.Auth;
    const canCreate = auth ? auth.canCreate() : true;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-header-title">Clients &amp; Projects</h2>
          <div class="view-header-subtitle">Client SRL identifiers, project commitments, and production orders</div>
        </div>
        <div style="display: flex; gap: 10px;">
          ${canCreate ? `
            <button class="btn btn-secondary" onclick="window.Zoosh.AddClientModal.open()">
              <span>+</span> New Client / SRL
            </button>
            <button class="btn btn-primary" onclick="window.Zoosh.Views.Projects.openAddModal()">
              <span>+</span> New Project
            </button>
          ` : `
            <span class="badge badge-upholstery" style="align-self: center;">
              👁️ Visitor Read-Only Mode
            </span>
          `}
        </div>
      </div>

      <!-- Segmented Tab Navigation -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; border-bottom: 1px solid var(--border-light); padding-bottom: 10px;">
        <button 
          class="btn ${this.activeTab === 'projects' ? 'btn-primary' : 'btn-secondary'} btn-sm"
          onclick="window.Zoosh.Views.Projects.switchTab('projects')"
        >
          📁 Factory Projects
        </button>
        <button 
          class="btn ${this.activeTab === 'clients' ? 'btn-primary' : 'btn-secondary'} btn-sm"
          onclick="window.Zoosh.Views.Projects.switchTab('clients')"
        >
          🏷️ Clients / SRL Directory
        </button>
      </div>

      ${this.activeTab === 'projects' ? this.renderProjectsTab() : this.renderClientsTab()}
    `;
  },

  switchTab(tab) {
    this.activeTab = tab;
    this.render(document.getElementById('view-container'));
  },

  // ==========================================
  // TAB 1: PROJECTS LIST
  // ==========================================

  renderProjectsTab() {
    const state = window.Zoosh.State.getState();
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));
    let projects = state.projects || [];

    // Filter by search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      projects = projects.filter(p => {
        const client = clientsMap.get(p.clientId);
        const srlMatch = client && String(client.srl).includes(q);
        const clientMatch = (client && client.name.toLowerCase().includes(q)) || (p.clientName && p.clientName.toLowerCase().includes(q));
        const projMatch = p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q);
        return srlMatch || clientMatch || projMatch;
      });
    }

    // Filter by status
    if (this.statusFilter !== 'ALL') {
      projects = projects.filter(p => p.deadlineStatus === this.statusFilter);
    }

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <input type="text" class="search-input-box" placeholder="🔍 Search projects, clients, or SRL..." 
            value="${this.searchQuery}" 
            oninput="window.Zoosh.Views.Projects.searchQuery = this.value; window.Zoosh.Views.Projects.render(document.getElementById('view-container'))" />

          <select class="filter-select" onchange="window.Zoosh.Views.Projects.statusFilter = this.value; window.Zoosh.Views.Projects.render(document.getElementById('view-container'))">
            <option value="ALL" ${this.statusFilter === 'ALL' ? 'selected' : ''}>All Statuses</option>
            <option value="ON_SCHEDULE" ${this.statusFilter === 'ON_SCHEDULE' ? 'selected' : ''}>On Schedule</option>
            <option value="AT_RISK" ${this.statusFilter === 'AT_RISK' ? 'selected' : ''}>At Risk</option>
            <option value="DELAYED" ${this.statusFilter === 'DELAYED' ? 'selected' : ''}>Delayed</option>
          </select>
        </div>
        <div style="font-size: 13px; color: var(--text-muted);">
          Showing <strong>${projects.length}</strong> project${projects.length !== 1 ? 's' : ''}
        </div>
      </div>

      ${projects.length === 0 ? `
        <div style="background: #ffffff; padding: 50px; text-align: center; border-radius: var(--radius-md); border: 1px solid var(--border-light); color: var(--text-muted);">
          No projects found.
          ${window.Zoosh.Auth && window.Zoosh.Auth.canCreate() ? `
            <div style="margin-top: 14px;">
              <button class="btn btn-primary btn-sm" onclick="window.Zoosh.Views.Projects.openAddModal()">
                + Create First Project
              </button>
            </div>
          ` : ''}
        </div>
      ` : `
        <!-- Mobile Project Cards (<768px) -->
        <div class="mobile-only">
          ${projects.map(p => this.renderMobileProjectCard(p, clientsMap)).join('')}
        </div>

        <!-- Desktop Project Grid (>768px) -->
        <div class="desktop-only" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px;">
          ${projects.map(p => this.renderProjectCard(p, clientsMap)).join('')}
        </div>
      `}
    `;
  },

  renderProjectCard(project, clientsMap) {
    const calendar = window.Zoosh.Calendar;
    const client = clientsMap.get(project.clientId);
    const clientSrl = client ? client.srl : (project.clientSrl || '—');
    const clientName = client ? client.name : (project.clientName || 'Client');

    let badgeClass = 'badge-on-schedule';
    let statusLabel = 'ON TRACK';
    if (project.isDelivered || project.status === 'DELIVERED') {
      badgeClass = 'badge-primary';
      statusLabel = 'DELIVERED';
    } else if (project.deadlineStatus === 'AT_RISK') {
      badgeClass = 'badge-at-risk';
      statusLabel = `AT RISK (${project.daysBuffer || 0}d buffer)`;
    } else if (project.deadlineStatus === 'DELAYED') {
      badgeClass = 'badge-delayed';
      statusLabel = `DELAYED (+${project.daysOverdue || 0}d)`;
    } else if (project.completionPercent === 100) {
      badgeClass = 'badge-on-schedule';
      statusLabel = 'COMPLETED';
    }

    return `
      <div class="card-panel" style="cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;" onclick="window.Zoosh.Views.Projects.openDetail('${project.id}')">
        <div class="card-panel-header" style="padding: 14px 18px;">
          <div>
            <div style="font-weight: 800; font-size: 16px; color: var(--text-main);">${project.name}</div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <span class="badge badge-primary" style="font-size: 11px; padding: 2px 7px;">
                SRL ${clientSrl}
              </span>
              <span style="font-size: 12.5px; color: var(--text-muted);">
                ${clientName} &bull; ${project.location}
              </span>
            </div>
          </div>
          <span class="badge ${badgeClass}" style="font-size: 10px;">${statusLabel}</span>
        </div>

        <div class="card-panel-body" style="padding: 14px 18px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px;">
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase; font-weight: 700;">Deadline</span>
              <strong style="color: var(--text-main); font-family: var(--font-mono);">${calendar.formatDisplayDate(project.deliveryDeadline, false, true)}</strong>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); display: block; font-size: 10px; text-transform: uppercase; font-weight: 700;">Projected Finish</span>
              <strong style="color: ${project.deadlineStatus === 'DELAYED' ? '#dc2626' : 'var(--text-main)'}; font-family: var(--font-mono);">
                ${calendar.formatDisplayDate(project.projectedFinishDate, false, true)}
              </strong>
            </div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 5px;">
              <span style="color: var(--text-muted);">Items Completed</span>
              <span style="font-weight: 600; color: var(--text-secondary);">${project.completedSrlCount || 0} / ${project.totalSrlCount || 0} Items (${project.completionPercent || 0}%)</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${project.completionPercent || 0}%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderMobileProjectCard(project, clientsMap) {
    const calendar = window.Zoosh.Calendar;
    const client = clientsMap.get(project.clientId);
    const clientSrl = client ? client.srl : (project.clientSrl || '—');
    const clientName = client ? client.name : (project.clientName || 'Client');

    let badgeClass = 'badge-on-schedule';
    let statusLabel = 'ON TRACK';
    if (project.isDelivered || project.status === 'DELIVERED') {
      badgeClass = 'badge-primary';
      statusLabel = 'DELIVERED';
    } else if (project.deadlineStatus === 'AT_RISK') {
      badgeClass = 'badge-at-risk';
      statusLabel = `AT RISK (${project.daysBuffer || 0}d buffer)`;
    } else if (project.deadlineStatus === 'DELAYED') {
      badgeClass = 'badge-delayed';
      statusLabel = `DELAYED (+${project.daysOverdue || 0}d)`;
    } else if (project.completionPercent === 100) {
      badgeClass = 'badge-on-schedule';
      statusLabel = 'COMPLETED';
    }

    return `
      <div class="mobile-project-card" onclick="window.Zoosh.Views.Projects.openDetail('${project.id}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <div style="font-weight: 800; font-size: 15px; color: var(--text-main);">${project.name}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              <strong style="color: var(--primary-color);">SRL ${clientSrl}</strong> &bull; ${clientName} &bull; ${project.location}
            </div>
          </div>
          <span class="badge ${badgeClass}" style="font-size: 10px;">${statusLabel}</span>
        </div>

        <div style="margin: 12px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
            <span style="color: var(--text-muted);">Production Progress</span>
            <span style="font-weight: 700; color: var(--text-secondary);">${project.completedSrlCount || 0}/${project.totalSrlCount || 0} items (${project.completionPercent || 0}%)</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${project.completionPercent || 0}%;"></div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--text-muted);">
          <span>Deadline: <strong style="color: #b91c1c; font-family: var(--font-mono);">${calendar.formatDisplayDate(project.deliveryDeadline, false, true)}</strong></span>
          <span>Finish: <strong style="color: var(--text-main); font-family: var(--font-mono);">${calendar.formatDisplayDate(project.projectedFinishDate, false, true)}</strong></span>
        </div>
      </div>
    `;
  },

  // ==========================================
  // TAB 2: CLIENTS / SRL DIRECTORY
  // SRL belongs to the client/customer
  // ==========================================

  renderClientsTab() {
    const state = window.Zoosh.State.getState();
    const clients = state.clients || [];
    const projects = state.projects || [];
    const auth = window.Zoosh.Auth;
    const canEdit = auth ? auth.canEdit() : true;

    if (clients.length === 0) {
      return `
        <div style="background: #ffffff; padding: 50px; text-align: center; border-radius: var(--radius-md); border: 1px solid var(--border-light); color: var(--text-muted);">
          No clients registered yet.
          ${canEdit ? `
            <div style="margin-top: 14px;">
              <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddClientModal.open()">
                + New Client / SRL
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">Client Directory &bull; Customer SRL Identifiers</div>
          ${canEdit ? `
            <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddClientModal.open()">
              + New Client / SRL
            </button>
          ` : ''}
        </div>
        <div class="card-panel-body" style="padding: 0;">
          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 110px;">Client SRL</th>
                  <th>Client / Customer</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th>Active Projects</th>
                  <th>Notes</th>
                  ${canEdit ? '<th style="text-align: right;">Actions</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${clients.map(c => {
                  const clientProjs = projects.filter(p => p.clientId === c.id);
                  return `
                    <tr>
                      <td>
                        <span class="badge badge-primary" style="font-size: 13px; padding: 4px 10px; font-family: var(--font-mono); font-weight: 700;">
                          SRL ${c.srl}
                        </span>
                      </td>
                      <td style="font-weight: 700; color: var(--text-main); font-size: 14px;">
                        ${c.name}
                      </td>
                      <td style="color: var(--text-secondary);">${c.location || '—'}</td>
                      <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-secondary);">${c.phone || '—'}</td>
                      <td>
                        ${clientProjs.length > 0 ? `
                          <div style="display: flex; flex-direction: column; gap: 4px;">
                            ${clientProjs.map(p => `
                              <a href="javascript:void(0)" onclick="window.Zoosh.Views.Projects.openDetail('${p.id}')" style="color: var(--primary-color); font-weight: 600; text-decoration: underline; font-size: 12.5px;">
                                📁 ${p.name}
                              </a>
                            `).join('')}
                          </div>
                        ` : `<span style="color: var(--text-muted); font-size: 12px;">No projects yet</span>`}
                      </td>
                      <td style="font-size: 12px; color: var(--text-muted); max-width: 220px;">${c.notes || '—'}</td>
                      ${canEdit ? `
                        <td style="text-align: right;">
                          <div style="display: inline-flex; gap: 6px;">
                            <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.Zoosh.Views.Projects.openAddModal('${c.id}')" title="Create Project for this Client">
                              + Project
                            </button>
                            <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.Zoosh.Views.Projects.openEditClientModal('${c.id}')">
                              Edit
                            </button>
                            <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px; color: #dc2626;" onclick="window.Zoosh.Views.Projects.confirmDeleteClient('${c.id}', '${c.name}')">
                              Delete
                            </button>
                          </div>
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // ==========================================
  // PROJECT DETAIL VIEW
  // ==========================================

  openDetail(projectId) {
    this.activeProjectId = projectId;
    this.activeFurnitureId = null;
    this.render(document.getElementById('view-container'));
  },

  closeDetail() {
    this.activeProjectId = null;
    this.activeFurnitureId = null;
    this.render(document.getElementById('view-container'));
  },

  renderProjectDetail(container, projectId) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const project = (state.projects || []).find(p => p.id === projectId);

    if (!project) {
      this.closeDetail();
      return;
    }

    const client = (state.clients || []).find(c => c.id === project.clientId);
    const clientSrl = client ? client.srl : (project.clientSrl || '—');
    const clientName = client ? client.name : (project.clientName || 'Client');

    if (window.Zoosh.App) {
      window.Zoosh.App.updateMobileHeader(project.name, true, () => window.Zoosh.Views.Projects.closeDetail());
    }

    const projectFurniture = (state.furniture || state.srls || []).filter(s => s.projectId === projectId);
    const processesMap = new Map((state.processes || []).map(p => [p.id, p]));
    const auth = window.Zoosh.Auth;
    const canEdit = auth ? auth.canEdit() : true;

    let badgeClass = 'badge-on-schedule';
    let statusLabel = 'ON TRACK';
    if (project.isDelivered || project.status === 'DELIVERED') {
      badgeClass = 'badge-primary';
      statusLabel = 'DELIVERED';
    } else if (project.deadlineStatus === 'AT_RISK') {
      badgeClass = 'badge-at-risk';
      statusLabel = `AT RISK (${project.daysBuffer || 0} days buffer)`;
    } else if (project.deadlineStatus === 'DELAYED') {
      badgeClass = 'badge-delayed';
      statusLabel = `DELAYED (+${project.daysOverdue || 0} days)`;
    } else if (project.completionPercent === 100) {
      badgeClass = 'badge-on-schedule';
      statusLabel = 'COMPLETED';
    }

    container.innerHTML = `
      <div style="margin-bottom: 20px;" class="desktop-only">
        <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.closeDetail()">
          &larr; Back to All Projects
        </button>
      </div>

      <!-- Project Detail Header -->
      <div class="card-panel" style="margin-bottom: 24px;">
        <div class="card-panel-body" style="padding: 20px;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span class="badge badge-primary" style="font-size: 12px; padding: 3px 8px; font-weight: 700;">
                  SRL ${clientSrl}
                </span>
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted);">
                  Project Specifications
                </span>
              </div>
              <h2 style="font-size: 22px; font-weight: 800; color: var(--text-main); margin-top: 4px; letter-spacing: -0.5px;">
                ${project.name}
              </h2>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                Client: <strong>${clientName}</strong> &bull; Location: <strong>${project.location}</strong>
              </div>
              ${project.notes ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">"${project.notes}"</div>` : ''}
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
              <span class="badge ${badgeClass}" style="font-size: 11px; padding: 4px 10px;">${statusLabel}</span>
              ${canEdit ? `
                <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                  ${project.isDelivered || project.status === 'DELIVERED' ? `
                    <button class="btn btn-secondary btn-sm" style="color: #059669; font-weight: 600;" onclick="window.Zoosh.State.markProjectDelivered('${project.id}', false); window.Zoosh.Views.Projects.openDetail('${project.id}')">
                      ↩️ Mark Undelivered
                    </button>
                  ` : `
                    <button class="btn btn-secondary btn-sm" style="color: #059669; font-weight: 600;" onclick="window.Zoosh.State.markProjectDelivered('${project.id}', true); window.Zoosh.Views.Projects.openDetail('${project.id}')">
                      📦 Mark as Delivered
                    </button>
                  `}
                  <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.openEditProjectModal('${project.id}')">
                    Edit Deadline
                  </button>
                  <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddFurnitureWizard.open('${project.id}')">
                    + Add Furniture
                  </button>
                </div>
              ` : `
                <span class="badge badge-upholstery">Read-Only</span>
              `}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-light);">
            <div>
              <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Confirmed Date</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-top: 2px;">
                ${calendar.formatDisplayDate(project.confirmedDate, true, true)}
              </div>
            </div>
            <div>
              <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Fixed Delivery Deadline</div>
              <div style="font-size: 14px; font-weight: 700; color: #b91c1c; margin-top: 2px;">
                ${calendar.formatDisplayDate(project.deliveryDeadline, true, true)}
              </div>
            </div>
            <div>
              <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Projected Finish</div>
              <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-top: 2px;">
                ${calendar.formatDisplayDate(project.projectedFinishDate, true, true)}
              </div>
            </div>
            <div>
              <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Progress</div>
              <div style="font-size: 14px; font-weight: 700; color: #059669; margin-top: 2px;">
                ${project.completedSrlCount || 0} / ${project.totalSrlCount || 0} Items (${project.completionPercent || 0}%)
              </div>
              <div class="progress-bar-container" style="margin-top: 6px;">
                <div class="progress-bar-fill" style="width: ${project.completionPercent || 0}%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Furniture Items List (NO SRL NUMBERS ASSIGNED TO FURNITURE!) -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">Project Furniture Items (${projectFurniture.length} Items)</div>
          ${canEdit ? `
            <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddFurnitureWizard.open('${project.id}')">
              + Add Furniture
            </button>
          ` : ''}
        </div>
        <div class="card-panel-body" style="padding: 0;">
          ${projectFurniture.length === 0 ? `
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
              No furniture items registered under this project yet.
              ${canEdit ? `
                <div style="margin-top: 12px;">
                  <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddFurnitureWizard.open('${project.id}')">
                    + Add First Furniture Item
                  </button>
                </div>
              ` : ''}
            </div>
          ` : `
            <!-- Mobile Furniture Cards (<768px) -->
            <div class="mobile-only" style="padding: 12px 14px;">
              ${projectFurniture.map(item => {
                const itemProcs = (item.processIds || []).map(id => processesMap.get(id)).filter(Boolean);
                itemProcs.sort((a, b) => a.sequence - b.sequence);
                return `
                  <div class="mobile-task-card" style="margin-bottom: 10px; cursor: pointer;" onclick="window.Zoosh.Views.Projects.openFurnitureDetail('${item.id}')">
                    <div class="mobile-task-card-header">
                      <span style="font-weight: 800; font-size: 14px; color: var(--text-main);">${item.name || item.furnitureName}</span>
                      <span class="badge ${item.status === 'COMPLETED' ? 'badge-on-schedule' : 'badge-upholstery'}" style="font-size: 10px;">
                        ● ${item.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div class="flow-breadcrumbs" style="margin: 8px 0;">
                      ${itemProcs.map((p, idx) => `
                        <span class="badge badge-${p.department.toLowerCase()}" style="font-size: 10px;">${p.department}</span>
                        ${idx < itemProcs.length - 1 ? '<span class="flow-crumb-arrow">&rarr;</span>' : ''}
                      `).join('')}
                    </div>
                    <div class="mobile-task-footer">
                      <span style="color: var(--text-muted); font-size: 11px;">Expected Finish</span>
                      <span style="font-weight: 700; color: var(--text-main); font-family: var(--font-mono); font-size: 12px;">
                        ${calendar.formatDisplayDate(item.expectedFinishDate, false, true)}
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Desktop Furniture Table (>768px) -->
            <div class="desktop-only data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Furniture Item</th>
                    <th>Process Sequence</th>
                    <th>Expected Finish</th>
                    <th>Status</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${projectFurniture.map(item => {
                    const itemProcs = (item.processIds || []).map(id => processesMap.get(id)).filter(Boolean);
                    itemProcs.sort((a, b) => a.sequence - b.sequence);

                    return `
                      <tr style="cursor: pointer;" onclick="window.Zoosh.Views.Projects.openFurnitureDetail('${item.id}')">
                        <td style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">
                          ${item.name || item.furnitureName}
                        </td>
                        <td>
                          <div class="flow-breadcrumbs">
                            ${itemProcs.map((p, idx) => `
                              <span class="badge badge-${p.department.toLowerCase()}">${p.department}</span>
                              ${idx < itemProcs.length - 1 ? '<span class="flow-crumb-arrow">&rarr;</span>' : ''}
                            `).join('')}
                          </div>
                        </td>
                        <td style="font-family: var(--font-mono); font-weight: 600;">
                          ${calendar.formatDisplayDate(item.expectedFinishDate, false, true)}
                        </td>
                        <td>
                          <span class="badge ${item.status === 'COMPLETED' ? 'badge-on-schedule' : (item.status === 'IN_PROGRESS' ? 'badge-upholstery' : '')}">
                            ${item.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style="text-align: right;" onclick="event.stopPropagation();">
                          <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.openFurnitureDetail('${item.id}')">
                            Inspect &rarr;
                          </button>
                          ${canEdit ? `
                            <button class="btn btn-secondary btn-sm" style="color: #dc2626; margin-left: 6px;" onclick="window.Zoosh.Views.Projects.confirmDeleteFurniture('${item.id}', '${item.name || item.furnitureName}')">
                              Delete
                            </button>
                          ` : ''}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  },

  // ==========================================
  // FURNITURE DETAIL VIEW (Sequential Flow)
  // ==========================================

  openFurnitureDetail(furnitureId) {
    this.activeFurnitureId = furnitureId;
    this.render(document.getElementById('view-container'));
  },

  closeFurnitureDetail() {
    this.activeFurnitureId = null;
    this.render(document.getElementById('view-container'));
  },

  // Backward compatibility alias
  openSrlMobileDetail(id) {
    this.openFurnitureDetail(id);
  },
  closeSrlDetail() {
    this.closeFurnitureDetail();
  },
  renderSrlDetailView(container, id) {
    return this.renderFurnitureDetailView(container, id);
  },

  renderFurnitureDetailView(container, furnitureId) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const item = (state.furniture || state.srls || []).find(s => s.id === furnitureId);
    if (!item) {
      this.closeFurnitureDetail();
      return;
    }

    const project = (state.projects || []).find(p => p.id === item.projectId);
    const client = project ? (state.clients || []).find(c => c.id === project.clientId) : null;
    const clientSrl = client ? client.srl : (project ? project.clientSrl : '—');
    const clientName = client ? client.name : (project ? project.clientName : 'Client');

    const itemProcs = (state.processes || []).filter(p => (p.furnitureId || p.srlId) === furnitureId);
    itemProcs.sort((a, b) => a.sequence - b.sequence);
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    if (window.Zoosh.App) {
      window.Zoosh.App.updateMobileHeader(item.name || item.furnitureName, true, () => window.Zoosh.Views.Projects.closeFurnitureDetail());
    }

    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.closeFurnitureDetail()">
          &larr; Back to ${project ? project.name : 'Project'}
        </button>
      </div>

      <!-- Furniture Header Card -->
      <div class="card-panel" style="margin-bottom: 20px;">
        <div class="card-panel-body" style="padding: 18px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge badge-primary" style="font-size: 11px; padding: 2px 7px;">
                  Client: ${clientName} (SRL ${clientSrl})
                </span>
                <span style="font-size: 12px; color: var(--text-muted);">
                  Project: <strong>${project ? project.name : '—'}</strong>
                </span>
              </div>
              <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin-top: 8px;">
                ${item.name || item.furnitureName}
              </h2>
            </div>
            <span class="badge ${item.status === 'COMPLETED' ? 'badge-on-schedule' : 'badge-upholstery'}" style="font-size: 11px;">
              ● ${item.status.replace('_', ' ')}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 14px; font-size: 12px;">
            <span style="color: var(--text-muted);">Expected Completion:</span>
            <strong style="color: var(--text-main); font-family: var(--font-mono); font-size: 13px;">
              ${calendar.formatDisplayDate(item.expectedFinishDate, true, true)}
            </strong>
          </div>
        </div>
      </div>

      <!-- Vertical Production Process Sequence -->
      <div style="margin-bottom: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted);">
        Sequential Production Processes (${itemProcs.length} stages)
      </div>

      <div class="mobile-srl-flow-container">
        ${itemProcs.map((proc, idx) => {
          const emp = employeesMap.get(proc.employeeId);
          const deptClass = 'dept-' + proc.department.toLowerCase();

          let icon = '○';
          let statusText = 'WAITING';
          let statusBadgeClass = '';
          if (proc.status === 'COMPLETED') {
            icon = '✓';
            statusText = 'COMPLETED';
            statusBadgeClass = 'badge-on-schedule';
          } else if (proc.status === 'IN_PROGRESS') {
            icon = '●';
            statusText = 'IN PRODUCTION';
            statusBadgeClass = 'badge-upholstery';
          }

          return `
            <div class="mobile-flow-step ${deptClass}" onclick="window.Zoosh.Views.Schedule.inspectProcess('${proc.id}')" style="cursor: pointer;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span class="badge badge-${proc.department.toLowerCase()}">
                  ${icon} ${proc.department}
                </span>
                <span class="badge ${statusBadgeClass}" style="font-size: 10px;">
                  ${statusText}
                </span>
              </div>

              <div style="font-size: 15px; font-weight: 700; color: var(--text-main); margin-bottom: 2px;">
                👤 ${emp ? emp.name : 'Unassigned'}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-secondary); margin-top: 6px; border-top: 1px solid var(--border-subtle); padding-top: 6px;">
                <span style="font-family: var(--font-mono);">
                  ${calendar.formatDisplayDate(proc.calculatedStartDate, false, false)} &rarr; ${calendar.formatDisplayDate(proc.calculatedEndDate, false, false)}
                </span>
                <span style="font-weight: 600; color: var(--text-muted);">
                  ${proc.durationDays}d (${(parseFloat(proc.durationDays) || 1) * 8}h)
                </span>
              </div>

              ${proc.hasLeaveConflict ? `
                <div style="margin-top: 8px; padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); font-size: 11px; color: #92400e; display: flex; align-items: center; justify-content: space-between;" onclick="event.stopPropagation();">
                  <span>⚠️ Craftsperson on leave</span>
                  ${window.Zoosh.Auth && window.Zoosh.Auth.canEdit() ? `
                    <button class="btn btn-sm btn-accent" style="padding: 2px 8px; font-size: 10px;" onclick="window.Zoosh.ReallocateModal.open('${proc.id}')">
                      Reallocate &rarr;
                    </button>
                  ` : ''}
                </div>
              ` : ''}
            </div>

            ${idx < itemProcs.length - 1 ? '<div class="mobile-flow-arrow">&darr;</div>' : ''}
          `;
        }).join('')}
      </div>
    `;
  },

  // ==========================================
  // MODALS: ADD / EDIT / DELETE
  // ==========================================

  openAddModal(preselectedClientId = '') {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canCreate()) {
      alert('Permission Denied: Only Managers can create projects.');
      return;
    }

    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const clients = state.clients || [];

    if (clients.length === 0) {
      alert('No clients found. Please create a Client / SRL first before creating a project.');
      window.Zoosh.AddClientModal.open();
      return;
    }

    const title = 'Create New Factory Project';
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Client / Customer (SRL)</label>
          <select id="new-proj-client-id" class="form-input">
            ${clients.map(c => `
              <option value="${c.id}" ${c.id === preselectedClientId ? 'selected' : ''}>
                ${c.name} — SRL ${c.srl} (${c.location || 'Factory Floor'})
              </option>
            `).join('')}
          </select>
          <div class="form-help-text">Project will be associated under this Client's SRL identifier.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Project Name</label>
          <input type="text" id="new-proj-name" class="form-input" placeholder="e.g. Sreelal - Calicut Villa" autofocus />
        </div>

        <div class="form-group">
          <label class="form-label">Site / Delivery Location</label>
          <input type="text" id="new-proj-location" class="form-input" placeholder="e.g. Calicut" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Confirmed Date</label>
            <input type="date" id="new-proj-confirmed" class="form-input" value="${config.CURRENT_DATE}" />
          </div>
          <div class="form-group">
            <label class="form-label">Fixed Delivery Deadline</label>
            <input type="date" id="new-proj-deadline" class="form-input" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea id="new-proj-notes" class="form-textarea" rows="2" placeholder="Specific requirements, architect notes..."></textarea>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Projects.submitNewProject()">Create Project</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml);
  },

  submitNewProject() {
    const clientId = document.getElementById('new-proj-client-id').value;
    const name = document.getElementById('new-proj-name').value.trim();
    const location = document.getElementById('new-proj-location').value.trim();
    const confirmedDate = document.getElementById('new-proj-confirmed').value;
    const deliveryDeadline = document.getElementById('new-proj-deadline').value;
    const notes = document.getElementById('new-proj-notes').value.trim();

    if (!name || !deliveryDeadline) {
      alert('Please provide Project Name and Fixed Delivery Deadline.');
      return;
    }

    try {
      const newProj = window.Zoosh.State.addProject({
        clientId, name, location, confirmedDate, deliveryDeadline, notes
      });

      window.Zoosh.Modal.close();
      this.openDetail(newProj.id);
    } catch (err) {
      alert(err.message);
    }
  },

  openEditProjectModal(projectId) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canEdit()) {
      alert('Permission Denied: Only Managers can edit project deadlines.');
      return;
    }

    const state = window.Zoosh.State.getState();
    const project = (state.projects || []).find(p => p.id === projectId);
    if (!project) return;

    const title = `Edit Deadline: ${project.name}`;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Project Name</label>
          <input type="text" id="edit-proj-name" class="form-input" value="${project.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Fixed Delivery Deadline</label>
          <input type="date" id="edit-proj-deadline" class="form-input" value="${project.deliveryDeadline || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Location</label>
          <input type="text" id="edit-proj-location" class="form-input" value="${project.location || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea id="edit-proj-notes" class="form-textarea" rows="2">${project.notes || ''}</textarea>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Projects.submitEditProject('${project.id}')">Save Changes</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml);
  },

  submitEditProject(projectId) {
    const name = document.getElementById('edit-proj-name').value.trim();
    const deliveryDeadline = document.getElementById('edit-proj-deadline').value;
    const location = document.getElementById('edit-proj-location').value.trim();
    const notes = document.getElementById('edit-proj-notes').value.trim();

    try {
      window.Zoosh.State.updateProject(projectId, {
        name, deliveryDeadline, location, notes
      });

      window.Zoosh.Modal.close();
      this.renderProjectDetail(document.getElementById('view-container'), projectId);
    } catch (err) {
      alert(err.message);
    }
  },

  openEditClientModal(clientId) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canEdit()) {
      alert('Permission Denied: Only Managers can edit clients.');
      return;
    }

    const state = window.Zoosh.State.getState();
    const client = (state.clients || []).find(c => c.id === clientId);
    if (!client) return;

    const bodyHtml = `
      <div id="edit-client-error" style="display: none; padding: 8px 12px; border-radius: 6px; background: #fef2f2; color: #991b1b; font-size: 12.5px; margin-bottom: 12px;"></div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Client SRL Number</label>
        <input type="number" id="edit-client-srl" class="form-input" value="${client.srl}" />
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Client Name</label>
        <input type="text" id="edit-client-name" class="form-input" value="${client.name}" />
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Location</label>
        <input type="text" id="edit-client-location" class="form-input" value="${client.location || ''}" />
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Phone</label>
        <input type="tel" id="edit-client-phone" class="form-input" value="${client.phone || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea id="edit-client-notes" class="form-input" rows="2">${client.notes || ''}</textarea>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Projects.submitEditClient('${client.id}')">Save Client</button>
    `;

    window.Zoosh.Modal.open(`Edit Client: SRL ${client.srl}`, bodyHtml, footerHtml, '480px');
  },

  submitEditClient(clientId) {
    const srl = document.getElementById('edit-client-srl').value;
    const name = document.getElementById('edit-client-name').value.trim();
    const location = document.getElementById('edit-client-location').value.trim();
    const phone = document.getElementById('edit-client-phone').value.trim();
    const notes = document.getElementById('edit-client-notes').value.trim();
    const errEl = document.getElementById('edit-client-error');

    if (!name) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Client name is required.'; }
      return;
    }

    try {
      window.Zoosh.State.updateClient(clientId, {
        srl: Number(srl), name, location, phone, notes
      });
      window.Zoosh.Modal.close();
      this.render(document.getElementById('view-container'));
    } catch (err) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
    }
  },

  confirmDeleteClient(clientId, clientName) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canDelete()) {
      alert('Permission Denied: Only Managers can delete clients.');
      return;
    }

    if (!confirm(`Delete Client "${clientName}"?\n\nWarning: All projects, furniture items, and production schedules under this client will also be deleted.\n\nProceed?`)) {
      return;
    }

    try {
      window.Zoosh.State.deleteClient(clientId);
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message);
    }
  },

  confirmDeleteFurniture(furnId, furnName) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canDelete()) {
      alert('Permission Denied: Only Managers can delete furniture items.');
      return;
    }

    if (!confirm(`Remove furniture item "${furnName}" from this project?\nAll its process stages will also be cleared.`)) {
      return;
    }

    try {
      window.Zoosh.State.deleteFurniture(furnId);
      this.renderProjectDetail(document.getElementById('view-container'), this.activeProjectId);
    } catch (err) {
      alert(err.message);
    }
  }
};
