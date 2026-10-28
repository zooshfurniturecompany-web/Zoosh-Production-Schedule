/**
 * Real Production Scheduling Engine
 * Implements forward-pass scheduling, strict process dependencies,
 * resource constraint leveling, leave collision detection,
 * and fixed delivery deadline tracking.
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
    const currentDate = config.CURRENT_DATE || cloned.currentDate;

    // Ensure synchronized furniture / srls aliases across both legacy and modern collections
    const furnMap = new Map();
    (cloned.srls || []).forEach(f => { if (f && f.id) furnMap.set(f.id, f); });
    (cloned.furniture || []).forEach(f => { if (f && f.id) furnMap.set(f.id, f); });
    const allFurniture = Array.from(furnMap.values());
    cloned.furniture = allFurniture;
    cloned.srls = allFurniture;

    // 1. Build lookup tables
    const employeesMap = new Map((cloned.employees || []).map(e => [e.id, e]));
    const clientsMap = new Map((cloned.clients || []).map(c => [c.id, c]));
    const srlsMap = new Map((cloned.srls || cloned.furniture || []).map(s => [s.id, s]));
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

    // Employee cross-project active assignments tracker:
    // empId -> Array<{ projectId, processId, furnitureId, startDateStr, endDateStr, endHour, scheduledSegments }>
    const employeeProjectAssignments = new Map();

    /**
     * Resolves earliest working start date for an employee to strictly prevent
     * two different projects from being scheduled simultaneously for the same employee.
     * The employee must finish any currently assigned project process before starting a new one.
     */
    const resolveEarliestStartForEmployee = (requestedStartStr, duration, emp, currentProcessId, currentProjectId, currentFurnitureId) => {
      if (!emp) {
        let d = calendar.parseDate(requestedStartStr);
        while (calendar.isSunday(d)) d.setDate(d.getDate() + 1);
        return calendar.formatDate(d);
      }

      const empAssignments = employeeProjectAssignments.get(emp.id) || [];
      // Filter out self and check against all other commitments for this artisan
      const conflictingAssignments = empAssignments.filter(asgn => 
        asgn.processId !== currentProcessId
      );

      let candidateStartStr = requestedStartStr;
      let conflictFound = true;
      let safetyLoop = 0;

      while (conflictFound && safetyLoop < 60) {
        safetyLoop++;
        conflictFound = false;

        let checkDate = calendar.parseDate(candidateStartStr);
        while (calendar.isSunday(checkDate)) {
          checkDate.setDate(checkDate.getDate() + 1);
        }
        candidateStartStr = calendar.formatDate(checkDate);

        // Trial span without leave to evaluate working calendar occupancy
        const trialSpan = calendar.calculateWorkingSpan(candidateStartStr, duration, []);

        for (const other of conflictingAssignments) {
          // Check if trial span overlaps an existing project assignment
          const overlaps = !(trialSpan.endDateStr < other.startDateStr || trialSpan.startDateStr > other.endDateStr);
          if (overlaps) {
            conflictFound = true;
            // Advance candidateStartStr to the next working day after other assignment finishes
            let nextAvailable = calendar.parseDate(other.endDateStr);
            nextAvailable.setDate(nextAvailable.getDate() + 1);
            while (calendar.isSunday(nextAvailable)) {
              nextAvailable.setDate(nextAvailable.getDate() + 1);
            }
            candidateStartStr = calendar.formatDate(nextAvailable);
            break; // Re-evaluate against all assignments from the advanced date
          }
        }
      }

      return candidateStartStr;
    };

    // 4. Process each Furniture Item / SRL in prioritized sequence
    const leaveConflicts = [];

    // Group processes by furniture/srl and sort by sequence
    const srlProcessesMap = new Map();
    (cloned.processes || []).forEach(proc => {
      const parentId = proc.furnitureId || proc.srlId;
      if (!srlProcessesMap.has(parentId)) {
        srlProcessesMap.set(parentId, []);
      }
      srlProcessesMap.get(parentId).push(proc);
    });

    // Sort furniture items by factory production priority:
    // 1. Completed items (historical baseline)
    // 2. Project confirmed date / item start date (earlier first)
    // 3. Project delivery deadline (earlier first)
    const prioritizedSrls = [...(cloned.srls || cloned.furniture || [])].sort((a, b) => {
      const projA = projectsMap.get(a.projectId);
      const projB = projectsMap.get(b.projectId);

      const aDone = a.status === 'COMPLETED' ? 0 : 1;
      const bDone = b.status === 'COMPLETED' ? 0 : 1;
      if (aDone !== bDone) return aDone - bDone;

      const dateA = a.startDate || (projA ? projA.confirmedDate : '') || currentDate;
      const dateB = b.startDate || (projB ? projB.confirmedDate : '') || currentDate;
      if (dateA !== dateB) return dateA.localeCompare(dateB);

      const deadA = projA ? (projA.deliveryDeadline || '9999-99-99') : '9999-99-99';
      const deadB = projB ? (projB.deliveryDeadline || '9999-99-99') : '9999-99-99';
      if (deadA !== deadB) return deadA.localeCompare(deadB);

      return (a.id || '').localeCompare(b.id || '');
    });

    // Schedule each item's processes (supports both structured DAG flows and legacy sequential flows)
    prioritizedSrls.forEach(srl => {
      const procs = srlProcessesMap.get(srl.id) || [];
      const proj = projectsMap.get(srl.projectId);
      const client = proj ? clientsMap.get(proj.clientId) : null;
      const clientSrl = client ? client.srl : (proj ? proj.clientSrl : (srl.srlNumber || '—'));
      const clientName = client ? client.name : (proj ? proj.clientName : 'Client');
      const furnitureName = srl.furnitureName || srl.name || 'Furniture Item';

      const hasExplicitStructure = procs.some(p => 
        (Array.isArray(p.dependencyIds) && p.dependencyIds.length > 0) || 
        p.lane === 2 || 
        p.relationType === 'PARALLEL'
      );

      if (!hasExplicitStructure) {
        // Legacy / Standard Linear Sequential Scheduling (100% backward compatible)
        procs.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
        let nextAvailableStart = srl.startDate || currentDate;

        procs.forEach((proc, idx) => {
          const emp = employeesMap.get(proc.employeeId);
          const duration = parseFloat(proc.durationDays) || 1;
          const leaveDates = emp && employeeLeavesMap.has(emp.id) ? Array.from(employeeLeavesMap.get(emp.id)) : [];

          // Determine earliest start date respecting previous assignments on other projects
          const actualStartStr = resolveEarliestStartForEmployee(nextAvailableStart, duration, emp, proc.id, srl.projectId, srl.id);

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
              furnitureId: srl.id,
              srlId: srl.id,
              srlNumber: clientSrl,
              clientSrl: clientSrl,
              clientName: clientName,
              furnitureName: furnitureName,
              projectName: proj ? proj.name : '—',
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

          // Record employee cross-project assignment & hours
          if (emp) {
            if (!employeeProjectAssignments.has(emp.id)) {
              employeeProjectAssignments.set(emp.id, []);
            }
            employeeProjectAssignments.get(emp.id).push({
              projectId: srl.projectId,
              furnitureId: srl.id,
              processId: proc.id,
              startDateStr: span.startDateStr,
              endDateStr: span.endDateStr,
              endHour: span.endHour,
              scheduledSegments: span.scheduledSegments
            });

            span.scheduledSegments.forEach(seg => {
              addEmpHours(emp.id, seg.dateStr, seg.hours);
            });
          }

          // Downstream dependency chaining
          const lastSeg = span.scheduledSegments[span.scheduledSegments.length - 1];
          if (lastSeg && lastSeg.endHour >= 17) {
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
      } else {
        // Structured Process Flow Scheduling (Supports DAG dependencies & parallel lanes)
        const itemProcMap = new Map(procs.map(p => [p.id, p]));
        const resolvedDeps = new Map();

        procs.forEach((p, idx) => {
          if (Array.isArray(p.dependencyIds) && p.dependencyIds.length > 0) {
            resolvedDeps.set(p.id, p.dependencyIds.filter(id => itemProcMap.has(id)));
          } else if (p.relationType === 'PARALLEL' && p.parallelWithId && itemProcMap.has(p.parallelWithId)) {
            const siblingDeps = resolvedDeps.get(p.parallelWithId) || [];
            resolvedDeps.set(p.id, [...siblingDeps]);
          } else if (idx > 0 && p.lane !== 2 && p.relationType !== 'START') {
            resolvedDeps.set(p.id, [procs[idx - 1].id]);
          } else {
            resolvedDeps.set(p.id, []);
          }
        });

        // Topological Sort (Kahn's Algorithm)
        const inDegree = new Map();
        const adjList = new Map();
        procs.forEach(p => {
          inDegree.set(p.id, 0);
          adjList.set(p.id, []);
        });

        procs.forEach(p => {
          const deps = resolvedDeps.get(p.id) || [];
          inDegree.set(p.id, deps.length);
          deps.forEach(depId => {
            if (adjList.has(depId)) {
              adjList.get(depId).push(p.id);
            }
          });
        });

        const queue = procs.filter(p => (inDegree.get(p.id) || 0) === 0);
        const scheduledOrder = [];

        while (queue.length > 0) {
          queue.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
          const curr = queue.shift();
          scheduledOrder.push(curr);

          const neighbors = adjList.get(curr.id) || [];
          neighbors.forEach(nId => {
            inDegree.set(nId, inDegree.get(nId) - 1);
            if (inDegree.get(nId) === 0) {
              const nProc = itemProcMap.get(nId);
              if (nProc) queue.push(nProc);
            }
          });
        }

        // If any remaining (e.g. cycle safeguard), append them
        procs.forEach(p => {
          if (!scheduledOrder.includes(p)) scheduledOrder.push(p);
        });

        // Schedule processes in topological order
        scheduledOrder.forEach(proc => {
          const emp = employeesMap.get(proc.employeeId);
          const duration = parseFloat(proc.durationDays) || 1;
          const leaveDates = emp && employeeLeavesMap.has(emp.id) ? Array.from(employeeLeavesMap.get(emp.id)) : [];
          const deps = resolvedDeps.get(proc.id) || [];

          let earliestStart = srl.startDate || currentDate;

          if (deps.length > 0) {
            deps.forEach(depId => {
              const pred = itemProcMap.get(depId);
              if (pred && pred.calculatedEndDate) {
                let predAvail;
                const lastSeg = pred.scheduledSegments && pred.scheduledSegments[pred.scheduledSegments.length - 1];
                if (lastSeg && lastSeg.endHour >= 17) {
                  let nextD = calendar.parseDate(lastSeg.dateStr);
                  nextD.setDate(nextD.getDate() + 1);
                  while (calendar.isSunday(nextD)) {
                    nextD.setDate(nextD.getDate() + 1);
                  }
                  predAvail = calendar.formatDate(nextD);
                } else if (lastSeg) {
                  predAvail = lastSeg.dateStr;
                } else {
                  predAvail = pred.calculatedEndDate;
                }

                if (predAvail > earliestStart) {
                  earliestStart = predAvail;
                }
              }
            });
          }

          // Determine earliest start date respecting dependencies AND previous assignments on other projects
          const actualStartStr = resolveEarliestStartForEmployee(earliestStart, duration, emp, proc.id, srl.projectId, srl.id);

          const span = calendar.calculateWorkingSpan(actualStartStr, duration, []);

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
              furnitureId: srl.id,
              srlId: srl.id,
              srlNumber: clientSrl,
              clientSrl: clientSrl,
              clientName: clientName,
              furnitureName: furnitureName,
              projectName: proj ? proj.name : '—',
              department: proc.department,
              employeeId: proc.employeeId,
              employeeName: emp ? emp.name : 'Unknown'
            });
          } else {
            proc.hasLeaveConflict = false;
          }

          proc.calculatedStartDate = span.startDateStr;
          proc.calculatedEndDate = span.endDateStr;
          proc.scheduledSegments = span.scheduledSegments;
          proc.endHour = span.endHour;

          // Record employee cross-project assignment & hours
          if (emp) {
            if (!employeeProjectAssignments.has(emp.id)) {
              employeeProjectAssignments.set(emp.id, []);
            }
            employeeProjectAssignments.get(emp.id).push({
              projectId: srl.projectId,
              furnitureId: srl.id,
              processId: proc.id,
              startDateStr: span.startDateStr,
              endDateStr: span.endDateStr,
              endHour: span.endHour,
              scheduledSegments: span.scheduledSegments
            });

            span.scheduledSegments.forEach(seg => {
              addEmpHours(emp.id, seg.dateStr, seg.hours);
            });
          }
        });
      }

      // Compute Furniture finish date & progress
      if (procs.length > 0) {
        let maxEndDate = procs[0].calculatedEndDate;
        procs.forEach(p => {
          if (p.calculatedEndDate && p.calculatedEndDate > maxEndDate) {
            maxEndDate = p.calculatedEndDate;
          }
        });
        srl.expectedFinishDate = maxEndDate;
        
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
    (cloned.projects || []).forEach(project => {
      const projSrls = (cloned.srls || []).filter(s => s.projectId === project.id);
      
      if (projSrls.length === 0) {
        project.projectedFinishDate = project.confirmedDate;
        project.deadlineStatus = 'ON_SCHEDULE';
        project.completionPercent = 0;
        return;
      }

      let maxFinish = projSrls[0].expectedFinishDate || project.confirmedDate;
      projSrls.forEach(s => {
        if (s.expectedFinishDate && s.expectedFinishDate > maxFinish) {
          maxFinish = s.expectedFinishDate;
        }
      });

      project.projectedFinishDate = maxFinish;

      const completion = this.calculateProjectCompletion(project, cloned.srls || cloned.furniture, cloned.processes);
      project.completionPercent = completion.percent;
      project.totalManpowerUnits = completion.totalUnits;
      project.completedManpowerUnits = completion.completedUnits;
      project.isCompleted = completion.isAllCompleted;

      const completedCount = projSrls.filter(s => s.status === 'COMPLETED').length;
      project.completedSrlCount = completedCount;
      project.totalSrlCount = projSrls.length;

      if (!project.deliveryDeadline) {
        project.deadlineStatus = 'ON_SCHEDULE';
        return;
      }

      const daysDiff = calendar.diffCalendarDays(project.projectedFinishDate, project.deliveryDeadline);
      
      if (daysDiff < 0) {
        project.deadlineStatus = 'DELAYED';
        project.daysOverdue = Math.abs(daysDiff);
      } else if (daysDiff <= config.DEADLINE_AT_RISK_MARGIN_DAYS) {
        project.deadlineStatus = 'AT_RISK';
        project.daysBuffer = daysDiff;
      } else {
        project.deadlineStatus = 'ON_SCHEDULE';
        project.daysBuffer = daysDiff;
      }
    });

    // 6. Identify Today's Production Tasks
    const todayTasks = [];
    (cloned.processes || []).forEach(proc => {
      const todaySeg = (proc.scheduledSegments || []).find(s => s.dateStr === currentDate);
      if (todaySeg) {
        const srl = srlsMap.get(proc.furnitureId || proc.srlId);
        const emp = employeesMap.get(proc.employeeId);
        const proj = srl ? projectsMap.get(srl.projectId) : null;
        const client = proj ? clientsMap.get(proj.clientId) : null;
        const clientSrl = client ? client.srl : (proj ? proj.clientSrl : (srl ? srl.srlNumber : '—'));
        const clientName = client ? client.name : (proj ? proj.clientName : 'Client');
        const furnitureName = srl ? (srl.furnitureName || srl.name) : 'Furniture';

        const startH = Math.floor(todaySeg.startHour);
        const startM = Math.round((todaySeg.startHour - startH) * 60);
        const endH = Math.floor(todaySeg.endHour);
        const endM = Math.round((todaySeg.endHour - endH) * 60);

        const timeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} → ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

        todayTasks.push({
          processId: proc.id,
          furnitureId: srl ? srl.id : proc.srlId,
          srlId: proc.srlId,
          srlNumber: clientSrl,
          clientSrl: clientSrl,
          clientName: clientName,
          furnitureName: furnitureName,
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
    (cloned.projects || []).forEach(p => {
      const client = clientsMap.get(p.clientId);
      const srlTag = client ? ` (Client: ${client.name}, SRL ${client.srl})` : '';
      if (p.deadlineStatus === 'DELAYED') {
        alerts.push({
          id: `alert_proj_delayed_${p.id}`,
          type: 'danger',
          title: `Project ${p.name}${srlTag} is DELAYED`,
          message: `Projected finish is ${p.projectedFinishDate}, which is ${p.daysOverdue} day(s) past the fixed delivery deadline (${p.deliveryDeadline}).`,
          actionType: 'VIEW_PROJECT',
          actionLabel: 'View Project',
          targetId: p.id
        });
      } else if (p.deadlineStatus === 'AT_RISK') {
        alerts.push({
          id: `alert_proj_risk_${p.id}`,
          type: 'warning',
          title: `Project ${p.name}${srlTag} may cross its deadline`,
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
        title: `${conf.employeeName} is on leave during scheduled work`,
        message: `Affected Item: ${conf.furnitureName} • Client: ${conf.clientName} (SRL ${conf.srlNumber}) • Project: ${conf.projectName} • Department: ${conf.department}. Reallocation required.`,
        actionType: 'REALLOCATE_WORK',
        actionLabel: 'Reallocate Work',
        targetId: conf.processId,
        metadata: conf
      });
    });

    // Alert 3: Department bottleneck check
    const deptWorkload = {};
    Object.keys(config.DEPARTMENTS).forEach(d => { deptWorkload[d] = 0; });
    (cloned.processes || []).forEach(p => {
      if (p.status !== 'COMPLETED') {
        deptWorkload[p.department] = (deptWorkload[p.department] || 0) + (parseFloat(p.durationDays) || 1);
      }
    });

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

    // Alert 4: Cross-project employee overlapping conflict validation
    const employeeOverlapConflicts = [];
    const empActiveProcs = new Map();

    (cloned.processes || []).forEach(p => {
      if (!p.employeeId || p.status === 'COMPLETED') return;
      if (!p.scheduledSegments || p.scheduledSegments.length === 0) return;
      if (!empActiveProcs.has(p.employeeId)) {
        empActiveProcs.set(p.employeeId, []);
      }
      empActiveProcs.get(p.employeeId).push(p);
    });

    empActiveProcs.forEach((procsList, empId) => {
      const emp = employeesMap.get(empId);
      for (let i = 0; i < procsList.length; i++) {
        for (let j = i + 1; j < procsList.length; j++) {
          const p1 = procsList[i];
          const p2 = procsList[j];
          if (p1.id === p2.id || (p1.projectId === p2.projectId && (p1.furnitureId || p1.srlId) === (p2.furnitureId || p2.srlId))) continue;

          const p1Dates = new Set((p1.scheduledSegments || []).map(s => s.dateStr));
          const overlappingDates = (p2.scheduledSegments || []).map(s => s.dateStr).filter(d => p1Dates.has(d));

          if (overlappingDates.length > 0) {
            p1.hasOverlapConflict = true;
            p2.hasOverlapConflict = true;

            const proj1 = projectsMap.get(p1.projectId);
            const proj2 = projectsMap.get(p2.projectId);
            const srl1 = srlsMap.get(p1.furnitureId || p1.srlId);
            const srl2 = srlsMap.get(p2.furnitureId || p2.srlId);

            employeeOverlapConflicts.push({
              employeeId: empId,
              employeeName: emp ? emp.name : 'Unknown',
              process1Id: p1.id,
              process2Id: p2.id,
              project1Name: proj1 ? proj1.name : 'Project 1',
              project2Name: proj2 ? proj2.name : 'Project 2',
              furniture1Name: srl1 ? (srl1.name || srl1.furnitureName) : 'Item 1',
              furniture2Name: srl2 ? (srl2.name || srl2.furnitureName) : 'Item 2',
              overlappingDates: overlappingDates
            });
          }
        }
      }
    });

    employeeOverlapConflicts.forEach(conf => {
      alerts.push({
        id: `alert_overlap_${conf.employeeId}_${conf.process1Id}_${conf.process2Id}`,
        type: 'danger',
        title: `Overlapping Projects Conflict: ${conf.employeeName}`,
        message: `${conf.employeeName} is assigned to two different projects simultaneously: "${conf.project1Name}" and "${conf.project2Name}" on ${conf.overlappingDates.join(', ')}. Work must be rescheduled or reallocated.`,
        actionType: 'REALLOCATE_WORK',
        actionLabel: 'Reallocate Work',
        targetId: conf.process2Id,
        metadata: conf
      });
    });

    const totalProjects = this.calculateTotalProjects(cloned, currentDate);
    const employeeCounts = this.calculateEmployeeCounts(cloned);
    const todaysReminders = this.getTodaysReminders(cloned, currentDate);

    cloned.computed = {
      leaveConflicts,
      employeeOverlapConflicts,
      todayTasks,
      alerts,
      deptWorkload,
      totalProjects,
      employeeCounts,
      todaysReminders,
      projectStatuses: totalProjects.projectStatuses
    };

    return cloned;
  },

  /**
   * Calculate real manpower-weighted progress percentage for a project
   * Formula: (Completed Manpower Units / Total Required Manpower Units) * 100
   */
  calculateProjectCompletion(project, allFurniture, allProcesses) {
    if (!project) return { percent: 0, totalUnits: 0, completedUnits: 0, isAllCompleted: false };

    const furnItems = (allFurniture || []).filter(f => f.projectId === project.id);
    if (furnItems.length === 0) {
      return { percent: 0, totalUnits: 0, completedUnits: 0, isAllCompleted: false };
    }

    const furnIds = new Set(furnItems.map(f => f.id));
    const procs = (allProcesses || []).filter(p => furnIds.has(p.furnitureId || p.srlId));
    if (procs.length === 0) {
      return { percent: 0, totalUnits: 0, completedUnits: 0, isAllCompleted: false };
    }

    let totalUnits = 0;
    let completedUnits = 0;
    let allCompleted = true;

    procs.forEach(p => {
      const req = parseFloat(p.manpower !== undefined ? p.manpower : (p.manpowerUnits !== undefined ? p.manpowerUnits : p.durationDays)) || 1;
      totalUnits += req;

      if (p.status === 'COMPLETED') {
        completedUnits += req;
      } else {
        allCompleted = false;
        if (p.status === 'IN_PROGRESS') {
          const prog = Math.max(0, Math.min(100, parseFloat(p.progressPercent) || 0));
          completedUnits += req * (prog / 100);
        }
      }
    });

    let percent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
    percent = Math.max(0, Math.min(100, percent));
    if (allCompleted && procs.length > 0) {
      percent = 100;
    }

    return {
      percent,
      totalUnits,
      completedUnits: Math.round(completedUnits * 100) / 100,
      isAllCompleted: allCompleted && procs.length > 0
    };
  },

  /**
   * Calculate Total Projects count and breakdown (Active, Non Active, Completed)
   * Delivered projects are strictly excluded.
   */
  calculateTotalProjects(state, currentDate) {
    if (!state) return { total: 0, active: 0, nonActive: 0, completed: 0, projectStatuses: [] };

    const currDate = currentDate || state.currentDate || (window.Zoosh.Config ? window.Zoosh.Config.CURRENT_DATE : '2026-09-28');
    const allProjects = state.projects || [];
    const allFurniture = state.furniture || state.srls || [];
    const allProcesses = state.processes || [];

    // Filter out projects marked as Delivered
    const undeliveredProjects = allProjects.filter(p => !p.isDelivered && p.status !== 'DELIVERED' && !p.delivered);

    let activeCount = 0;
    let nonActiveCount = 0;
    let completedCount = 0;
    const projectStatuses = [];

    undeliveredProjects.forEach(project => {
      const completion = this.calculateProjectCompletion(project, allFurniture, allProcesses);
      const furnItems = allFurniture.filter(f => f.projectId === project.id);
      const furnIds = new Set(furnItems.map(f => f.id));
      const procs = allProcesses.filter(p => furnIds.has(p.furnitureId || p.srlId));

      let computedStatus = 'NON_ACTIVE';

      if (completion.isAllCompleted) {
        computedStatus = 'COMPLETED';
        completedCount++;
      } else {
        // Check if any process belonging to this project has scheduledSegment on currDate
        const hasWorkToday = procs.some(proc => 
          (proc.scheduledSegments || []).some(seg => seg.dateStr === currDate)
        );

        if (hasWorkToday) {
          computedStatus = 'ACTIVE';
          activeCount++;
        } else {
          computedStatus = 'NON_ACTIVE';
          nonActiveCount++;
        }
      }

      let displayName = project.name;
      if (project.location) {
        if (displayName.includes(' - ') || displayName.includes(' – ')) {
          displayName = displayName.replace(/\s*[-–]\s*/, ' – ');
        } else {
          displayName = `${project.name} – ${project.location}`;
        }
      }

      projectStatuses.push({
        id: project.id,
        name: project.name,
        location: project.location || '',
        displayName,
        percent: completion.percent,
        status: computedStatus,
        deliveryDeadline: project.deliveryDeadline,
        totalUnits: completion.totalUnits,
        completedUnits: completion.completedUnits
      });
    });

    return {
      total: undeliveredProjects.length,
      active: activeCount,
      nonActive: nonActiveCount,
      completed: completedCount,
      projectStatuses
    };
  },

  /**
   * Calculate active employees count and dynamic breakdown by department
   */
  calculateEmployeeCounts(state) {
    if (!state) return { total: 0, byDepartment: {} };

    const activeEmployees = (state.employees || []).filter(e => e.active !== false);
    const byDepartment = {};

    activeEmployees.forEach(e => {
      let dept = (e.department || 'Other').trim();
      if (dept.toLowerCase() === 'carpentry' || dept.toLowerCase() === 'carpenter') dept = 'Carpenter';
      else if (dept.toLowerCase() === 'polish' || dept.toLowerCase() === 'polishing') dept = 'Polishing';
      else if (dept.toLowerCase() === 'upholstery') dept = 'Upholstery';

      byDepartment[dept] = (byDepartment[dept] || 0) + 1;
    });

    return {
      total: activeEmployees.length,
      byDepartment
    };
  },

  /**
   * Surface operational reminders due on or before currentDate
   */
  getTodaysReminders(state, currentDate) {
    if (!state) return { total: 0, byType: {}, list: [] };

    const currDate = currentDate || state.currentDate || (window.Zoosh.Config ? window.Zoosh.Config.CURRENT_DATE : '2026-09-28');
    const reminders = state.reminders || [];

    const dueReminders = reminders.filter(r => {
      if (r.status === 'DONE') return false;
      if (!r.date) return true;
      return r.date <= currDate;
    });

    const byType = {};
    dueReminders.forEach(r => {
      const type = (r.type || 'Other').trim();
      byType[type] = (byType[type] || 0) + 1;
    });

    return {
      total: dueReminders.length,
      byType,
      list: dueReminders
    };
  },

  /**
   * Get timestamp of last real data mutation
   */
  getLastDataUpdatedAt(state) {
    return (state && state.lastDataUpdatedAt) || '2026-09-02T19:45:00.000Z';
  }
};
