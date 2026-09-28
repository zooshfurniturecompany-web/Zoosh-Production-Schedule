/**
 * Smart Employee Allocation & Reallocation Engine
 * Evaluates department qualifications, current workload queue, leave records,
 * seniority, and overtime readiness to suggest the optimal employee.
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.Allocator = {
  /**
   * Evaluates all candidates for a specific department and suggests the best employee.
   * 
   * @param {string} department 'Carpentry' | 'Polish' | 'Upholstery' | 'Metal' | 'Turning'
   * @param {string} [startDateStr] Proposed start date (default current date)
   * @param {number} [durationDays] Duration in days
   * @param {string} [excludeEmployeeId] Optional employee to exclude (e.g., currently on leave)
   * @returns {Object} { suggestedEmployee, rankedCandidates, rationale }
   */
  suggestEmployee(department, startDateStr, durationDays = 1, excludeEmployeeId = null) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const config = window.Zoosh.Config;
    const targetStart = startDateStr || config.CURRENT_DATE;

    // 1. Find all active employees matching department or secondary department
    const candidates = (state.employees || []).filter(emp => {
      if (!emp.active) return false;
      if (excludeEmployeeId && emp.id === excludeEmployeeId) return false;
      const isPrimary = emp.department === department;
      const isSecondary = (emp.secondaryDepartments || []).includes(department);
      return isPrimary || isSecondary;
    });

    if (candidates.length === 0) {
      // Fallback: any active employee in emergency
      const anyActive = (state.employees || []).filter(e => e.active && e.id !== excludeEmployeeId);
      return {
        suggestedEmployee: anyActive[0] || null,
        rankedCandidates: [],
        rationale: 'No employee specifically trained in ' + department + '. Fallback assigned.'
      };
    }

    // 2. Compute workload and availability scores for each candidate
    const scoredCandidates = candidates.map(emp => {
      // Check approved leaves for candidate
      const leaves = (state.manpowerRecords || []).filter(m => 
        m.employeeId === emp.id && m.action === 'LEAVE' && m.status === 'APPROVED'
      );
      
      const targetStartObj = calendar.parseDate(targetStart);
      const targetEndObj = calendar.addCalendarDays(targetStartObj, Math.ceil(durationDays));
      const targetStartStr = calendar.formatDate(targetStartObj);
      const targetEndStr = calendar.formatDate(targetEndObj);

      // Check if candidate is on leave during target period
      const hasLeaveOverlap = leaves.some(l => {
        return !(l.tillDate < targetStartStr || l.fromDate > targetEndStr);
      });

      // Calculate total pending days assigned to this employee
      const assignedProcesses = (state.processes || []).filter(p => 
        p.employeeId === emp.id && p.status !== 'COMPLETED'
      );
      
      const totalPendingDays = assignedProcesses.reduce((sum, p) => sum + (parseFloat(p.durationDays) || 1), 0);

      // Scoring criteria: Lower penalty is better!
      let penalty = 0;
      if (hasLeaveOverlap) penalty += 1000;
      if (emp.department !== department) penalty += 20;
      penalty += totalPendingDays * 10;
      if (emp.overtimeAvailable) penalty -= 5;

      // Experience bonus from joining date
      if (emp.joiningDate) {
        const joinDiff = calendar.diffCalendarDays(emp.joiningDate, config.CURRENT_DATE);
        penalty -= Math.min(20, Math.floor(joinDiff / 60)); // up to 20 pts bonus for seniority
      }

      return {
        employee: emp,
        penalty: penalty,
        hasLeaveOverlap: hasLeaveOverlap,
        totalPendingDays: totalPendingDays,
        isPrimaryDept: emp.department === department,
        overtimeAvailable: emp.overtimeAvailable
      };
    });

    // Sort by lowest penalty
    scoredCandidates.sort((a, b) => a.penalty - b.penalty);

    const winner = scoredCandidates[0].employee;
    let rationale = '';
    if (scoredCandidates[0].totalPendingDays === 0) {
      rationale = 'Lightest workload (currently 0 pending tasks) and fully available';
    } else {
      rationale = `Optimal balance: ${scoredCandidates[0].totalPendingDays} days in queue, available for schedule`;
    }

    return {
      suggestedEmployee: winner,
      rankedCandidates: scoredCandidates,
      rationale: rationale
    };
  },

  /**
   * Prepares a Reallocation Proposal for a process affected by leave or unavailability.
   * 
   * @param {string} processId 
   * @returns {Object|null} Reallocation proposal details
   */
  getReallocationPlan(processId) {
    const state = window.Zoosh.State.getState();
    const proc = (state.processes || []).find(p => p.id === processId);
    if (!proc) return null;

    const srl = (state.srls || state.furniture || []).find(s => s.id === (proc.furnitureId || proc.srlId));
    const project = (state.projects || []).find(p => p.id === proc.projectId);
    const client = project ? (state.clients || []).find(c => c.id === project.clientId) : null;
    const currentEmp = (state.employees || []).find(e => e.id === proc.employeeId);

    // Suggest replacement excluding current employee
    const suggestion = this.suggestEmployee(
      proc.department,
      proc.calculatedStartDate,
      proc.durationDays,
      proc.employeeId
    );

    const clientSrl = client ? client.srl : (project ? project.clientSrl : (srl ? srl.srlNumber : '—'));
    const clientName = client ? client.name : (project ? project.clientName : 'Client');
    const furnitureName = srl ? (srl.furnitureName || srl.name) : 'Furniture';

    return {
      processId: proc.id,
      furnitureId: proc.furnitureId || proc.srlId,
      srlId: proc.srlId,
      srlNumber: clientSrl,
      clientSrl: clientSrl,
      clientName: clientName,
      furnitureName: furnitureName,
      department: proc.department,
      durationDays: proc.durationDays,
      currentEmployee: currentEmp,
      replacementEmployee: suggestion.suggestedEmployee,
      allCandidates: suggestion.rankedCandidates,
      rationale: suggestion.rationale,
      projectName: project ? project.name : '—',
      projectDeadline: project ? project.deliveryDeadline : '—'
    };
  },

  /**
   * Execute the reallocation: update employee assignment and recalculate factory schedule.
   * 
   * @param {string} processId 
   * @param {string} newEmployeeId 
   * @returns {Object} result
   */
  applyReallocation(processId, newEmployeeId) {
    if (window.Zoosh.Auth && typeof window.Zoosh.Auth.assertPermission === 'function') {
      window.Zoosh.Auth.assertPermission('reallocate');
    }

    const state = window.Zoosh.State.getState();
    const proc = (state.processes || []).find(p => p.id === processId);
    if (!proc) return { success: false, message: 'Process not found' };

    const oldEmp = (state.employees || []).find(e => e.id === proc.employeeId);
    const newEmp = (state.employees || []).find(e => e.id === newEmployeeId);

    // Update assignment
    proc.employeeId = newEmployeeId;
    proc.hasLeaveConflict = false;

    // Trigger full state recalculation
    window.Zoosh.State.recalculate();

    return {
      success: true,
      message: `Reallocated SRL ${proc.srlId} (${proc.department}) from ${oldEmp ? oldEmp.name : 'Unknown'} to ${newEmp ? newEmp.name : 'New Employee'}. Schedule updated.`
    };
  }
};
