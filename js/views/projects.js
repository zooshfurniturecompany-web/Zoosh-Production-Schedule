/**
 * Projects & Project Detail View
 * Fixed delivery targets, production progress tracking, SRL lists, and item management
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Projects = {
  activeProjectId: null,
  activeSrlId: null,
  searchQuery: '',
  statusFilter: 'ALL',

  render(container) {
    if (this.activeSrlId) {
      this.renderSrlDetailView(container, this.activeSrlId);
    } else if (this.activeProjectId) {
      this.renderProjectDetail(container, this.activeProjectId);
    } else {
      if (window.Zoosh.App) {
        window.Zoosh.App.updateMobileHeader('Projects', false);
      }
      this.renderProjectList(container);
    }
  },

  renderProjectList(container) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    let projects = state.projects || [];

    // Filter by search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      projects = projects.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.clientName.toLowerCase().includes(q) || 
        p.location.toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (this.statusFilter !== 'ALL') {
      projects = projects.filter(p => p.deadlineStatus === this.statusFilter);
    }

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-header-title">Projects</h2>
          <div class="view-header-subtitle">Custom furniture orders and fixed delivery targets</div>
        </div>
        <button class="btn btn-primary" onclick="window.Zoosh.Views.Projects.openAddModal()">
          <span>+</span> Add Project
        </button>
      </div>

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" class="search-input-box" placeholder="🔍 Search projects or clients..." 
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
          No projects found matching the criteria.
        </div>
      ` : `
        <!-- Mobile Project Cards (<768px) -->
        <div class="mobile-only">
          ${projects.map(p => this.renderMobileProjectCard(p)).join('')}
        </div>

        <!-- Desktop Project Grid (>768px) -->
        <div class="desktop-only" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px;">
          ${projects.map(p => this.renderProjectCard(p)).join('')}
        </div>
      `}
    `;
  },

  renderMobileProjectCard(project) {
    const calendar = window.Zoosh.Calendar;
    let badgeClass = 'badge-on-schedule';
    let statusLabel = 'ON TRACK';
    if (project.deadlineStatus === 'AT_RISK') {
      badgeClass = 'badge-at-risk';
      statusLabel = `AT RISK (${project.daysBuffer || 0}d buffer)`;
    } else if (project.deadlineStatus === 'DELAYED') {
      badgeClass = 'badge-delayed';
      statusLabel = `DELAYED (+${project.daysOverdue || 0}d)`;
    }

    return `
      <div class="mobile-project-card" onclick="window.Zoosh.Views.Projects.openDetail('${project.id}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <div style="font-weight: 800; font-size: 15px; color: var(--text-main);">${project.name}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              ${project.clientName} &bull; ${project.location}
            </div>
          </div>
          <span class="badge ${badgeClass}" style="font-size: 10px;">${statusLabel}</span>
        </div>

        <div style="margin: 12px 0;">
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 4px;">
            <span style="color: var(--text-muted);">Production Progress</span>
            <span style="font-weight: 700; color: var(--text-secondary);">
              ${project.completedSrlCount || 0} / ${project.totalSrlCount || 0} SRLs (${project.completionPercent || 0}%)
            </span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${project.completionPercent || 0}%;"></div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; border-top: 1px solid var(--border-subtle); padding-top: 10px; margin-top: 6px;">
          <div>
            <span style="color: var(--text-muted); font-size: 10px; text-transform: uppercase; font-weight: 700; display: block;">Deadline</span>
            <strong style="color: var(--text-main); font-size: 12px;">${calendar.formatDisplayDate(project.deliveryDeadline, false, true)}</strong>
          </div>
          <span style="color: var(--accent-blue); font-weight: 700; font-size: 12px;">
            View SRLs &rarr;
          </span>
        </div>
      </div>
    `;
  },

  renderProjectCard(project) {
    const calendar = window.Zoosh.Calendar;
    let badgeClass = 'badge-on-schedule';
    let statusLabel = 'ON SCHEDULE';
    if (project.deadlineStatus === 'AT_RISK') {
      badgeClass = 'badge-at-risk';
      statusLabel = `AT RISK (${project.daysBuffer || 0}d buffer)`;
    } else if (project.deadlineStatus === 'DELAYED') {
      badgeClass = 'badge-delayed';
      statusLabel = `DELAYED (+${project.daysOverdue || 0}d overdue)`;
    }

    return `
      <div class="card-panel" style="margin-bottom: 0; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;" 
        onclick="window.Zoosh.Views.Projects.openDetail('${project.id}')">
        <div class="card-panel-header" style="background: #ffffff;">
          <div>
            <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">${project.name}</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              ${project.clientName} &bull; ${project.location}
            </div>
          </div>
          <span class="badge ${badgeClass}">${statusLabel}</span>
        </div>
        <div class="card-panel-body" style="padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 12px;">
            <div>
              <span style="color: var(--text-muted); display: block; font-size: 10.5px; text-transform: uppercase; font-weight: 700;">Delivery Deadline</span>
              <strong style="color: var(--text-main);">${calendar.formatDisplayDate(project.deliveryDeadline, false, true)}</strong>
            </div>
            <div style="text-align: right;">
              <span style="color: var(--text-muted); display: block; font-size: 10.5px; text-transform: uppercase; font-weight: 700;">Projected Finish</span>
              <strong style="color: ${project.deadlineStatus === 'DELAYED' ? '#dc2626' : 'var(--text-main)'};">
                ${calendar.formatDisplayDate(project.projectedFinishDate, false, true)}
              </strong>
            </div>
          </div>

          <div style="margin-top: 14px;">
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 5px;">
              <span style="color: var(--text-muted);">Progress</span>
              <span style="font-weight: 600; color: var(--text-secondary);">${project.completedSrlCount || 0} / ${project.totalSrlCount || 0} SRLs (${project.completionPercent || 0}%)</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-bar-fill" style="width: ${project.completionPercent || 0}%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  openDetail(projectId) {
    this.activeProjectId = projectId;
    this.activeSrlId = null;
    this.render(document.getElementById('view-container'));
  },

  closeDetail() {
    this.activeProjectId = null;
    this.activeSrlId = null;
    this.render(document.getElementById('view-container'));
  },

  openSrlMobileDetail(srlId) {
    this.activeSrlId = srlId;
    this.render(document.getElementById('view-container'));
  },

  closeSrlDetail() {
    this.activeSrlId = null;
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

    if (window.Zoosh.App) {
      window.Zoosh.App.updateMobileHeader(project.name, true, () => window.Zoosh.Views.Projects.closeDetail());
    }

    const projectSrls = (state.srls || []).filter(s => s.projectId === projectId);
    const flowTypesMap = new Map((state.flowTypes || []).map(f => [f.id, f]));
    const processesMap = new Map((state.processes || []).map(p => [p.id, p]));

    let badgeClass = 'badge-on-schedule';
    let statusLabel = 'ON TRACK';
    if (project.deadlineStatus === 'AT_RISK') {
      badgeClass = 'badge-at-risk';
      statusLabel = `AT RISK (${project.daysBuffer || 0} days buffer)`;
    } else if (project.deadlineStatus === 'DELAYED') {
      badgeClass = 'badge-delayed';
      statusLabel = `DELAYED (+${project.daysOverdue || 0} days)`;
    }

    container.innerHTML = `
      <div style="margin-bottom: 20px;" class="desktop-only">
        <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.closeDetail()">
          &larr; Back to All Projects
        </button>
      </div>

      <div class="card-panel" style="margin-bottom: 24px;">
        <div class="card-panel-body" style="padding: 20px;">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted);">
                Project Detail
              </div>
              <h2 style="font-size: 22px; font-weight: 800; color: var(--text-main); margin-top: 4px; letter-spacing: -0.5px;">
                ${project.name}
              </h2>
              <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                Client: <strong>${project.clientName}</strong> &bull; Location: <strong>${project.location}</strong>
              </div>
              ${project.notes ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; font-style: italic;">"${project.notes}"</div>` : ''}
            </div>

            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 10px;">
              <span class="badge ${badgeClass}" style="font-size: 11px; padding: 4px 10px;">${statusLabel}</span>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.openEditProjectModal('${project.id}')">
                  Edit Deadline
                </button>
                <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddSrlWizard.open('${project.id}')">
                  + Add Furniture
                </button>
              </div>
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
              <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">Fixed Deadline</div>
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
                ${project.completedSrlCount || 0} / ${project.totalSrlCount || 0} SRLs (${project.completionPercent || 0}%)
              </div>
              <div class="progress-bar-container" style="margin-top: 6px;">
                <div class="progress-bar-fill" style="width: ${project.completionPercent || 0}%;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SRL Items List -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">Project Furniture Items (${projectSrls.length} SRLs)</div>
          <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddSrlWizard.open('${project.id}')">
            + Add Item
          </button>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          ${projectSrls.length === 0 ? `
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
              No furniture items registered under this project yet.
            </div>
          ` : `
            <!-- Mobile SRL Cards (<768px) -->
            <div class="mobile-only" style="padding: 12px 14px;">
              ${projectSrls.map(srl => {
                const srlProcs = (srl.processIds || []).map(id => processesMap.get(id)).filter(Boolean);
                srlProcs.sort((a, b) => a.sequence - b.sequence);
                return `
                  <div class="mobile-task-card" style="margin-bottom: 10px; cursor: pointer;" onclick="window.Zoosh.Views.Projects.openSrlMobileDetail('${srl.id}')">
                    <div class="mobile-task-card-header">
                      <span class="mobile-task-srl">SRL ${srl.srlNumber}</span>
                      <span class="badge ${srl.status === 'COMPLETED' ? 'badge-on-schedule' : 'badge-upholstery'}" style="font-size: 10px;">
                        ● ${srl.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div class="mobile-task-title">${srl.furnitureName}</div>
                    <div class="flow-breadcrumbs" style="margin: 8px 0;">
                      ${srlProcs.map((p, idx) => `
                        <span class="badge badge-${p.department.toLowerCase()}" style="font-size: 10px;">${p.department}</span>
                        ${idx < srlProcs.length - 1 ? '<span class="flow-crumb-arrow">&rarr;</span>' : ''}
                      `).join('')}
                    </div>
                    <div class="mobile-task-footer">
                      <span style="color: var(--text-muted); font-size: 11px;">Expected Finish</span>
                      <span style="font-weight: 700; color: var(--text-main); font-family: var(--font-mono); font-size: 12px;">
                        ${calendar.formatDisplayDate(srl.expectedFinishDate, false, true)}
                      </span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Desktop SRL Table (>768px) -->
            <div class="desktop-only data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>SRL #</th>
                    <th>Furniture Item</th>
                    <th>Process Flow Sequence</th>
                    <th>Expected Finish</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${projectSrls.map(srl => {
                    const srlProcs = (srl.processIds || []).map(id => processesMap.get(id)).filter(Boolean);
                    srlProcs.sort((a, b) => a.sequence - b.sequence);

                    return `
                      <tr style="cursor: pointer;" onclick="window.Zoosh.Views.Projects.openSrlMobileDetail('${srl.id}')">
                        <td>
                          <span style="font-weight: 700; color: #2563eb; background: #eff6ff; padding: 3px 8px; border-radius: 4px; font-family: var(--font-mono);">
                            SRL ${srl.srlNumber}
                          </span>
                        </td>
                        <td style="font-weight: 600; color: var(--text-main);">
                          ${srl.furnitureName}
                        </td>
                        <td>
                          <div class="flow-breadcrumbs">
                            ${srlProcs.map((p, idx) => `
                              <span class="badge badge-${p.department.toLowerCase()}">${p.department}</span>
                              ${idx < srlProcs.length - 1 ? '<span class="flow-crumb-arrow">&rarr;</span>' : ''}
                            `).join('')}
                          </div>
                        </td>
                        <td style="font-family: var(--font-mono); font-weight: 600;">
                          ${calendar.formatDisplayDate(srl.expectedFinishDate, false, true)}
                        </td>
                        <td>
                          <span class="badge ${srl.status === 'COMPLETED' ? 'badge-on-schedule' : (srl.status === 'IN_PROGRESS' ? 'badge-upholstery' : '')}">
                            ${srl.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td onclick="event.stopPropagation();">
                          <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.openSrlMobileDetail('${srl.id}')">
                            Inspect &rarr;
                          </button>
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

  renderSrlDetailView(container, srlId) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const srl = (state.srls || []).find(s => s.id === srlId);
    if (!srl) {
      this.closeSrlDetail();
      return;
    }

    const project = (state.projects || []).find(p => p.id === srl.projectId);
    const srlProcs = (state.processes || []).filter(p => p.srlId === srlId);
    srlProcs.sort((a, b) => a.sequence - b.sequence);
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    if (window.Zoosh.App) {
      window.Zoosh.App.updateMobileHeader(`SRL ${srl.srlNumber}`, true, () => window.Zoosh.Views.Projects.closeSrlDetail());
    }

    container.innerHTML = `
      <div style="margin-bottom: 16px;">
        <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Projects.closeSrlDetail()">
          &larr; Back to ${project ? project.name : 'Project'}
        </button>
      </div>

      <!-- SRL Overview Header Card -->
      <div class="card-panel" style="margin-bottom: 20px;">
        <div class="card-panel-body" style="padding: 18px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <span class="mobile-task-srl" style="font-size: 12px; padding: 3px 8px;">SRL ${srl.srlNumber}</span>
              <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin-top: 6px;">${srl.furnitureName}</h2>
              <div style="font-size: 12.5px; color: var(--text-muted); margin-top: 2px;">
                Project: <strong>${project ? project.name : '—'}</strong>
              </div>
            </div>
            <span class="badge ${srl.status === 'COMPLETED' ? 'badge-on-schedule' : 'badge-upholstery'}" style="font-size: 11px;">
              ● ${srl.status.replace('_', ' ')}
            </span>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 12px; margin-top: 14px; font-size: 12px;">
            <span style="color: var(--text-muted);">Expected Completion:</span>
            <strong style="color: var(--text-main); font-family: var(--font-mono); font-size: 13px;">
              ${calendar.formatDisplayDate(srl.expectedFinishDate, true, true)}
            </strong>
          </div>
        </div>
      </div>

      <!-- Vertical Production Process Sequence -->
      <div style="margin-bottom: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted);">
        Sequential Production Processes (${srlProcs.length} stages)
      </div>

      <div class="mobile-srl-flow-container">
        ${srlProcs.map((proc, idx) => {
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
                  <button class="btn btn-sm btn-accent" style="padding: 2px 8px; font-size: 10px;" onclick="window.Zoosh.ReallocateModal.open('${proc.id}')">
                    Reallocate &rarr;
                  </button>
                </div>
              ` : ''}
            </div>

            ${idx < srlProcs.length - 1 ? '<div class="mobile-flow-arrow">&darr;</div>' : ''}
          `;
        }).join('')}
      </div>
    `;
  },

  openAddModal() {
    const config = window.Zoosh.Config;
    const title = 'Create New Project';
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Project Name</label>
          <input type="text" id="new-proj-name" class="form-input" placeholder="e.g. Sreelal - Calicut" />
        </div>
        <div class="form-group">
          <label class="form-label">Client Name</label>
          <input type="text" id="new-proj-client" class="form-input" placeholder="e.g. Mr. Sreelal" />
        </div>
        <div class="form-group">
          <label class="form-label">Location</label>
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
    const name = document.getElementById('new-proj-name').value.trim();
    const clientName = document.getElementById('new-proj-client').value.trim();
    const location = document.getElementById('new-proj-location').value.trim();
    const confirmedDate = document.getElementById('new-proj-confirmed').value;
    const deliveryDeadline = document.getElementById('new-proj-deadline').value;
    const notes = document.getElementById('new-proj-notes').value.trim();

    if (!name || !deliveryDeadline) {
      alert('Please provide Project Name and Fixed Delivery Deadline.');
      return;
    }

    const newProj = window.Zoosh.State.addProject({
      name, clientName, location, confirmedDate, deliveryDeadline, notes
    });

    window.Zoosh.Modal.close();
    this.openDetail(newProj.id);
  },

  openEditProjectModal(projectId) {
    const state = window.Zoosh.State.getState();
    const project = state.projects.find(p => p.id === projectId);
    if (!project) return;

    const title = `Edit Project & Delivery Deadline — ${project.name}`;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Project Name</label>
          <input type="text" id="edit-proj-name" class="form-input" value="${project.name}" />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Client Name</label>
            <input type="text" id="edit-proj-client" class="form-input" value="${project.clientName}" />
          </div>
          <div class="form-group">
            <label class="form-label">Location</label>
            <input type="text" id="edit-proj-loc" class="form-input" value="${project.location}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Fixed Delivery Target Deadline</label>
          <input type="date" id="edit-proj-deadline" class="form-input" value="${project.deliveryDeadline}" />
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
            The delivery deadline is a fixed benchmark and is never automatically changed by the system.
          </div>
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
    const clientName = document.getElementById('edit-proj-client').value.trim();
    const location = document.getElementById('edit-proj-loc').value.trim();
    const deliveryDeadline = document.getElementById('edit-proj-deadline').value;
    const notes = document.getElementById('edit-proj-notes').value.trim();

    if (!deliveryDeadline) {
      alert('Delivery deadline cannot be empty.');
      return;
    }

    window.Zoosh.State.updateProject(projectId, {
      name, clientName, location, deliveryDeadline, notes
    });

    window.Zoosh.Modal.close();
  },

  openSrlDetail(srlId) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const srl = (state.srls || []).find(s => s.id === srlId);
    if (!srl) return;

    const project = (state.projects || []).find(p => p.id === srl.projectId);
    const srlProcs = (state.processes || []).filter(p => p.srlId === srlId);
    srlProcs.sort((a, b) => a.sequence - b.sequence);
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    const title = `SRL ${srl.srlNumber} — ${srl.furnitureName}`;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 18px;">
        <div style="background: var(--bg-hover); padding: 12px 16px; border-radius: var(--radius-sm); border-left: 4px solid #2563eb;">
          <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">
            Project: ${project ? project.name : '—'}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            Expected Completion: <strong>${calendar.formatDisplayDate(srl.expectedFinishDate, true, true)}</strong>
          </div>
        </div>

        <div>
          <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">
            Sequential Production Processes (${srlProcs.length} stages)
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${srlProcs.map(proc => {
              const emp = employeesMap.get(proc.employeeId);
              return `
                <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px 16px; background: #ffffff;">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-weight: 700; font-size: 11.5px; color: var(--text-muted);">STEP ${proc.sequence}</span>
                      <span class="badge badge-${proc.department.toLowerCase()}">${proc.department}</span>
                    </div>
                    <span style="font-size: 12px; font-family: var(--font-mono); font-weight: 600;">
                      ${calendar.formatDisplayDate(proc.calculatedStartDate, false, false)} &rarr; ${calendar.formatDisplayDate(proc.calculatedEndDate, false, false)}
                    </span>
                  </div>
                  <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12.5px;">
                    <div>
                      Assigned: <strong>${emp ? emp.name : 'Unassigned'}</strong> &bull; Duration: <strong>${proc.durationDays} days</strong> (${(parseFloat(proc.durationDays) || 1) * 8}h)
                    </div>
                    ${proc.hasLeaveConflict ? `
                      <button class="btn btn-secondary btn-sm" style="color: #b45309;" onclick="window.Zoosh.Modal.close(); window.Zoosh.ReallocateModal.open('${proc.id}')">
                        Reallocate &rarr;
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Close</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '600px');
  }
};
