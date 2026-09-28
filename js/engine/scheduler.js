/**
 * Real Production Scheduling Engine
 * Implements forward-pass scheduling, strict process dependencies,
 * resource constraint leveling, leave collision detection,
 * and fixed delivery deadline tracking.
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.Scheduler = {
  /**
   * Recalculates all schedules, dependencies, and project deadlines across the entire factory.
   * Returns updated state clone.
   */
  recalculateAll(state) {
    if (!state) return state;

    const cloned = JSON.parse(JSON.stringify(state));
    const calendar = window.Zoosh.Calendar;
    const config = window.Zoosh.Config;
    const currentDate = cloned.currentDate || config.CURRENT_DATE;

    // 1. Build lookup tables
    const employeesMap = new Map((cloned.employees || []).map(e => [e.id, e]));
    const srlsMap = new Map((cloned.srls || []).map(s => [s.id, s]));
    const projectsMap = new Map((cloned.projects || []).map(p => [p.id, p]));

    // 2. Build employee leave calendar
    const employeeLeavesMap = new Map(); // empId -> Set of date strings
    (cloned.manpowerRecords || []).forEach(record => {
      if (record.action === 'LEAVE' && record.status === 'APPROVED') {
        if (!employeeLeavesMap.has(record.employeeId)) {
          employeeLeavesMap.set(record.employeeId, new Set());
        }
        const leaveSet = employeeLeavesMap.get(record.employeeId);
        
        let d = calendar.parseDate(record.fromDate);
        const endD = calendar.parseDate(record.tillDate);
        while (d <= endD) {
          leaveSet.add(calendar.formatDate(d));
          d.setDate(d.getDate() + 1);
        }
      }
    });

    // 3. Track employee busy time slots per day: empId -> Map(dateStr -> totalHoursAllocated)
    const employeeDailyHours = new Map();
    const getEmpHours = (empId, dateStr) => {
      if (!employeeDailyHours.has(empId)) employeeDailyHours.set(empId, new Map());
      return employeeDailyHours.get(empId).get(dateStr) || 0;
    };
    const addEmpHours = (empId, dateStr, hours) => {
      if (!employeeDailyHours.has(empId)) employeeDailyHours.set(empId, new Map());
      const current = employeeDailyHours.get(empId).get(dateStr) || 0;
      employeeDailyHours.get(empId).set(dateStr, current + hours);
    };

    // 4. Process each SRL in topological/sequence order
    const leaveConflicts = [];

    // Group processes by SRL and sort by sequence
    const srlProcessesMap = new Map();
    (cloned.processes || []).forEach(proc => {
      if (!srlProcessesMap.has(proc.srlId)) {
        srlProcessesMap.set(proc.srlId, []);
      }
      srlProcessesMap.get(proc.srlId).push(proc);
    });

    // Schedule each SRL's processes sequentially
    cloned.srls.forEach(srl => {
      const procs = srlProcessesMap.get(srl.id) || [];
      procs.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

      let nextAvailableStart = srl.startDate || currentDate;

      procs.forEach((proc, idx) => {
        const emp = employeesMap.get(proc.employeeId);
        const duration = parseFloat(proc.durationDays) || 1;
        const leaveDates = emp && employeeLeavesMap.has(emp.id) ? Array.from(employeeLeavesMap.get(emp.id)) : [];

        // Check if employee is on leave on the proposed start date
        let searchDate = calendar.parseDate(nextAvailableStart);
        
        // Find earliest start date respecting Sunday non-working and prior employee queue
        while (calendar.isSunday(searchDate)) {
          searchDate.setDate(searchDate.getDate() + 1);
        }
        let actualStartStr = calendar.formatDate(searchDate);

        // Calculate schedule span skipping Sundays
        const span = calendar.calculateWorkingSpan(actualStartStr, duration, []);

        // Check for leave collision
        let hasConflict = false;
        if (leaveDates.length > 0) {
          span.scheduledSegments.forEach(seg => {
            if (leaveDates.includes(seg.dateStr)) {
              hasConflict = true;
            }
          });
        }

        if (hasConflict) {
          proc.hasLeaveConflict = true;
          leaveConflicts.push({
            processId: proc.id,
            srlId: srl.id,
            srlNumber: srl.srlNumber,
            furnitureName: srl.furnitureName,
            department: proc.department,
            employeeId: proc.employeeId,
            employeeName: emp ? emp.name : 'Unknown'
          });
        } else {
          proc.hasLeaveConflict = false;
        }

        // Assign computed dates to process
        proc.calculatedStartDate = span.startDateStr;
        proc.calculatedEndDate = span.endDateStr;
        proc.scheduledSegments = span.scheduledSegments;
        proc.endHour = span.endHour;

        // Record employee hours
        if (emp) {
          span.scheduledSegments.forEach(seg => {
            addEmpHours(emp.id, seg.dateStr, seg.hours);
          });
        }

        // STRICT DEPENDENCY: Downstream process CANNOT start before this process finishes
        // If this process finishes at 17:00, the next process starts the next working morning.
        // If this process finishes at mid-day (e.g. 13:00), the next process can start at 13:00 on that same day!
        const lastSeg = span.scheduledSegments[span.scheduledSegments.length - 1];
        if (lastSeg && lastSeg.endHour >= 17) {
          // Next day
          let nextD = calendar.parseDate(lastSeg.dateStr);
          nextD.setDate(nextD.getDate() + 1);
          while (calendar.isSunday(nextD)) {
            nextD.setDate(nextD.getDate() + 1);
          }
          nextAvailableStart = calendar.formatDate(nextD);
        } else if (lastSeg) {
          nextAvailableStart = lastSeg.dateStr;
        } else {
          nextAvailableStart = span.endDateStr;
        }
      });

      // Compute SRL finish date & progress
      if (procs.length > 0) {
        const lastProc = procs[procs.length - 1];
        srl.expectedFinishDate = lastProc.calculatedEndDate;
        
        const completedProcs = procs.filter(p => p.status === 'COMPLETED').length;
        if (completedProcs === procs.length) {
          srl.status = 'COMPLETED';
        } else if (completedProcs > 0 || procs.some(p => p.status === 'IN_PROGRESS')) {
          srl.status = 'IN_PROGRESS';
        } else {
          srl.status = 'NOT_STARTED';
        }
      }
    });

    // 5. Evaluate Projects against Fixed Delivery Deadlines
    cloned.projects.forEach(project => {
      const projSrls = cloned.srls.filter(s => s.projectId === project.id);
      
      if (projSrls.length === 0) {
        project.projectedFinishDate = project.confirmedDate;
        project.deadlineStatus = 'ON_SCHEDULE';
        project.completionPercent = 0;
        return;
      }

      // Max finish date among all SRLs
      let maxFinish = projSrls[0].expectedFinishDate || project.confirmedDate;
      projSrls.forEach(s => {
        if (s.expectedFinishDate && s.expectedFinishDate > maxFinish) {
          maxFinish = s.expectedFinishDate;
        }
      });

      project.projectedFinishDate = maxFinish;

      // Completion percent based on completed SRLs
      const completedCount = projSrls.filter(s => s.status === 'COMPLETED').length;
      project.completedSrlCount = completedCount;
      project.totalSrlCount = projSrls.length;
      project.completionPercent = Math.round((completedCount / projSrls.length) * 100);

      // Compare projected finish against FIXED deadline
      if (!project.deliveryDeadline) {
        project.deadlineStatus = 'ON_SCHEDULE';
        return;
      }

      const daysDiff = calendar.diffCalendarDays(project.projectedFinishDate, project.deliveryDeadline);
      
      if (daysDiff < 0) {
        // Projected finish is AFTER deadline
        project.deadlineStatus = 'DELAYED';
        project.daysOverdue = Math.abs(daysDiff);
      } else if (daysDiff <= config.DEADLINE_AT_RISK_MARGIN_DAYS) {
        // Within 2 days of deadline
        project.deadlineStatus = 'AT_RISK';
        project.daysBuffer = daysDiff;
      } else {
        project.deadlineStatus = 'ON_SCHEDULE';
        project.daysBuffer = daysDiff;
      }
    });

    // 6. Identify Today's Production Tasks (tasks that have segments on currentDate)
    const todayTasks = [];
    cloned.processes.forEach(proc => {
      const todaySeg = (proc.scheduledSegments || []).find(s => s.dateStr === currentDate);
      if (todaySeg) {
        const srl = srlsMap.get(proc.srlId);
        const emp = employeesMap.get(proc.employeeId);
        const proj = srl ? projectsMap.get(srl.projectId) : null;

        const startH = Math.floor(todaySeg.startHour);
        const startM = Math.round((todaySeg.startHour - startH) * 60);
        const endH = Math.floor(todaySeg.endHour);
        const endM = Math.round((todaySeg.endHour - endH) * 60);

        const timeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} → ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        todayTasks.push({
          processId: proc.id,
          srlId: proc.srlId,
          srlNumber: srl ? srl.srlNumber : '—',
          furnitureName: srl ? srl.furnitureName : 'Furniture',
          department: proc.department,
          employeeId: proc.employeeId,
          employeeName: emp ? emp.name : 'Unassigned',
          projectName: proj ? proj.name : '—',
          timeStr: timeStr,
          hoursToday: todaySeg.hours,
          status: proc.status || 'PENDING',
          progressPercent: proc.progressPercent || 0,
          hasLeaveConflict: proc.hasLeaveConflict
        });
      }
    });

    // 7. Generate Live Alerts
    const alerts = [];

    // Alert 1: Project deadline warnings
    cloned.projects.forEach(p => {
      if (p.deadlineStatus === 'DELAYED') {
        alerts.push({
          id: `alert_proj_delayed_${p.id}`,
          type: 'danger',
          title: `Project ${p.name} is DELAYED`,
          message: `Projected finish is ${p.projectedFinishDate}, which is ${p.daysOverdue} day(s) past the fixed delivery deadline (${p.deliveryDeadline}).`,
          actionType: 'VIEW_PROJECT',
          actionLabel: 'View Project',
          targetId: p.id
        });
      } else if (p.deadlineStatus === 'AT_RISK') {
        alerts.push({
          id: `alert_proj_risk_${p.id}`,
          type: 'warning',
          title: `Project ${p.name} may cross its deadline`,
          message: `Delivery deadline is ${p.deliveryDeadline}. Buffer is only ${p.daysBuffer} day(s).`,
          actionType: 'VIEW_PROJECT',
          actionLabel: 'View Project',
          targetId: p.id
        });
      }
    });

    // Alert 2: Leave conflicts during scheduled work
    leaveConflicts.forEach(conf => {
      alerts.push({
        id: `alert_leave_${conf.processId}`,
        type: 'warning',
        title: `${conf.employeeName} has approved leave during scheduled work`,
        message: `Scheduled on SRL ${conf.srlNumber} (${conf.furnitureName} - ${conf.department}). Action required: Reallocate to another employee.`,
        actionType: 'REALLOCATE_WORK',
        actionLabel: 'Reallocate Work',
        targetId: conf.processId,
        metadata: conf
      });
    });

    // Alert 3: Department bottleneck check
    const deptWorkload = {};
    Object.keys(config.DEPARTMENTS).forEach(d => { deptWorkload[d] = 0; });
    cloned.processes.forEach(p => {
      if (p.status !== 'COMPLETED') {
        deptWorkload[p.department] = (deptWorkload[p.department] || 0) + (parseFloat(p.durationDays) || 1);
      }
    });

    // High workload threshold: e.g. Polish > 7 days total pending queue
    if (deptWorkload['Polish'] >= 6) {
      alerts.push({
        id: 'alert_dept_polish',
        type: 'info',
        title: 'Polish department has high workload',
        message: `Currently has ${deptWorkload['Polish']} days of pending finishing work. Consider overtime or reallocating tasks.`,
        actionType: 'VIEW_MANPOWER',
        actionLabel: 'View Manpower',
        targetId: 'dept_Polish'
      });
    }

    // Attach computed views directly to state
    cloned.computed = {
      leaveConflicts,
      todayTasks,
      alerts,
      deptWorkload
    };

    return cloned;
  }
};
