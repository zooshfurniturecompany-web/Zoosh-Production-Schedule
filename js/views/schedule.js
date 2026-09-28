/**
 * Production Schedule View — Real Calendar Gantt Engine
 * Proportional bars, People/Department/Project/Today views, Month/Week/Today zoom,
 * Sunday non-working background, Today indicator line.
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
  filterProject: 'ALL',
  filterDepartment: 'ALL',
  filterEmployee: 'ALL',
  filterStatus: 'ALL',
  searchQuery: '',

  render(container) {
    // If on mobile viewport, default to 'today' view mode
    if (typeof window !== 'undefined' && window.innerWidth <= 768 && !this.mobileInitialized) {
      this.zoomMode = 'today';
      this.mobileInitialized = true;
    }

    const calendar = window.Zoosh.Calendar;
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonthLabel = `${months[this.currentMonth]} ${this.currentYear}`;

    container.innerHTML = `
      <!-- Desktop Header (>768px) -->
      <div class="view-header desktop-only" style="margin-bottom: 16px;">
        <div>
          <h2 class="view-header-title">Production Schedule</h2>
          <div class="view-header-subtitle">Real-time factory timeline &amp; forward process sequencing</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary" onclick="window.Zoosh.AddSrlWizard.open()">
            <span>+</span> Add Furniture / SRL
          </button>
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

        <!-- Filters Bar (Shown on desktop or when week/month zoom active) -->
        <div class="schedule-filters-bar ${this.zoomMode === 'today' ? 'desktop-only' : ''}">
          <input type="text" class="search-input-box" placeholder="🔍 Search SRL, furniture, worker..." 
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

    // Auto-scroll horizontally towards today if month view
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
      // Single day, show hourly
      return this.renderHourlyTodayGrid();
    }

    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const dayWidth = this.zoomMode === 'week' ? 120 : 56; // pixel width per column
    const totalWidth = days.length * dayWidth;

    // Find today column index for vertical today line
    const todayIndex = days.findIndex(d => d.dateStr === config.CURRENT_DATE);
    const todayLeftPx = todayIndex !== -1 ? todayIndex * dayWidth + (dayWidth / 2) : -100;

    // Build Rows depending on viewMode (people, department, project)
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
            ${this.viewMode === 'people' ? 'Employee & Dept' : (this.viewMode === 'department' ? 'Department' : 'Project / SRL')}
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

    // Sort tasks chronologically by timeStr
    const sortedTasks = [...todayTasks].sort((a, b) => {
      return (a.timeStr || '').localeCompare(b.timeStr || '');
    });

    // Group tasks by timeblock
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
              return `
                <div class="mobile-task-card ${deptClass}" onclick="window.Zoosh.Views.Schedule.inspectProcess('${task.processId}')">
                  <div class="mobile-task-card-header">
                    <span class="mobile-task-srl">SRL ${task.srlNumber}</span>
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
                      <button style="border: none; background: transparent; color: #b45309; font-weight: 700; cursor: pointer; font-size: 11px;" onclick="event.stopPropagation(); window.Zoosh.ReallocateModal.open('${task.processId}')">
                        Reallocate &rarr;
                      </button>
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

    // Group tasks by employee
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));
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
                  ${hours.slice(0, -1).map(h => `
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

                    return `
                      <div class="gantt-bar gantt-bar-${task.department.toLowerCase()} ${task.hasLeaveConflict ? 'conflict' : ''}" 
                        style="left: ${leftPx}px; width: ${widthPx}px;"
                        onclick="window.Zoosh.Views.Schedule.inspectProcess('${task.processId}')">
                        <span class="bar-title">SRL ${task.srlNumber} &bull; ${task.furnitureName}</span>
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
    const srlsMap = new Map((state.srls || []).map(s => [s.id, s]));
    const projectsMap = new Map((state.projects || []).map(p => [p.id, p]));
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    // Filter processes by global filters
    const filteredProcesses = processes.filter(proc => {
      const srl = srlsMap.get(proc.srlId);
      const proj = srl ? projectsMap.get(srl.projectId) : null;
      const emp = employeesMap.get(proc.employeeId);

      if (this.filterProject !== 'ALL' && (!srl || srl.projectId !== this.filterProject)) return false;
      if (this.filterDepartment !== 'ALL' && proc.department !== this.filterDepartment) return false;
      if (this.filterEmployee !== 'ALL' && proc.employeeId !== this.filterEmployee) return false;
      if (this.filterStatus !== 'ALL' && proc.status !== this.filterStatus) return false;

      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        const srlMatch = srl && (String(srl.srlNumber).includes(q) || srl.furnitureName.toLowerCase().includes(q));
        const empMatch = emp && emp.name.toLowerCase().includes(q);
        const projMatch = proj && proj.name.toLowerCase().includes(q);
        if (!srlMatch && !empMatch && !projMatch) return false;
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
        const projSrls = (state.srls || []).filter(s => s.projectId === proj.id);
        const projProcs = filteredProcesses.filter(p => p.projectId === proj.id);
        return {
          id: proj.id,
          primaryLabel: proj.name,
          secondaryLabel: `${proj.clientName} &bull; ${projSrls.length} SRLs`,
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
    const srlsMap = new Map((state.srls || []).map(s => [s.id, s]));
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    // First and last day in view
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
          <!-- Day grid cells -->
          ${days.map(d => `
            <div class="gantt-cell-bg ${d.isSunday ? 'sunday' : ''} ${d.isToday ? 'today' : ''}" style="width: ${dayWidth}px; min-width: ${dayWidth}px;"></div>
          `).join('')}

          <!-- Process Bars -->
          ${row.processes.map(proc => {
            const srl = srlsMap.get(proc.srlId);
            const emp = employeesMap.get(proc.employeeId);
            
            // Check if process overlaps visible range
            if (proc.calculatedEndDate < firstDateStr || proc.calculatedStartDate > lastDateStr) {
              return '';
            }

            // Calculate start pixel relative to days[0]
            const startDayIndex = days.findIndex(d => d.dateStr === proc.calculatedStartDate);
            const endDayIndex = days.findIndex(d => d.dateStr === proc.calculatedEndDate);

            let leftPx = 0;
            if (startDayIndex !== -1) {
              leftPx = startDayIndex * dayWidth;
            } else {
              // Started before view
              const diff = calendar.diffCalendarDays(firstDateStr, proc.calculatedStartDate);
              leftPx = diff * dayWidth;
            }

            // Duration width: strictly proportional to duration and actual calendar span
            const spanDays = calendar.diffCalendarDays(proc.calculatedStartDate, proc.calculatedEndDate) + 1;
            const barWidth = Math.max(34, spanDays * dayWidth - 6);

            return `
              <div class="gantt-bar gantt-bar-${proc.department.toLowerCase()} ${proc.hasLeaveConflict ? 'conflict' : ''}" 
                style="left: ${Math.max(0, leftPx)}px; width: ${barWidth}px;"
                onclick="window.Zoosh.Views.Schedule.inspectProcess('${proc.id}')">
                
                <span class="bar-title">
                  <span style="font-size: 10px; background: rgba(0,0,0,0.1); padding: 1px 4px; border-radius: 2px;">
                    SRL ${srl ? srl.srlNumber : ''}
                  </span>
                  ${srl ? srl.furnitureName : ''}
                </span>

                <span class="bar-duration-badge">
                  ${proc.durationDays}d
                </span>

                <!-- Hover Tooltip -->
                <div class="gantt-tooltip">
                  <div style="font-weight: 700; margin-bottom: 2px;">SRL ${srl ? srl.srlNumber : ''} — ${srl ? srl.furnitureName : ''}</div>
                  <div style="color: #94a3b8; font-size: 11px;">Stage: ${proc.department} &bull; Worker: ${emp ? emp.name : 'Unassigned'}</div>
                  <div style="margin-top: 4px; font-family: var(--font-mono); font-size: 11px;">
                    ${calendar.formatDisplayDate(proc.calculatedStartDate, false, false)} &rarr; ${calendar.formatDisplayDate(proc.calculatedEndDate, false, false)}
                  </div>
                  <div style="font-size: 11px; margin-top: 2px;">Duration: ${proc.durationDays} working days (${(parseFloat(proc.durationDays) || 1) * 8}h)</div>
                  ${proc.hasLeaveConflict ? '<div style="color: #f97316; font-weight: 700; margin-top: 4px;">⚠️ Worker has approved leave! Click to reallocate.</div>' : ''}
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

    const srl = (state.srls || []).find(s => s.id === proc.srlId);
    const emp = (state.employees || []).find(e => e.id === proc.employeeId);
    const project = (state.projects || []).find(p => p.id === proc.projectId);

    const title = `Process Stage: ${proc.department} (SRL ${srl ? srl.srlNumber : '—'})`;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div style="background: var(--bg-hover); padding: 12px 16px; border-radius: var(--radius-sm); border-left: 4px solid var(--accent-blue);">
          <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">
            SRL ${srl ? srl.srlNumber : ''} — ${srl ? srl.furnitureName : 'Furniture'}
          </div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
            Project: <strong>${project ? project.name : '—'}</strong> (Deadline: ${project ? project.deliveryDeadline : '—'})
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
          <div>
            <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Department</span>
            <div><span class="badge badge-${proc.department.toLowerCase()}">${proc.department}</span></div>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Assigned Craftsperson</span>
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

        <div class="form-group" style="margin-top: 8px;">
          <label class="form-label">Duration (Days)</label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="number" step="0.25" min="0.25" max="30" class="form-input" id="inspect-proc-duration" value="${proc.durationDays}" />
            <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">days</span>
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

        ${proc.hasLeaveConflict ? `
          <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 12px; color: #92400e;">
            ⚠️ <strong>Leave Conflict:</strong> Assigned employee has approved leave during this stage.
            <div style="margin-top: 6px;">
              <button class="btn btn-sm btn-secondary" style="color: #b45309;" onclick="window.Zoosh.Modal.close(); window.Zoosh.ReallocateModal.open('${proc.id}')">
                Open Smart Reallocation Wizard &rarr;
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Schedule.saveProcessEdit('${proc.id}')">
        Save &amp; Recalculate Schedule
      </button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '550px');
  },

  saveProcessEdit(procId) {
    const duration = parseFloat(document.getElementById('inspect-proc-duration').value) || 1;
    const employeeId = document.getElementById('inspect-proc-employee').value;

    window.Zoosh.State.updateProcess(procId, {
      durationDays: duration,
      employeeId: employeeId
    });

    window.Zoosh.Modal.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.showToast('Schedule recalculated and dependencies updated.');
    }
  }
};
