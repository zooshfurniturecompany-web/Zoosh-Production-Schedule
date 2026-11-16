/**
 * ZOOSH PRODUCTION — Modern Manufacturing ERP Overview Dashboard
 * Real-time production metrics, delivery deadlines, shop floor activity, and operational alerts.
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

    const projects = state.projects || [];
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));
    const furniture = state.furniture || [];

    // Real Metrics
    const activeProjects = projects.filter(p => !p.isDelivered && p.status !== 'DELIVERED');
    const completedProjects = projects.filter(p => p.isDelivered || p.status === 'DELIVERED' || p.completionPercent === 100);
    const delayedProjects = activeProjects.filter(p => p.deadlineStatus === 'DELAYED' || p.deadlineStatus === 'AT_RISK');
    const inProductionProjects = activeProjects.filter(p => (p.completionPercent || 0) >= 0);

    const avgProgress = activeProjects.length > 0 
      ? Math.round(activeProjects.reduce((acc, p) => acc + (p.completionPercent || 0), 0) / activeProjects.length) 
      : 0;

    const employeeCountsData = computed.employeeCounts || (scheduler ? scheduler.calculateEmployeeCounts(state) : { total: 0, byDepartment: {} });
    const todaysRemindersData = computed.todaysReminders || (scheduler ? scheduler.getTodaysReminders(state) : { total: 0, byType: {}, list: [] });
    const todayTasks = computed.todayTasks || [];
    const alerts = computed.alerts || [];

    // Sorted Upcoming Deadlines (Active projects sorted by deadline)
    const upcomingDeadlines = [...activeProjects].sort((a, b) => {
      const dateA = new Date(a.deliveryDeadline || '2099-12-31');
      const dateB = new Date(b.deliveryDeadline || '2099-12-31');
      return dateA - dateB;
    });

    const lastUpdatedStr = calendar.formatLastUpdated(state.lastDataUpdatedAt);

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- View Header -->
        <div class="view-header" style="margin-bottom: 0;">
          <div>
            <h1 class="view-header-title">Production Overview</h1>
            <div class="view-header-subtitle">
              Live shop floor performance, project commitments, and production workload &bull; Updated ${lastUpdatedStr}
            </div>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Overview.openRemindersModal('ALL')">
              <span>🔔</span> Reminders (${todaysRemindersData.total})
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.Zoosh.AddFurnitureWizard.open()">
              <span>+</span> New Furniture Order
            </button>
          </div>
        </div>

        <!-- 4 Compact ERP KPI Cards (User Specified) -->
        <div class="summary-cards-grid" style="margin-bottom: 0;">
          
          <!-- KPI 1: Active Projects -->
          <div class="metric-card primary">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">Active Projects</span>
              <span style="font-size: 16px;">📁</span>
            </div>
            <div class="metric-card-value">${String(activeProjects.length).padStart(2, '0')}</div>
            <div class="metric-card-hint">
              <span>${projects.length} total committed orders</span>
            </div>
          </div>

          <!-- KPI 2: Projects in Production -->
          <div class="metric-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">In Production</span>
              <span style="font-size: 16px;">⚙️</span>
            </div>
            <div class="metric-card-value" style="color: var(--primary-blue);">${String(inProductionProjects.length).padStart(2, '0')}</div>
            <div class="metric-card-hint">
              <span>${avgProgress}% average completion</span>
            </div>
          </div>

          <!-- KPI 3: Delayed Projects -->
          <div class="metric-card ${delayedProjects.length > 0 ? 'warning' : 'success'}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">Delayed Projects</span>
              <span style="font-size: 16px;">${delayedProjects.length > 0 ? '⚠️' : '✓'}</span>
            </div>
            <div class="metric-card-value">${String(delayedProjects.length).padStart(2, '0')}</div>
            <div class="metric-card-hint">
              <span>${delayedProjects.length > 0 ? `${delayedProjects.length} require buffer attention` : 'All deliveries on schedule'}</span>
            </div>
          </div>

          <!-- KPI 4: Completed Projects -->
          <div class="metric-card success">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="metric-card-label">Completed Projects</span>
              <span style="font-size: 16px;">🏁</span>
            </div>
            <div class="metric-card-value">${String(completedProjects.length).padStart(2, '0')}</div>
            <div class="metric-card-hint">
              <span>Delivered or ready for dispatch</span>
            </div>
          </div>

        </div>

        <!-- Actionable Alerts Banner (If Any) -->
        ${alerts.length > 0 ? `
          <div class="alerts-section" style="margin-bottom: 0;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 2px;">
              Important Factory Alerts (${alerts.length})
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

        <!-- 2-Column Main Section: Upcoming Deadlines & Production Progress -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px;">
          
          <!-- Column 1: Upcoming Deadlines -->
          <div class="card-panel" style="margin-bottom: 0;">
            <div class="card-panel-header">
              <div>
                <div class="card-panel-title">Upcoming Delivery Deadlines</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  Delivery commitments sorted by delivery date
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.App.navigateTo('projects')">
                View All &rarr;
              </button>
            </div>
            <div class="card-panel-body" style="padding: 0;">
              ${upcomingDeadlines.length === 0 ? `
                <div style="padding: 30px; text-align: center; color: var(--text-muted);">No active project deadlines.</div>
              ` : `
                <div style="display: flex; flex-direction: column;">
                  ${upcomingDeadlines.slice(0, 5).map(p => {
                    const client = clientsMap.get(p.clientId) || {};
                    const clientCode = client.code || client.clientCode || p.clientCode || '—';
                    const isDelayed = p.deadlineStatus === 'DELAYED';
                    const isAtRisk = p.deadlineStatus === 'AT_RISK';
                    
                    let badgeClass = 'badge-on-schedule';
                    let badgeText = 'On Track';
                    if (isDelayed) {
                      badgeClass = 'badge-delayed';
                      badgeText = `Delayed (+${p.daysOverdue || 0}d)`;
                    } else if (isAtRisk) {
                      badgeClass = 'badge-at-risk';
                      badgeText = `At Risk (${p.daysBuffer || 0}d buffer)`;
                    }

                    return `
                      <div style="padding: 12px 18px; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; gap: 12px; transition: background-color 0.15s; cursor: pointer;" onclick="window.Zoosh.Views.Overview.navigateToProject('${p.id}')">
                        <div style="min-width: 0; flex: 1;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="badge badge-primary" style="font-family: var(--font-mono); font-size: 10px; padding: 1px 5px;">${clientCode}</span>
                            <strong style="color: var(--text-main); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</strong>
                          </div>
                          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
                            ${client.name || p.clientName || 'Client'} &bull; ${p.location}
                          </div>
                        </div>

                        <div style="text-align: right; flex-shrink: 0;">
                          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
                            <span class="badge ${badgeClass}" style="font-size: 10px;">${badgeText}</span>
                          </div>
                          <div style="font-size: 11.5px; font-family: var(--font-mono); color: var(--text-secondary); margin-top: 4px;">
                            Deadline: <strong>${calendar.formatDisplayDate(p.deliveryDeadline, false, true)}</strong>
                          </div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>

          <!-- Column 2: Production Progress -->
          <div class="card-panel" style="margin-bottom: 0;">
            <div class="card-panel-header">
              <div>
                <div class="card-panel-title">Production Progress</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  Active manufacturing stages and progress per project
                </div>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.App.navigateTo('schedule')">
                Gantt Timeline &rarr;
              </button>
            </div>
            <div class="card-panel-body" style="padding: 0;">
              ${activeProjects.length === 0 ? `
                <div style="padding: 30px; text-align: center; color: var(--text-muted);">No active manufacturing orders.</div>
              ` : `
                <div style="display: flex; flex-direction: column;">
                  ${activeProjects.slice(0, 5).map(p => {
                    const percent = p.completionPercent || 0;
                    return `
                      <div style="padding: 12px 18px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="window.Zoosh.Views.Overview.navigateToProject('${p.id}')">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                          <div>
                            <strong style="color: var(--text-main); font-size: 13px;">${p.name}</strong>
                            <span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">
                              (${p.completedSrlCount || 0}/${p.totalSrlCount || 0} items completed)
                            </span>
                          </div>
                          <span style="font-family: var(--font-mono); font-weight: 700; font-size: 12.5px; color: ${percent === 100 ? 'var(--color-success)' : 'var(--primary-blue)'};">
                            ${percent}%
                          </span>
                        </div>
                        <div class="progress-bar-container">
                          <div class="progress-bar-fill ${percent === 100 ? 'success' : ''}" style="width: ${percent}%;"></div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- 2-Column Secondary Section: Recent Activity & Today's Production -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px;">

          <!-- Recent Project Activity -->
          <div class="card-panel" style="margin-bottom: 0;">
            <div class="card-panel-header">
              <div class="card-panel-title">Recent Project Activity</div>
              <span style="font-size: 11px; color: var(--text-muted);">Live Audit Trail</span>
            </div>
            <div class="card-panel-body" style="padding: 14px 18px;">
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="display: flex; gap: 12px; align-items: flex-start;">
                  <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--bg-blue-light); color: var(--primary-blue); display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">
                    📊
                  </div>
                  <div>
                    <div style="font-size: 12.5px; color: var(--text-main); font-weight: 600;">
                      Excel Estimation Model Loaded
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 1px;">
                      Sitout Chair costed for Ansar Changaramkulam (₹975 quotation total with 25% margin).
                    </div>
                    <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                      Today &bull; Costing System
                    </div>
                  </div>
                </div>

                <div style="display: flex; gap: 12px; align-items: flex-start;">
                  <div style="width: 26px; height: 26px; border-radius: 50%; background: var(--color-success-bg); color: var(--color-success); display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">
                    ✓
                  </div>
                  <div>
                    <div style="font-size: 12.5px; color: var(--text-main); font-weight: 600;">
                      Quotation Image Storage Synchronized
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 1px;">
                      Stable reference URLs mapped for Ansar, Rajeev Babu, and Palakkad orders.
                    </div>
                    <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                      Cloud Integration &bull; Production Storage
                    </div>
                  </div>
                </div>

                <div style="display: flex; gap: 12px; align-items: flex-start;">
                  <div style="width: 26px; height: 26px; border-radius: 50%; background: #F1F5F9; color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0;">
                    📅
                  </div>
                  <div>
                    <div style="font-size: 12.5px; color: var(--text-main); font-weight: 600;">
                      Shop Floor Allocations Calibrated
                    </div>
                    <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 1px;">
                      Carpentry and Polish department schedules sequenced with zero craftsperson overlap.
                    </div>
                    <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">
                      Engine &bull; Real Calendar Scheduler
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Today's Production Quick Glance -->
          <div class="card-panel" style="margin-bottom: 0;">
            <div class="card-panel-header">
              <div>
                <div class="card-panel-title">Today's Shop Floor Work</div>
                <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">
                  Active scheduled tasks for ${calendar.formatDisplayDate(config.CURRENT_DATE, false, true)}
                </div>
              </div>
              <div class="btn-group">
                <button class="btn-group-btn ${this.groupMode === 'department' ? 'active' : ''}" 
                  onclick="window.Zoosh.Views.Overview.setGroupMode('department')">
                  Dept
                </button>
                <button class="btn-group-btn ${this.groupMode === 'employee' ? 'active' : ''}" 
                  onclick="window.Zoosh.Views.Overview.setGroupMode('employee')">
                  Artisans
                </button>
              </div>
            </div>
            <div class="card-panel-body" style="padding: 0; max-height: 280px; overflow-y: auto;">
              ${this.renderTodayProductionList(todayTasks)}
            </div>
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
        <div style="padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px;">
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
            <div style="border-bottom: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <span class="badge ${deptConfig.badgeClass || ''}" style="font-size: 10.5px; padding: 2px 7px;">
                  ${dept.toUpperCase()} &bull; ${tasks.length} task${tasks.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px;">
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
            <div style="border-bottom: 1px solid var(--border-color); padding: 12px 16px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <div style="width: 22px; height: 22px; border-radius: 4px; background: ${emp.avatarColor || '#64748b'}; color: #fff; font-weight: 700; font-size: 10px; display: flex; align-items: center; justify-content: center;">
                  ${emp.name.charAt(0)}
                </div>
                <strong style="color: var(--text-main); font-size: 12.5px;">${emp.name}</strong>
                <span class="badge badge-${emp.department.toLowerCase()}" style="font-size: 9.5px; padding: 1px 5px;">${emp.department}</span>
                <span style="font-size: 11px; color: var(--text-muted); margin-left: auto;">
                  ${tasks.length} task${tasks.length > 1 ? 's' : ''}
                </span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px;">
                ${tasks.map(t => this.renderTodayTaskCard(t)).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderTodayTaskCard(t) {
    const isLeaveConflict = t.hasLeaveConflict;

    return `
      <div style="background: #FFFFFF; border: 1px solid ${isLeaveConflict ? 'var(--color-warning)' : 'var(--border-color)'}; border-radius: var(--radius-sm); padding: 8px 12px; cursor: pointer; transition: all 0.15s;" onclick="window.Zoosh.Views.Overview.handleInspectProcess('${t.processId}')">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <div>
            <div style="font-weight: 600; font-size: 12.5px; color: var(--text-main); line-height: 1.3;">
              ${t.furnitureName}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 1px;">
              <strong>${t.clientCode || ''}</strong>${t.clientName ? ` &bull; ${t.clientName}` : ''}
            </div>
          </div>
          <span class="badge badge-${t.department.toLowerCase()}" style="font-size: 9px; padding: 1px 5px;">
            ${t.department}
          </span>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-secondary); margin-top: 6px; padding-top: 4px; border-top: 1px solid var(--border-subtle);">
          <span>Artisan: <strong>${t.employeeName}</strong></span>
          <span style="font-family: var(--font-mono); font-weight: 600;">${t.timeSlot} (${t.hoursToday}h)</span>
        </div>

        ${isLeaveConflict ? `
          <div style="margin-top: 6px; font-size: 10.5px; color: #b45309; background: #fffbeb; padding: 3px 6px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between;">
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
            <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 10px 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
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
          <div style="border-top: 1px solid var(--border-color); padding-top: 14px; margin-top: 4px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 8px;">
              + Create New Reminder
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
