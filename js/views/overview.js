/**
 * Overview / Factory Management Dashboard View
 * Live KPIs, Project Status, Employee Count, Today's Reminders,
 * Actionable Factory Alerts, and Today's Production Live Board.
 * 
 * SRL belongs strictly to Client / Customer
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Overview = {
  groupMode: 'department', // 'department' | 'employee'

  render(container) {
    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const calendar = window.Zoosh.Calendar;
    const scheduler = window.Zoosh.Scheduler;
    const computed = state.computed || {};

    // Retrieve dynamically derived dashboard metrics from Scheduler
    const totalProjectsData = computed.totalProjects || (scheduler ? scheduler.calculateTotalProjects(state) : { total: 0, active: 0, nonActive: 0, completed: 0, projectStatuses: [] });
    const employeeCountsData = computed.employeeCounts || (scheduler ? scheduler.calculateEmployeeCounts(state) : { total: 0, byDepartment: {} });
    const todaysRemindersData = computed.todaysReminders || (scheduler ? scheduler.getTodaysReminders(state) : { total: 0, byType: {}, list: [] });
    const projectStatuses = totalProjectsData.projectStatuses || [];

    const todayTasks = computed.todayTasks || [];
    const alerts = computed.alerts || [];

    // Formatted "Last updated on: DD Month YYYY, HH:MM am/pm"
    const lastUpdatedStr = calendar.formatLastUpdated(state.lastDataUpdatedAt);

    container.innerHTML = `
      <!-- Desktop View Header (>768px) -->
      <div class="view-header desktop-only" style="margin-bottom: 20px;">
        <div>
          <h2 class="view-header-title">Production Overview</h2>
          <div class="view-header-subtitle">Last updated on: ${lastUpdatedStr}</div>
        </div>
      </div>

      <!-- Mobile Header (<768px) -->
      <div class="mobile-only" style="margin-bottom: 16px;">
        <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 0 0 2px 0;">Production Overview</h2>
        <div style="font-size: 12px; color: var(--text-secondary);">Last updated on: ${lastUpdatedStr}</div>
      </div>

      <!-- 4 Redesigned Management Summary Cards (Desktop & Mobile) -->
      <div class="summary-cards-grid">
        <!-- 1. TOTAL PROJECTS -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span class="summary-card-title">Total Projects</span>
            <span class="summary-card-count">${String(totalProjectsData.total).padStart(2, '0')}</span>
          </div>
          <div class="summary-card-body">
            <div class="summary-card-row">
              <span class="summary-card-row-label">Active</span>
              <span class="summary-card-row-value">${String(totalProjectsData.active).padStart(2, '0')}</span>
            </div>
            <div class="summary-card-row">
              <span class="summary-card-row-label">Non Active</span>
              <span class="summary-card-row-value">${String(totalProjectsData.nonActive).padStart(2, '0')}</span>
            </div>
            <div class="summary-card-row">
              <span class="summary-card-row-label">Completed</span>
              <span class="summary-card-row-value">${String(totalProjectsData.completed).padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        <!-- 2. PROJECT STATUS -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span class="summary-card-title">Project Status</span>
            <span class="summary-card-count" style="font-size: 12px; font-weight: 600; color: var(--text-muted); font-family: inherit;">
              ${projectStatuses.length} orders
            </span>
          </div>
          <div class="summary-card-body">
            ${projectStatuses.length === 0 ? `
              <div style="color: var(--text-muted); font-size: 12.5px; padding: 12px 0;">No active projects</div>
            ` : projectStatuses.map(p => `
              <div class="summary-card-row summary-card-row-link" onclick="window.Zoosh.Views.Overview.navigateToProject('${p.id}')" title="View ${p.displayName}">
                <span class="summary-card-row-label">${p.displayName || p.name}</span>
                <span class="summary-card-row-value" style="color: ${p.percent === 100 ? '#059669' : 'var(--text-main)'}; font-weight: 700;">
                  ${p.percent}%
                </span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 3. EMPLOYEES COUNT -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span class="summary-card-title">Employees Count</span>
            <span class="summary-card-count">${String(employeeCountsData.total).padStart(2, '0')}</span>
          </div>
          <div class="summary-card-body">
            ${Object.keys(employeeCountsData.byDepartment).length === 0 ? `
              <div style="color: var(--text-muted); font-size: 12.5px; padding: 12px 0;">No active craftspeople</div>
            ` : Object.entries(employeeCountsData.byDepartment).map(([dept, count]) => `
              <div class="summary-card-row summary-card-row-link" onclick="window.Zoosh.App.navigateTo('team')" title="View ${dept} Team">
                <span class="summary-card-row-label">${dept}</span>
                <span class="summary-card-row-value">${String(count).padStart(2, '0')}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 4. TODAY'S REMINDERS -->
        <div class="summary-card">
          <div class="summary-card-header">
            <span class="summary-card-title">Today's Reminders</span>
            <span class="summary-card-count" style="${todaysRemindersData.total > 0 ? 'color: #0284c7;' : ''}">${String(todaysRemindersData.total).padStart(2, '0')}</span>
          </div>
          <div class="summary-card-body">
            ${todaysRemindersData.total === 0 ? `
              <div style="color: var(--text-muted); font-size: 12.5px; padding: 12px 0;">No urgent reminders today</div>
            ` : Object.entries(todaysRemindersData.byType).map(([type, count]) => `
              <div class="summary-card-row summary-card-row-link" onclick="window.Zoosh.Views.Overview.openRemindersModal('${type}')" title="View ${type} reminders">
                <span class="summary-card-row-label">${type}</span>
                <span class="summary-card-row-value">${String(count).padStart(2, '0')}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- Action Required Alerts (Shared Desktop & Mobile) -->
      ${alerts.length > 0 ? `
        <div class="alerts-section" style="margin-bottom: 24px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); margin-bottom: 2px;">
            Action Required Alerts (${alerts.length})
          </div>
          ${alerts.map(a => `
            <div class="alert-card ${a.type}">
              <div class="alert-info">
                <span class="alert-icon">${a.type === 'danger' ? '🚨' : (a.type === 'warning' ? '⚠️' : 'ℹ️')}</span>
                <div>
                  <div class="alert-title">${a.title}</div>
                  <div class="alert-desc">${a.message}</div>
                </div>
              </div>
              <button class="alert-action-btn" onclick="window.Zoosh.Views.Overview.handleAlertAction('${a.actionType}', '${a.targetId}')">
                ${a.actionLabel} &rarr;
              </button>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Today's Production Live Board -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div>
            <div class="card-panel-title">Today's Production</div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
              Active work scheduled for ${calendar.formatDisplayDate(config.CURRENT_DATE, false, true)}
            </div>
          </div>
          <div class="btn-group">
            <button class="btn-group-btn ${this.groupMode === 'department' ? 'active' : ''}" 
              onclick="window.Zoosh.Views.Overview.setGroupMode('department')">
              By Department
            </button>
            <button class="btn-group-btn ${this.groupMode === 'employee' ? 'active' : ''}" 
              onclick="window.Zoosh.Views.Overview.setGroupMode('employee')">
              By Employee
            </button>
          </div>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          ${this.renderTodayProductionList(todayTasks)}
        </div>
      </div>

      <!-- Mobile Factory Sections Navigation (<768px) -->
      <div class="mobile-only" style="margin-top: 24px; margin-bottom: 24px;">
        <div class="mobile-section-title">
          <span>Factory Navigation</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div onclick="window.Zoosh.App.navigateTo('projects')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">📁</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Projects &amp; SRL</div>
            <div style="font-size: 11px; color: var(--text-muted);">${totalProjectsData.total} orders (${totalProjectsData.active} active)</div>
          </div>
          <div onclick="window.Zoosh.App.navigateTo('schedule')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">📅</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Schedule</div>
            <div style="font-size: 11px; color: var(--text-muted);">${todayTasks.length} active tasks today</div>
          </div>
          <div onclick="window.Zoosh.App.navigateTo('team')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">👥</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Team</div>
            <div style="font-size: 11px; color: var(--text-muted);">${employeeCountsData.total} active craftspeople</div>
          </div>
          <div onclick="window.Zoosh.App.navigateTo('manpower')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">💼</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Manpower</div>
            <div style="font-size: 11px; color: var(--text-muted);">Leave log &amp; overtime</div>
          </div>
          <div onclick="window.Zoosh.App.navigateTo('processes')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">⚙️</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Processes</div>
            <div style="font-size: 11px; color: var(--text-muted);">Standard flow sequences</div>
          </div>
          <div onclick="window.Zoosh.App.navigateTo('reports')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">📊</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Reports</div>
            <div style="font-size: 11px; color: var(--text-muted);">Factory analytics &amp; loads</div>
          </div>
        </div>
      </div>
    `;
  },

  navigateToProject(projectId) {
    if (window.Zoosh.App) {
      window.Zoosh.App.navigateTo('projects');
      setTimeout(() => {
        if (window.Zoosh.Views.Projects) {
          window.Zoosh.Views.Projects.openDetail(projectId);
        }
      }, 50);
    }
  },

  renderTodayProductionList(todayTasks) {
    if (todayTasks.length === 0) {
      return `
        <div style="padding: 40px; text-align: center; color: var(--text-muted);">
          No production tasks scheduled for today.
        </div>
      `;
    }

    if (this.groupMode === 'department') {
      return this.renderTodayByDepartment(todayTasks);
    } else {
      return this.renderTodayByEmployee(todayTasks);
    }
  },

  renderTodayByDepartment(todayTasks) {
    const config = window.Zoosh.Config;
    const depts = Object.keys(config.DEPARTMENTS);

    return `
      <div style="display: flex; flex-direction: column;">
        ${depts.map(dept => {
          const tasks = todayTasks.filter(t => t.department === dept);
          if (tasks.length === 0) return '';

          const deptConfig = config.DEPARTMENTS[dept] || {};

          return `
            <div style="border-bottom: 1px solid var(--border-light); padding: 16px 24px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <span class="badge ${deptConfig.badgeClass || ''}" style="font-size: 11.5px; padding: 4px 10px;">
                  ${dept.toUpperCase()} &bull; ${tasks.length} active task${tasks.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${tasks.map(t => this.renderTodayTaskCard(t)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderTodayByEmployee(todayTasks) {
    const state = window.Zoosh.State.getState();
    const employees = state.employees || [];

    return `
      <div style="display: flex; flex-direction: column;">
        ${employees.map(emp => {
          const tasks = todayTasks.filter(t => t.employeeId === emp.id);
          if (tasks.length === 0) return '';

          return `
            <div style="border-bottom: 1px solid var(--border-light); padding: 16px 24px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: ${emp.avatarColor || '#64748b'}; color: #fff; font-weight: 700; font-size: 11px; display: flex; align-items: center; justify-content: center;">
                  ${emp.name.charAt(0)}
                </div>
                <strong style="color: var(--text-main); font-size: 13.5px;">${emp.name}</strong>
                <span class="badge badge-${emp.department.toLowerCase()}" style="font-size: 10px;">${emp.department}</span>
                <span style="font-size: 11.5px; color: var(--text-muted); margin-left: auto;">
                  ${tasks.length} task${tasks.length > 1 ? 's' : ''} scheduled
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${tasks.map(t => this.renderTodayTaskCard(t)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderTodayTaskCard(t) {
    const calendar = window.Zoosh.Calendar;
    const isLeaveConflict = t.hasLeaveConflict;

    return `
      <div class="today-task-card ${isLeaveConflict ? 'conflict' : ''}" onclick="window.Zoosh.Views.Overview.handleInspectProcess('${t.processId}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
          <div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main); line-height: 1.3;">
              ${t.furnitureName}
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
              <strong style="color: var(--text-secondary);">SRL ${t.clientSrl}</strong> &bull; ${t.clientName}
            </div>
          </div>
          <span class="badge badge-${t.department.toLowerCase()}" style="font-size: 9.5px; padding: 2px 6px;">
            ${t.department}
          </span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--text-secondary); margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-subtle);">
          <span>Artisan: <strong>${t.employeeName}</strong></span>
          <span style="font-family: var(--font-mono); font-weight: 600;">${t.timeSlot} (${t.hoursToday}h)</span>
        </div>

        ${isLeaveConflict ? `
          <div style="margin-top: 8px; font-size: 11px; color: #b45309; background: #fffbeb; padding: 4px 8px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between;">
            <span>⚠️ Artisan on Leave today!</span>
            <span style="text-decoration: underline; font-weight: 600;">Reallocate &rarr;</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  setGroupMode(mode) {
    this.groupMode = mode;
    this.render(document.getElementById('view-container'));
  },

  handleAlertAction(actionType, targetId) {
    if (actionType === 'REALLOCATE_WORK') {
      if (window.Zoosh.Auth && !window.Zoosh.Auth.canEdit()) {
        alert('Permission Denied: Only Managers can reallocate work.');
        return;
      }
      window.Zoosh.ReallocateModal.open(targetId);
    } else if (actionType === 'VIEW_PROJECT') {
      window.Zoosh.App.navigateTo('projects');
      setTimeout(() => {
        window.Zoosh.Views.Projects.openDetail(targetId);
      }, 50);
    } else if (actionType === 'VIEW_MANPOWER') {
      window.Zoosh.App.navigateTo('manpower');
    }
  },

  handleInspectProcess(procId) {
    if (window.Zoosh.Views.Schedule) {
      window.Zoosh.Views.Schedule.inspectProcess(procId);
    }
  },

  openRemindersModal(filterType = null) {
    const state = window.Zoosh.State.getState();
    const reminders = state.reminders || [];
    const auth = window.Zoosh.Auth;
    const canCreate = auth ? auth.canCreate() : true;
    const canEdit = auth ? auth.canEdit() : true;

    const filtered = (filterType && filterType !== 'ALL') ? reminders.filter(r => r.type === filterType) : reminders;

    const title = (filterType && filterType !== 'ALL') ? `Reminders: ${filterType}` : 'Operational Reminders &amp; Follow-ups';
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="font-size: 12.5px; color: var(--text-muted);">
          Operational follow-ups based on production schedule deadlines and purchase order procurement.
        </div>
        
        <div style="max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${filtered.length === 0 ? `
            <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 13px;">
              No pending reminders found.
            </div>
          ` : filtered.map(r => `
            <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; box-shadow: var(--shadow-sm);">
              <div>
                <div style="font-weight: 700; font-size: 13px; color: var(--text-main);">${r.title}</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  <span class="badge badge-primary" style="font-size: 9.5px; padding: 1px 5px;">${r.type}</span>
                  ${r.projectName ? `&bull; <strong>${r.projectName}</strong>` : ''}
                  &bull; Due: ${r.date}
                </div>
                ${r.notes ? `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">${r.notes}</div>` : ''}
              </div>
              ${canEdit ? `
                <button class="btn btn-sm btn-secondary" style="font-size: 11px; padding: 3px 8px;" onclick="window.Zoosh.State.deleteReminder('${r.id}'); window.Zoosh.Views.Overview.openRemindersModal('${filterType || 'ALL'}')">
                  ✓ Dismiss
                </button>
              ` : ''}
            </div>
          `).join('')}
        </div>

        ${canCreate ? `
          <div style="border-top: 1px solid var(--border-light); padding-top: 14px; margin-top: 4px;">
            <div style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px;">
              + Create New Operational Reminder
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <input type="text" id="new-rem-title" class="form-input" placeholder="e.g. Issue PO for German Soft-Close Channels" />
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                <select id="new-rem-type" class="form-select">
                  <option value="Purchase Order Follow-up">Purchase Order Follow-up</option>
                  <option value="Deadline Follow-up">Deadline Follow-up</option>
                  <option value="Job Work Sending">Job Work Sending</option>
                  <option value="Material Follow-up">Material Follow-up</option>
                  <option value="Client Follow-up">Client Follow-up</option>
                </select>
                <select id="new-rem-project" class="form-select">
                  <option value="">Link Project (Optional)</option>
                  ${(state.projects || []).map(p => `<option value="${p.id}">${p.name} (${p.location})</option>`).join('')}
                </select>
              </div>
              <button class="btn btn-primary btn-sm" onclick="window.Zoosh.Views.Overview.submitAddReminder('${filterType || 'ALL'}')">
                Save Reminder
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const footerHtml = `<button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Close</button>`;
    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '520px');
  },

  submitAddReminder(filterType = 'ALL') {
    const titleEl = document.getElementById('new-rem-title');
    const typeEl = document.getElementById('new-rem-type');
    const projEl = document.getElementById('new-rem-project');
    if (!titleEl || !titleEl.value.trim()) {
      alert('Please enter a reminder title.');
      return;
    }
    const state = window.Zoosh.State.getState();
    const proj = projEl && projEl.value ? (state.projects || []).find(p => p.id === projEl.value) : null;
    window.Zoosh.State.addReminder({
      title: titleEl.value.trim(),
      type: typeEl ? typeEl.value : 'Purchase Order Follow-up',
      projectId: proj ? proj.id : null,
      projectName: proj ? (proj.displayName || proj.name) : '',
      date: state.currentDate
    });
    window.Zoosh.Modal.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.showToast('Reminder saved.');
    }
  }
};
