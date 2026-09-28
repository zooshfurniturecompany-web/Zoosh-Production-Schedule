/**
 * Overview / Director Dashboard View
 * Live KPIs, Today's Production, and Actionable Factory Alerts
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
    const computed = state.computed || {};
    const auth = window.Zoosh.Auth;
    const canCreate = auth ? auth.canCreate() : true;
    const isVisitor = auth ? auth.isVisitor() : false;

    const projects = state.projects || [];
    const totalProjects = projects.length;
    const activeProjects = projects.filter(p => (p.completionPercent || 0) < 100).length;
    const atRiskProjects = projects.filter(p => p.deadlineStatus === 'AT_RISK').length;
    const delayedProjects = projects.filter(p => p.deadlineStatus === 'DELAYED').length;
    const totalEmployees = (state.employees || []).filter(e => e.active).length;
    const todayTasks = computed.todayTasks || [];
    const alerts = computed.alerts || [];

    const displayDateStr = calendar.formatDisplayDate(config.CURRENT_DATE, true, true);

    container.innerHTML = `
      <!-- Desktop View Header (>768px) -->
      <div class="view-header desktop-only">
        <div>
          <div style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted);">
            Good morning &bull; ${auth && auth.getSession() ? auth.getSession().displayName : 'Factory Control'}
          </div>
          <h2 class="view-header-title" style="margin-top: 2px;">Production Overview</h2>
          <div class="view-header-subtitle">${displayDateStr}</div>
        </div>
        <div style="display: flex; gap: 10px;">
          ${canCreate ? `
            <button class="btn btn-secondary" onclick="window.Zoosh.AddClientModal.open()">
              <span>+</span> New Client / SRL
            </button>
            <button class="btn btn-secondary" onclick="window.Zoosh.Views.Projects.openAddModal()">
              <span>+</span> New Project
            </button>
            <button class="btn btn-primary" onclick="window.Zoosh.AddFurnitureWizard.open()">
              <span>+</span> Add Furniture
            </button>
          ` : `
            <span class="badge badge-upholstery" style="align-self: center; font-size: 12px; padding: 6px 12px;">
              👁️ Visitor Read-Only Mode
            </span>
          `}
        </div>
      </div>

      <!-- Mobile Header & Actions (<768px) -->
      <div class="mobile-only" style="margin-bottom: 16px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between;">
          <div>
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted);">
              ${isVisitor ? 'Factory Observer (Read-Only)' : 'Factory Companion'}
            </div>
            <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main); margin: 2px 0;">Production Overview</h2>
            <div style="font-size: 12px; color: var(--text-secondary);">${displayDateStr}</div>
          </div>
        </div>
        ${canCreate ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-top: 12px;">
            <button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 7px 4px;" onclick="window.Zoosh.AddClientModal.open()">
              + Client/SRL
            </button>
            <button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 7px 4px;" onclick="window.Zoosh.Views.Projects.openAddModal()">
              + Project
            </button>
            <button class="btn btn-primary btn-sm" style="font-size: 11px; padding: 7px 4px;" onclick="window.Zoosh.AddFurnitureWizard.open()">
              + Furniture
            </button>
          </div>
        ` : `
          <div style="margin-top: 10px; padding: 6px 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; font-size: 11.5px; color: #1e40af;">
            👁️ Logged in as <strong>Visitor</strong>. System is in read-only observation mode.
          </div>
        `}
      </div>

      <!-- Mobile Swipeable Horizontal KPI Carousel (<768px) -->
      <div class="mobile-kpi-scroll mobile-only">
        <div class="mobile-kpi-card">
          <div class="metric-card-label">Total Projects</div>
          <div class="metric-card-value">${totalProjects}</div>
        </div>
        <div class="mobile-kpi-card">
          <div class="metric-card-label">Active Orders</div>
          <div class="metric-card-value" style="color: var(--accent-blue);">${activeProjects}</div>
        </div>
        <div class="mobile-kpi-card ${atRiskProjects > 0 ? 'warning' : ''}">
          <div class="metric-card-label">At Risk</div>
          <div class="metric-card-value">${atRiskProjects}</div>
        </div>
        <div class="mobile-kpi-card ${delayedProjects > 0 ? 'danger' : ''}">
          <div class="metric-card-label">Delayed</div>
          <div class="metric-card-value">${delayedProjects}</div>
        </div>
        <div class="mobile-kpi-card success">
          <div class="metric-card-label">Today's Tasks</div>
          <div class="metric-card-value">${todayTasks.length}</div>
        </div>
        <div class="mobile-kpi-card">
          <div class="metric-card-label">Employees</div>
          <div class="metric-card-value">${totalEmployees}</div>
        </div>
      </div>

      <!-- Mobile Today's Production Section (<768px) -->
      <div class="mobile-only" style="margin-bottom: 24px;">
        <div class="mobile-section-title">
          <span>Today's Production</span>
          <span style="font-size: 11px; font-weight: 500; color: var(--text-muted);">${todayTasks.length} active tasks</span>
        </div>

        <div style="display: flex; gap: 6px; margin: 8px 0 12px 0;">
          <button class="btn btn-sm ${this.groupMode === 'department' ? 'btn-primary' : 'btn-secondary'}" 
            style="flex: 1; font-size: 11px; padding: 6px;" 
            onclick="window.Zoosh.Views.Overview.setGroupMode('department')">
            By Department
          </button>
          <button class="btn btn-sm ${this.groupMode === 'employee' ? 'btn-primary' : 'btn-secondary'}" 
            style="flex: 1; font-size: 11px; padding: 6px;" 
            onclick="window.Zoosh.Views.Overview.setGroupMode('employee')">
            By Worker
          </button>
        </div>

        ${this.renderMobileTodayFeed(todayTasks)}
      </div>

      <!-- Mobile Needs Attention Section (<768px) -->
      ${alerts.length > 0 ? `
        <div class="mobile-only" style="margin-bottom: 24px;">
          <div class="mobile-section-title">
            <span>Needs Attention</span>
            <span class="badge badge-at-risk" style="font-size: 10px;">${alerts.length}</span>
          </div>
          <div class="mobile-needs-attention">
            ${alerts.map(a => `
              <div class="mobile-alert-card ${a.type === 'danger' ? 'danger' : ''}">
                <div class="mobile-alert-title">
                  <span>${a.type === 'danger' ? '🚨' : '⚠️'}</span>
                  <span>${a.title}</span>
                </div>
                <div class="mobile-alert-text">${a.message}</div>
                <div class="mobile-alert-action">
                  <button class="btn btn-sm ${a.type === 'danger' ? 'btn-danger' : 'btn-secondary'}" 
                    style="font-size: 11.5px; font-weight: 700;"
                    onclick="window.Zoosh.Views.Overview.handleAlertAction('${a.actionType}', '${a.targetId}')">
                    ${a.actionLabel} &rarr;
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Mobile Factory Sections Hub (<768px) -->
      <div class="mobile-only" style="margin-bottom: 24px;">
        <div class="mobile-section-title">
          <span>Factory Navigation</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div onclick="window.Zoosh.App.navigateTo('projects')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">📁</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Projects &amp; SRL</div>
            <div style="font-size: 11px; color: var(--text-muted);">${totalProjects} orders (${activeProjects} active)</div>
          </div>
          <div onclick="window.Zoosh.App.navigateTo('schedule')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">📅</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Schedule</div>
            <div style="font-size: 11px; color: var(--text-muted);">${todayTasks.length} active tasks today</div>
          </div>
          <div onclick="window.Zoosh.App.navigateTo('team')" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 12px 14px; box-shadow: var(--shadow-sm); cursor: pointer;">
            <div style="font-size: 20px; margin-bottom: 4px;">👥</div>
            <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Team</div>
            <div style="font-size: 11px; color: var(--text-muted);">${totalEmployees} active craftspeople</div>
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

      <!-- Desktop Live KPI Metric Cards (>768px) -->
      <div class="metrics-grid desktop-only">
        <div class="metric-card">
          <div class="metric-card-label">Total Projects</div>
          <div class="metric-card-value">${totalProjects}</div>
          <div class="metric-card-hint">All customer orders</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-label">Active Projects</div>
          <div class="metric-card-value" style="color: var(--accent-blue);">${activeProjects}</div>
          <div class="metric-card-hint">Currently on shop floor</div>
        </div>
        <div class="metric-card ${atRiskProjects > 0 ? 'warning' : ''}">
          <div class="metric-card-label">At Risk</div>
          <div class="metric-card-value">${atRiskProjects}</div>
          <div class="metric-card-hint">Within 2 days of deadline</div>
        </div>
        <div class="metric-card ${delayedProjects > 0 ? 'danger' : ''}">
          <div class="metric-card-label">Delayed</div>
          <div class="metric-card-value">${delayedProjects}</div>
          <div class="metric-card-hint">Past delivery target</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-label">Employees</div>
          <div class="metric-card-value">${totalEmployees}</div>
          <div class="metric-card-hint">Active craftspeople</div>
        </div>
        <div class="metric-card success">
          <div class="metric-card-label">Today's Tasks</div>
          <div class="metric-card-value">${todayTasks.length}</div>
          <div class="metric-card-hint">Live tasks scheduled today</div>
        </div>
      </div>

      <!-- Desktop Actionable Factory Alerts (>768px) -->
      ${alerts.length > 0 ? `
        <div class="alerts-section desktop-only">
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

      <!-- Desktop Today's Production Live Board (>768px) -->
      <div class="card-panel desktop-only">
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
    `;
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
      const groups = {};
      todayTasks.forEach(task => {
        if (!groups[task.department]) groups[task.department] = [];
        groups[task.department].push(task);
      });

      return `
        <div style="display: flex; flex-direction: column;">
          ${Object.entries(groups).map(([dept, tasks]) => `
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge badge-${dept.toLowerCase()}">${dept}</span>
                  <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">(${tasks.length} active tasks)</span>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${tasks.map(t => this.renderTaskCard(t)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      const groups = {};
      todayTasks.forEach(task => {
        if (!groups[task.employeeName]) groups[task.employeeName] = [];
        groups[task.employeeName].push(task);
      });

      return `
        <div style="display: flex; flex-direction: column;">
          ${Object.entries(groups).map(([empName, tasks]) => `
            <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="width: 24px; height: 24px; border-radius: 50%; background: #0f172a; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;">
                  ${empName.charAt(0)}
                </div>
                <span style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">${empName}</span>
                <span style="font-size: 12px; color: var(--text-muted);">(${tasks.length} task${tasks.length > 1 ? 's' : ''})</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px;">
                ${tasks.map(t => this.renderTaskCard(t)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  },

  renderTaskCard(task) {
    const srlTag = task.clientSrl ? `SRL ${task.clientSrl}` : (task.srlNumber ? `SRL ${task.srlNumber}` : '');
    const clientName = task.clientName ? `${task.clientName} &bull; ` : '';

    return `
      <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px 14px; background: #ffffff; ${task.hasLeaveConflict ? 'border-left: 3px solid #f59e0b;' : ''}">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          ${srlTag ? `
            <span class="badge badge-primary" style="font-size: 11px; padding: 2px 7px;">
              ${srlTag}
            </span>
          ` : '<span></span>'}
          <span class="badge badge-${task.department.toLowerCase()}">${task.department}</span>
        </div>
        <div style="font-weight: 700; font-size: 14px; color: var(--text-main); margin-bottom: 2px;">
          ${task.furnitureName}
        </div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 10px;">
          ${clientName}${task.projectName} &bull; <strong>${task.employeeName}</strong>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; border-top: 1px solid var(--border-subtle); padding-top: 8px;">
          <span style="font-family: var(--font-mono); color: var(--text-secondary); font-weight: 600;">
            ${task.timeStr}
          </span>
          <span style="font-size: 11px; color: var(--text-muted);">${task.hoursToday}h scheduled</span>
        </div>
        ${task.hasLeaveConflict ? `
          <div style="margin-top: 8px; padding: 4px 8px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 3px; font-size: 11px; color: #92400e; display: flex; align-items: center; justify-content: space-between;">
            <span>⚠️ Worker on leave</span>
            ${window.Zoosh.Auth && window.Zoosh.Auth.canEdit() ? `
              <button style="border: none; background: transparent; color: #b45309; font-weight: 700; cursor: pointer;" onclick="window.Zoosh.ReallocateModal.open('${task.processId}')">
                Reallocate &rarr;
              </button>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  },

  renderMobileTodayFeed(todayTasks) {
    if (todayTasks.length === 0) {
      return `
        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No active tasks scheduled for today.
        </div>
      `;
    }

    return `
      <div class="mobile-today-feed">
        ${todayTasks.map(task => {
          const deptClass = `dept-${task.department.toLowerCase()}`;
          const srlTag = task.clientSrl ? `SRL ${task.clientSrl}` : (task.srlNumber ? `SRL ${task.srlNumber}` : '');
          return `
            <div class="mobile-task-card ${deptClass}" onclick="window.Zoosh.Views.Schedule.inspectProcess('${task.processId}')">
              <div class="mobile-task-card-header">
                ${srlTag ? `<span class="mobile-task-srl">${srlTag}</span>` : '<span></span>'}
                <span class="badge badge-${task.department.toLowerCase()}" style="font-size: 10px;">${task.department}</span>
              </div>
              
              <div class="mobile-task-title">${task.furnitureName}</div>
              
              <div class="mobile-task-sub">
                <span>👤 <strong>${task.employeeName}</strong></span>
                <span>&bull;</span>
                <span>${task.projectName}</span>
              </div>

              <div class="mobile-task-footer">
                <span class="mobile-task-time">${task.timeStr}</span>
                <span class="mobile-task-status-pill" style="color: ${task.status === 'COMPLETED' ? '#059669' : '#2563eb'};">
                  <span>●</span>
                  <span>${task.status === 'COMPLETED' ? 'COMPLETED' : 'IN PRODUCTION'}</span>
                </span>
              </div>

              ${task.hasLeaveConflict ? `
                <div style="margin-top: 10px; padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); font-size: 11px; color: #92400e; display: flex; align-items: center; justify-content: space-between;" onclick="event.stopPropagation();">
                  <span>⚠️ Worker on leave</span>
                  ${window.Zoosh.Auth && window.Zoosh.Auth.canEdit() ? `
                    <button class="btn btn-sm btn-accent" style="padding: 2px 8px; font-size: 10px;" onclick="window.Zoosh.ReallocateModal.open('${task.processId}')">
                      Reallocate &rarr;
                    </button>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
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
  }
};
