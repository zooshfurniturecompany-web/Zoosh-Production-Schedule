/**
 * Production Schedule View — Real Calendar Gantt Engine
 * Proportional bars, People/Department/Project/Today views, Month/Week/Today zoom,
 * Sunday non-working background, Today indicator line.
 * 
 * Hierarchy:
 * Client/SRL -> Project -> Furniture Item -> Process -> Craftsperson -> Schedule
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Schedule = {
  viewMode: 'people',      // 'people' | 'department' | 'project' | 'today'
  zoomMode: 'month',       // 'today' | 'week' | 'month'
  currentYear: 2026,
  currentMonth: 8,         // 0-indexed (8 = September)
  centerDateStr: '2026-09-28',

  // Filters
  filterClient: 'ALL',
  filterProject: 'ALL',
  filterDepartment: 'ALL',
  filterEmployee: 'ALL',
  filterStatus: 'ALL',
  searchQuery: '',

  render(container) {
    if (typeof window !== 'undefined' && window.innerWidth <= 768 && !this.mobileInitialized) {
      this.zoomMode = 'today';
      this.mobileInitialized = true;
    }

    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthLabel = `${months[this.currentMonth]} ${this.currentYear}`;
    const auth = window.Zoosh.Auth;
    const canCreate = auth ? auth.canCreate() : true;

    container.innerHTML = `
      <!-- Desktop Header (>768px) -->
      <div class="view-header desktop-only" style="margin-bottom: 16px;">
        <div>
          <h2 class="view-header-title">Production Schedule</h2>
          <div class="view-header-subtitle">Real-time factory timeline &amp; forward process sequencing</div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="btn btn-secondary" onclick="window.Zoosh.Views.Overview.openRemindersModal()" title="View and add schedule reminders">
            🔔 Reminders ${(state.reminders || []).length > 0 ? `<span class="badge badge-primary" style="font-size: 10px; padding: 2px 6px; margin-left: 4px;">${(state.reminders || []).filter(r => r.status !== 'DONE').length}</span>` : ''}
          </button>
          ${canCreate ? `
            <button class="btn btn-primary" onclick="window.Zoosh.AddFurnitureWizard.open()">
              <span>+</span> Add Furniture
            </button>
          ` : `
            <span class="badge badge-upholstery" style="align-self: center;">
              👁️ Visitor Read-Only Mode
            </span>
          `}
        </div>
      </div>

      <!-- Mobile View Switcher (<768px) -->
      <div class="mobile-only" style="margin-bottom: 14px;">
        <div class="btn-group" style="width: 100%; display: flex;">
          <button class="btn-group-btn ${this.zoomMode === 'today' ? 'active' : ''}" style="flex: 1; text-align: center; padding: 8px 0; font-size: 13px;"
            onclick="window.Zoosh.Views.Schedule.setZoomMode('today')">
            Today
          </button>
          <button class="btn-group-btn ${this.zoomMode === 'week' ? 'active' : ''}" style="flex: 1; text-align: center; padding: 8px 0; font-size: 13px;"
            onclick="window.Zoosh.Views.Schedule.setZoomMode('week')">
            Week
          </button>
          <button class="btn-group-btn ${this.zoomMode === 'month' ? 'active' : ''}" style="flex: 1; text-align: center; padding: 8px 0; font-size: 13px;"
            onclick="window.Zoosh.Views.Schedule.setZoomMode('month')">
            Month
          </button>
        </div>
      </div>

      <div class="schedule-container">
        <!-- Desktop Controls Toolbar (>768px) -->
        <div class="schedule-toolbar desktop-only">
          <div class="schedule-toolbar-left">
            <!-- View Mode Switcher -->
            <div class="btn-group">
              <button class="btn-group-btn ${this.viewMode === 'people' ? 'active' : ''}" 
                onclick="window.Zoosh.Views.Schedule.setViewMode('people')">
                People View
              </button>
              <button class="btn-group-btn ${this.viewMode === 'department' ? 'active' : ''}" 
                onclick="window.Zoosh.Views.Schedule.setViewMode('department')">
                Department View
              </button>
              <button class="btn-group-btn ${this.viewMode === 'project' ? 'active' : ''}" 
                onclick="window.Zoosh.Views.Schedule.setViewMode('project')">
                Project View
              </button>
              <button class="btn-group-btn ${this.viewMode === 'today' ? 'active' : ''}" 
                onclick="window.Zoosh.Views.Schedule.setViewMode('today')">
                Today View
              </button>
            </div>

            <!-- Date Navigation -->
            <div class="date-nav-controls">
              <button class="nav-arrow-btn" onclick="window.Zoosh.Views.Schedule.navigateCalendar(-1)">&larr;</button>
              <div class="calendar-title-display">${currentMonthLabel}</div>
              <button class="nav-arrow-btn" onclick="window.Zoosh.Views.Schedule.navigateCalendar(1)">&rarr;</button>
              <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Schedule.goToToday()">Today</button>
            </div>
          </div>

          <div class="schedule-toolbar-right">
            <!-- Zoom Controls -->
            <div class="btn-group">
              <button class="btn-group-btn ${this.zoomMode === 'today' ? 'active' : ''}" 
                onclick="window.Zoosh.Views.Schedule.setZoomMode('today')">
                Today
              </button>
              <button class="btn-group-btn ${this.zoomMode === 'week' ? 'active' : ''}" 
                onclick="window.Zoosh.Views.Schedule.setZoomMode('week')">
                Week
              </button>
              <button class="btn-group-btn ${this.zoomMode === 'month' ? 'active' : ''}" 
                onclick="window.Zoosh.Views.Schedule.setZoomMode('month')">
                Month
              </button>
            </div>
          </div>
        </div>

        <!-- Filters Bar -->
        <div class="schedule-filters-bar ${this.zoomMode === 'today' ? 'desktop-only' : ''}">
          <input type="text" class="search-input-box" placeholder="🔍 Search Client, SRL, Furniture..." 
            value="${this.searchQuery}" 
            oninput="window.Zoosh.Views.Schedule.searchQuery = this.value; window.Zoosh.Views.Schedule.refreshGantt()" />

          ${this.renderFilterDropdowns()}
        </div>

        <!-- Gantt Viewport -->
        <div class="gantt-viewport" id="gantt-viewport-el">
          ${this.renderGanttGrid()}
        </div>
      </div>
    `;

    setTimeout(() => {
      const todayPin = document.getElementById('gantt-today-line-el');
      const viewport = document.getElementById('gantt-viewport-el');
      if (todayPin && viewport) {
        const offset = todayPin.offsetLeft - 350;
        if (offset > 0) viewport.scrollLeft = offset;
      }
    }, 50);
  },

  renderFilterDropdowns() {
    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;

    return `
      <select class="filter-select" onchange="window.Zoosh.Views.Schedule.filterClient = this.value; window.Zoosh.Views.Schedule.refreshGantt()">
        <option value="ALL">All Clients / SRL</option>
        ${(state.clients || []).map(c => `
          <option value="${c.id}" ${this.filterClient === c.id ? 'selected' : ''}>SRL ${c.srl} — ${c.name}</option>
        `).join('')}
      </select>

      <select class="filter-select" onchange="window.Zoosh.Views.Schedule.filterProject = this.value; window.Zoosh.Views.Schedule.refreshGantt()">
        <option value="ALL">All Projects</option>
        ${(state.projects || []).map(p => `
          <option value="${p.id}" ${this.filterProject === p.id ? 'selected' : ''}>${p.name}</option>
        `).join('')}
      </select>

      <select class="filter-select" onchange="window.Zoosh.Views.Schedule.filterDepartment = this.value; window.Zoosh.Views.Schedule.refreshGantt()">
        <option value="ALL">All Departments</option>
        ${Object.keys(config.DEPARTMENTS).map(d => `
          <option value="${d}" ${this.filterDepartment === d ? 'selected' : ''}>${d}</option>
        `).join('')}
      </select>

      <select class="filter-select" onchange="window.Zoosh.Views.Schedule.filterEmployee = this.value; window.Zoosh.Views.Schedule.refreshGantt()">
        <option value="ALL">All Employees</option>
        ${(state.employees || []).map(e => `
          <option value="${e.id}" ${this.filterEmployee === e.id ? 'selected' : ''}>${e.name}</option>
        `).join('')}
      </select>

      <select class="filter-select" onchange="window.Zoosh.Views.Schedule.filterStatus = this.value; window.Zoosh.Views.Schedule.refreshGantt()">
        <option value="ALL" ${this.filterStatus === 'ALL' ? 'selected' : ''}>All Statuses</option>
        <option value="IN_PROGRESS" ${this.filterStatus === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
        <option value="PENDING" ${this.filterStatus === 'PENDING' ? 'selected' : ''}>Pending</option>
        <option value="COMPLETED" ${this.filterStatus === 'COMPLETED' ? 'selected' : ''}>Completed</option>
      </select>
    `;
  },

  renderGanttGrid() {
    const calendar = window.Zoosh.Calendar;
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    let days = [];

    if (this.zoomMode === 'month') {
      days = calendar.getMonthDays(this.currentYear, this.currentMonth);
    } else if (this.zoomMode === 'week') {
      days = calendar.getWeekDays(this.centerDateStr);
    } else if (this.zoomMode === 'today') {
      if (isMobile) {
        return this.renderMobileTodayChronological();
      }
      return this.renderHourlyTodayGrid();
    }

    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const dayWidth = this.zoomMode === 'week' ? 120 : 56;
    const totalWidth = days.length * dayWidth;

    const todayIndex = days.findIndex(d => d.dateStr === config.CURRENT_DATE);
    const todayLeftPx = todayIndex !== -1 ? todayIndex * dayWidth + (dayWidth / 2) : -100;

    const rows = this.getGanttRows(state);

    return `
      ${isMobile ? `
        <div class="mobile-only" style="padding: 6px 12px; margin-bottom: 10px; background: #f1f5f9; border-radius: var(--radius-sm); font-size: 11px; color: var(--text-muted); text-align: center; border: 1px dashed var(--border-light);">
          👈 Swipe horizontally to navigate full factory Gantt timeline 👉
        </div>
      ` : ''}
      <div style="min-width: ${220 + totalWidth}px; position: relative;">
        <!-- Header -->
        <div class="gantt-header-row">
          <div class="gantt-label-col-header">
            ${this.viewMode === 'people' ? 'Craftsperson' : (this.viewMode === 'department' ? 'Department' : 'Project / SRL')}
          </div>
          <div class="gantt-timeline-header" style="width: ${totalWidth}px;">
            ${days.map(d => `
              <div class="gantt-day-col ${d.isSunday ? 'sunday' : ''} ${d.isToday ? 'today' : ''}" style="width: ${dayWidth}px; min-width: ${dayWidth}px;">
                <div class="day-col-weekday">${d.weekday}</div>
                <div class="day-col-number">${d.dayNumber}</div>
              </div>
            `).join('')}

            ${todayIndex !== -1 ? `
              <div class="gantt-today-line" id="gantt-today-line-el" style="left: ${todayLeftPx}px;">
                <div class="gantt-today-pin">TODAY</div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Rows -->
        <div style="position: relative;">
          ${rows.map(row => this.renderGanttRow(row, days, dayWidth, totalWidth)).join('')}
        </div>
      </div>
    `;
  },

  renderMobileTodayChronological() {
    const config = window.Zoosh.Config;
    const state = window.Zoosh.State.getState();
    const todayTasks = (state.computed && state.computed.todayTasks) || [];

    if (todayTasks.length === 0) {
      return `
        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 36px 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          <div style="font-size: 28px; margin-bottom: 8px;">📋</div>
          <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">No Tasks Scheduled Today</div>
          <div>All factory processes are either completed or scheduled for upcoming dates.</div>
        </div>
      `;
    }

    const sortedTasks = [...todayTasks].sort((a, b) => {
      return (a.timeStr || '').localeCompare(b.timeStr || '');
    });

    const timeBlocks = {};
    sortedTasks.forEach(task => {
      const blockKey = task.timeStr || 'Today Shift';
      if (!timeBlocks[blockKey]) {
        timeBlocks[blockKey] = [];
      }
      timeBlocks[blockKey].push(task);
    });

    return `
      <div style="padding: 4px 0 20px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-secondary);">
            📅 ${window.Zoosh.Calendar.formatDisplayDate(config.CURRENT_DATE, true, false)}
          </div>
          <span class="badge badge-success" style="font-size: 11px;">${sortedTasks.length} active tasks</span>
        </div>

        ${Object.entries(timeBlocks).map(([timeLabel, tasks]) => `
          <div class="mobile-schedule-timeblock">
            <div class="mobile-time-heading">
              <span>🕒 ${timeLabel}</span>
            </div>
            ${tasks.map(task => {
              const deptClass = `dept-${task.department.toLowerCase()}`;
              const srlLabel = task.clientSrl ? `SRL ${task.clientSrl}` : (task.srlNumber ? `SRL ${task.srlNumber}` : '');
              return `
                <div class="mobile-task-card ${deptClass}" onclick="window.Zoosh.Views.Schedule.inspectProcess('${task.processId}')">
                  <div class="mobile-task-card-header">
                    ${srlLabel ? `<span class="mobile-task-srl">${srlLabel}</span>` : '<span></span>'}
                    <span class="badge badge-${task.department.toLowerCase()}" style="font-size: 10px;">${task.department}</span>
                  </div>

                  <div class="mobile-task-title">${task.furnitureName}</div>

                  <div class="mobile-task-sub">
                    <span>👤 <strong>${task.employeeName}</strong></span>
                    <span>&bull;</span>
                    <span>${task.projectName}</span>
                  </div>

                  <div class="mobile-task-footer">
                    <span class="mobile-task-time">⏱️ ${task.hoursToday}h scheduled</span>
                    <span class="mobile-task-status-pill badge badge-${task.status === 'COMPLETED' ? 'success' : (task.status === 'IN_PROGRESS' ? 'info' : 'secondary')}">
                      ${task.status}
                    </span>
                  </div>

                  ${task.hasLeaveConflict ? `
                    <div style="margin-top: 8px; padding: 6px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: var(--radius-sm); font-size: 11.5px; color: #92400e; display: flex; align-items: center; justify-content: space-between;">
                      <span>⚠️ <strong>Leave Conflict:</strong> Worker on leave</span>
                      ${window.Zoosh.Auth && window.Zoosh.Auth.canEdit() ? `
                        <button style="border: none; background: transparent; color: #b45309; font-weight: 700; cursor: pointer; font-size: 11px;" onclick="event.stopPropagation(); window.Zoosh.ReallocateModal.open('${task.processId}')">
                          Reallocate &rarr;
                        </button>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  },

  renderHourlyTodayGrid() {
    const config = window.Zoosh.Config;
    const state = window.Zoosh.State.getState();
    const todayTasks = (state.computed && state.computed.todayTasks) || [];
    const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const hourColWidth = 100;
    const totalWidth = (hours.length - 1) * hourColWidth;

    const activeEmployees = (state.employees || []).filter(e => e.active);

    return `
      <div style="min-width: ${220 + totalWidth}px;">
        <div class="gantt-header-row">
          <div class="gantt-label-col-header">Employee (Today)</div>
          <div class="gantt-timeline-header" style="width: ${totalWidth}px;">
            ${hours.slice(0, -1).map(h => `
              <div class="gantt-hour-col" style="width: ${hourColWidth}px; min-width: ${hourColWidth}px; font-weight: 700; font-size: 11px; color: var(--text-muted); padding: 10px 4px;">
                ${String(h).padStart(2, '0')}:00
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          ${activeEmployees.map(emp => {
            const empTasks = todayTasks.filter(t => t.employeeId === emp.id);
            return `
              <div class="gantt-row">
                <div class="gantt-row-label">
                  <div class="row-label-primary">${emp.name}</div>
                  <div class="row-label-secondary">
                    <span class="badge badge-${emp.department.toLowerCase()}">${emp.department}</span>
                  </div>
                </div>
                <div class="gantt-row-track" style="width: ${totalWidth}px;">
                  ${hours.slice(0, -1).map(() => `
                    <div style="width: ${hourColWidth}px; border-right: 1px solid var(--border-subtle); height: 100%;"></div>
                  `).join('')}

                  ${empTasks.map(task => {
                    const proc = state.processes.find(p => p.id === task.processId);
                    const seg = (proc && proc.scheduledSegments || []).find(s => s.dateStr === config.CURRENT_DATE);
                    if (!seg) return '';

                    const startH = seg.startHour || 9;
                    const endH = seg.endHour || 17;
                    const leftPx = (startH - 9) * hourColWidth;
                    const widthPx = Math.max(30, (endH - startH) * hourColWidth - 4);
                    const srlLabel = task.clientSrl ? `SRL ${task.clientSrl}` : (task.srlNumber ? `SRL ${task.srlNumber}` : '');

                    return `
                      <div class="gantt-bar gantt-bar-${task.department.toLowerCase()} ${task.hasLeaveConflict ? 'conflict' : ''}" 
                        style="left: ${leftPx}px; width: ${widthPx}px;"
                        onclick="window.Zoosh.Views.Schedule.inspectProcess('${task.processId}')">
                        <span class="bar-title">${srlLabel ? srlLabel + ' &bull; ' : ''}${task.furnitureName}</span>
                        <span class="bar-duration-badge">${task.hoursToday}h</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  getGanttRows(state) {
    const processes = state.processes || [];
    const srlsMap = new Map((state.furniture || state.srls || []).map(s => [s.id, s]));
    const projectsMap = new Map((state.projects || []).map(p => [p.id, p]));
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    const filteredProcesses = processes.filter(proc => {
      const srl = srlsMap.get(proc.furnitureId || proc.srlId);
      const proj = srl ? projectsMap.get(srl.projectId) : null;
      const client = proj ? clientsMap.get(proj.clientId) : null;
      const emp = employeesMap.get(proc.employeeId);

      if (this.filterClient !== 'ALL' && (!proj || proj.clientId !== this.filterClient)) return false;
      if (this.filterProject !== 'ALL' && (!srl || srl.projectId !== this.filterProject)) return false;
      if (this.filterDepartment !== 'ALL' && proc.department !== this.filterDepartment) return false;
      if (this.filterEmployee !== 'ALL' && proc.employeeId !== this.filterEmployee) return false;
      if (this.filterStatus !== 'ALL' && proc.status !== this.filterStatus) return false;

      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const clientMatch = client && (String(client.srl).includes(q) || client.name.toLowerCase().includes(q));
        const srlMatch = srl && ((srl.name || srl.furnitureName || '').toLowerCase().includes(q));
        const empMatch = emp && emp.name.toLowerCase().includes(q);
        const projMatch = proj && proj.name.toLowerCase().includes(q);
        if (!clientMatch && !srlMatch && !empMatch && !projMatch) return false;
      }
      return true;
    });

    if (this.viewMode === 'people') {
      return (state.employees || []).filter(e => e.active).map(emp => ({
        id: emp.id,
        primaryLabel: emp.name,
        secondaryLabel: emp.department,
        badgeType: emp.department.toLowerCase(),
        processes: filteredProcesses.filter(p => p.employeeId === emp.id)
      }));
    } else if (this.viewMode === 'department') {
      const depts = Object.keys(window.Zoosh.Config.DEPARTMENTS);
      return depts.map(dept => ({
        id: dept,
        primaryLabel: dept,
        secondaryLabel: `${filteredProcesses.filter(p => p.department === dept).length} tasks`,
        badgeType: dept.toLowerCase(),
        processes: filteredProcesses.filter(p => p.department === dept)
      }));
    } else if (this.viewMode === 'project') {
      return (state.projects || []).map(proj => {
        const projItems = (state.furniture || state.srls || []).filter(s => s.projectId === proj.id);
        const projProcs = filteredProcesses.filter(p => p.projectId === proj.id);
        const client = clientsMap.get(proj.clientId);
        const clientSrl = client ? client.srl : (proj.clientSrl || '—');
        const clientName = client ? client.name : (proj.clientName || 'Client');

        return {
          id: proj.id,
          primaryLabel: proj.name,
          secondaryLabel: `${clientName} &bull; SRL ${clientSrl} &bull; ${projItems.length} Items`,
          badgeType: '',
          processes: projProcs
        };
      });
    }

    return [];
  },

  renderGanttRow(row, days, dayWidth, totalWidth) {
    const calendar = window.Zoosh.Calendar;
    const state = window.Zoosh.State.getState();
    const srlsMap = new Map((state.furniture || state.srls || []).map(s => [s.id, s]));
    const projectsMap = new Map((state.projects || []).map(p => [p.id, p]));
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    const firstDateStr = days[0].dateStr;
    const lastDateStr = days[days.length - 1].dateStr;

    return `
      <div class="gantt-row">
        <div class="gantt-row-label">
          <div class="row-label-primary">${row.primaryLabel}</div>
          <div class="row-label-secondary">
            ${row.badgeType ? `<span class="badge badge-${row.badgeType}">${row.secondaryLabel}</span>` : row.secondaryLabel}
          </div>
        </div>

        <div class="gantt-row-track" style="width: ${totalWidth}px;">
          ${days.map(d => `
            <div class="gantt-cell-bg ${d.isSunday ? 'sunday' : ''} ${d.isToday ? 'today' : ''}" style="width: ${dayWidth}px; min-width: ${dayWidth}px;"></div>
          `).join('')}

          ${row.processes.map(proc => {
            const srl = srlsMap.get(proc.furnitureId || proc.srlId);
            const proj = srl ? projectsMap.get(srl.projectId) : null;
            const client = proj ? clientsMap.get(proj.clientId) : null;
            const clientSrl = client ? client.srl : (proj ? proj.clientSrl : '—');
            const clientName = client ? client.name : (proj ? proj.clientName : 'Client');
            const emp = employeesMap.get(proc.employeeId);
            const itemName = srl ? (srl.name || srl.furnitureName) : 'Furniture';
            
            if (proc.calculatedEndDate < firstDateStr || proc.calculatedStartDate > lastDateStr) {
              return '';
            }

            const startDayIndex = days.findIndex(d => d.dateStr === proc.calculatedStartDate);
            let leftPx = 0;
            if (startDayIndex !== -1) {
              leftPx = startDayIndex * dayWidth;
            } else {
              const diff = calendar.diffCalendarDays(firstDateStr, proc.calculatedStartDate);
              leftPx = diff * dayWidth;
            }

            const spanDays = calendar.diffCalendarDays(proc.calculatedStartDate, proc.calculatedEndDate) + 1;
            const barWidth = Math.max(34, spanDays * dayWidth - 6);

            return `
              <div class="gantt-bar gantt-bar-${proc.department.toLowerCase()} ${proc.hasLeaveConflict ? 'conflict' : ''}" 
                style="left: ${Math.max(0, leftPx)}px; width: ${barWidth}px;"
                onclick="window.Zoosh.Views.Schedule.inspectProcess('${proc.id}')">
                
                <span class="bar-title">
                  <span style="font-size: 10px; background: rgba(0,0,0,0.15); padding: 1px 4px; border-radius: 2px;">
                    SRL ${clientSrl}
                  </span>
                  ${itemName}
                </span>

                <span class="bar-duration-badge">
                  ${proc.durationDays}d
                </span>

                <!-- Hover Tooltip -->
                <div class="gantt-tooltip">
                  <div style="font-weight: 700; margin-bottom: 2px;">${itemName} &bull; Client: ${clientName} (SRL ${clientSrl})</div>
                  <div style="color: #94a3b8; font-size: 11px;">Stage: ${proc.department} &bull; Artisan: ${emp ? emp.name : 'Unassigned'}</div>
                  <div style="margin-top: 4px; font-family: var(--font-mono); font-size: 11px;">
                    ${calendar.formatDisplayDate(proc.calculatedStartDate, false, false)} &rarr; ${calendar.formatDisplayDate(proc.calculatedEndDate, false, false)}
                  </div>
                  <div style="font-size: 11px; margin-top: 2px;">Duration: ${proc.durationDays} working days (${(parseFloat(proc.durationDays) || 1) * 8}h)</div>
                  ${proc.hasLeaveConflict ? '<div style="color: #f97316; font-weight: 700; margin-top: 4px;">⚠️ Artisan has approved leave! Click to reallocate.</div>' : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  setViewMode(mode) {
    this.viewMode = mode;
    this.render(document.getElementById('view-container'));
  },

  setZoomMode(mode) {
    this.zoomMode = mode;
    this.render(document.getElementById('view-container'));
  },

  navigateCalendar(deltaMonths) {
    this.currentMonth += deltaMonths;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear -= 1;
    } else if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear += 1;
    }
    this.render(document.getElementById('view-container'));
  },

  goToToday() {
    const config = window.Zoosh.Config;
    const parts = config.CURRENT_DATE.split('-');
    this.currentYear = parseInt(parts[0], 10);
    this.currentMonth = parseInt(parts[1], 10) - 1;
    this.centerDateStr = config.CURRENT_DATE;
    this.render(document.getElementById('view-container'));
  },

  refreshGantt() {
    const viewport = document.getElementById('gantt-viewport-el');
    if (viewport) {
      viewport.innerHTML = this.renderGanttGrid();
    }
  },

  inspectProcess(procId) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const proc = (state.processes || []).find(p => p.id === procId);
    if (!proc) return;

    const srl = (state.furniture || state.srls || []).find(s => s.id === (proc.furnitureId || proc.srlId));
    const emp = (state.employees || []).find(e => e.id === proc.employeeId);
    const project = (state.projects || []).find(p => p.id === proc.projectId);
    const client = project ? (state.clients || []).find(c => c.id === project.clientId) : null;
    const clientSrl = client ? client.srl : (project ? project.clientSrl : '—');
    const clientName = client ? client.name : (project ? project.clientName : 'Client');
    const itemName = srl ? (srl.name || srl.furnitureName) : 'Furniture Item';
    const auth = window.Zoosh.Auth;
    const canEdit = auth ? auth.canEdit() : true;

    const title = `Process Stage: ${proc.department} &bull; ${itemName}`;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--bg-hover); padding: 12px 16px; border-radius: var(--radius-sm); border-left: 4px solid var(--accent-blue);">
          <div style="font-weight: 700; font-size: 15px; color: var(--text-main);">
            ${itemName}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
            Client: <strong>${clientName}</strong> (SRL ${clientSrl}) &bull; Project: <strong>${project ? project.name : '—'}</strong>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
          <div>
            <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Department</span>
            <div><span class="badge badge-${proc.department.toLowerCase()}">${proc.department}</span></div>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Assigned Artisan</span>
            <div style="font-weight: 600;">${emp ? emp.name : 'Unassigned'}</div>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Calculated Start Date</span>
            <div style="font-family: var(--font-mono); font-weight: 600;">${calendar.formatDisplayDate(proc.calculatedStartDate, true, false)}</div>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Calculated Finish Date</span>
            <div style="font-family: var(--font-mono); font-weight: 600;">${calendar.formatDisplayDate(proc.calculatedEndDate, true, false)}</div>
          </div>
        </div>

        ${canEdit ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
            <div class="form-group">
              <label class="form-label">Production Status</label>
              <select id="inspect-proc-status" class="form-select" onchange="const prog = document.getElementById('inspect-proc-progress'); if (this.value === 'COMPLETED') prog.value = 100; else if (this.value === 'PENDING') prog.value = 0;">
                <option value="PENDING" ${proc.status === 'PENDING' ? 'selected' : ''}>PENDING</option>
                <option value="IN_PROGRESS" ${proc.status === 'IN_PROGRESS' ? 'selected' : ''}>IN_PROGRESS</option>
                <option value="COMPLETED" ${proc.status === 'COMPLETED' ? 'selected' : ''}>COMPLETED</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Progress (%)</label>
              <input type="number" min="0" max="100" class="form-input" id="inspect-proc-progress" value="${proc.progressPercent || 0}" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Duration (Days)</label>
              <div style="display: flex; align-items: center; gap: 8px;">
                <input type="number" step="0.25" min="0.25" max="30" class="form-input" id="inspect-proc-duration" value="${proc.durationDays}" />
                <span style="font-size: 12px; font-weight: 600; color: var(--text-secondary);">days</span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Manpower Units</label>
              <input type="number" step="0.5" min="0.5" class="form-input" id="inspect-proc-manpower" value="${proc.manpower !== undefined ? proc.manpower : (proc.durationDays || 1)}" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Reassign Craftsperson</label>
            <select id="inspect-proc-employee" class="form-select">
              ${(state.employees || []).filter(e => e.active).map(e => `
                <option value="${e.id}" ${e.id === proc.employeeId ? 'selected' : ''}>
                  ${e.name} (${e.department})
                </option>
              `).join('')}
            </select>
          </div>
        ` : `
          <div style="background: var(--bg-surface-secondary); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12px; color: var(--text-muted);">
            Status: <strong>${proc.status} (${proc.progressPercent || 0}%)</strong> &bull; Duration: <strong>${proc.durationDays} days</strong> &bull; Observer mode (read-only).
          </div>
        `}

        ${proc.hasLeaveConflict ? `
          <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12px; color: #92400e;">
            ⚠️ <strong>Leave Conflict:</strong> Assigned artisan has approved leave during this stage.
            ${canEdit ? `
              <div style="margin-top: 6px;">
                <button class="btn btn-sm btn-secondary" style="color: #b45309;" onclick="window.Zoosh.Modal.close(); window.Zoosh.ReallocateModal.open('${proc.id}')">
                  Open Smart Reallocation Wizard &rarr;
                </button>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;

    const footerHtml = canEdit ? `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Schedule.saveProcessEdit('${proc.id}')">
        Save &amp; Recalculate Schedule
      </button>
    ` : `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Close</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '550px');
  },

  saveProcessEdit(procId) {
    if (window.Zoosh.Auth) {
      window.Zoosh.Auth.assertPermission('edit');
    }

    const duration = parseFloat(document.getElementById('inspect-proc-duration').value) || 1;
    const employeeId = document.getElementById('inspect-proc-employee').value;
    const statusEl = document.getElementById('inspect-proc-status');
    const progEl = document.getElementById('inspect-proc-progress');
    const manEl = document.getElementById('inspect-proc-manpower');

    const updatePayload = {
      durationDays: duration,
      employeeId: employeeId
    };

    if (statusEl) {
      updatePayload.status = statusEl.value;
    }
    if (progEl) {
      let val = parseFloat(progEl.value) || 0;
      if (updatePayload.status === 'COMPLETED') val = 100;
      else if (updatePayload.status === 'PENDING') val = 0;
      updatePayload.progressPercent = Math.max(0, Math.min(100, val));
    }
    if (manEl) {
      updatePayload.manpower = parseFloat(manEl.value) || duration;
    }

    window.Zoosh.State.updateProcess(procId, updatePayload);

    window.Zoosh.Modal.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.showToast('Schedule & production progress recalculated.');
    }
  }
};
