/**
 * One-Click Smart Work Reallocation Modal
 * Resolves leave collisions and resource bottlenecks with instant cascading recalculation.
 * 
 * SRL belongs strictly to the Client/Customer.
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.ReallocateModal = {
  open(processId) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canEdit()) {
      alert('Permission Denied: Your role is Visitor (read-only) and cannot reallocate work.');
      return;
    }

    const plan = window.Zoosh.Allocator.getReallocationPlan(processId);
    if (!plan) {
      alert('Unable to load reallocation plan for this task.');
      return;
    }

    const title = `Reallocate Production Work — ${plan.furnitureName}`;
    const suggestedId = plan.replacementEmployee ? plan.replacementEmployee.id : '';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: var(--radius-sm);">
          <div style="font-weight: 700; color: #92400e; font-size: 13px;">
            ⚠️ Unavailability Conflict Detected
          </div>
          <div style="font-size: 12.5px; color: #78350f; margin-top: 2px;">
            <strong>${plan.currentEmployee ? plan.currentEmployee.name : 'Assigned Employee'}</strong> has approved leave during this scheduled stage.
          </div>
        </div>

        <div style="background: var(--bg-hover); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12.5px;">
            <div>
              <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Furniture Item:</span>
              <div style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">${plan.furnitureName}</div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Client: ${plan.clientName} (SRL ${plan.srlNumber})</div>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Project:</span>
              <div style="font-weight: 600; color: var(--text-main);">${plan.projectName}</div>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Stage:</span>
              <div><span class="badge badge-${plan.department.toLowerCase()}">${plan.department}</span> (${plan.durationDays} days)</div>
            </div>
            <div>
              <span style="color: var(--text-muted); font-size: 11px; text-transform: uppercase; font-weight: 700;">Project Deadline:</span>
              <div style="font-weight: 600; color: var(--text-main);">${plan.projectDeadline}</div>
            </div>
          </div>
        </div>

        <div>
          <label class="form-label">Suggested Replacement Craftsperson</label>
          <div style="font-size: 12px; color: #065f46; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 8px 12px; border-radius: var(--radius-sm); margin-bottom: 8px;">
            <strong>Recommendation Rationale:</strong> ${plan.rationale}
          </div>

          <select id="realloc-employee-select" class="form-select">
            ${plan.allCandidates.map(cand => `
              <option value="${cand.employee.id}" ${cand.employee.id === suggestedId ? 'selected' : ''}>
                ${cand.employee.name} (${cand.employee.department}) — ${cand.totalPendingDays}d in queue ${cand.employee.id === suggestedId ? '★ RECOMMENDED' : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">
          ℹ️ When you confirm, the system will immediately recalculate subsequent downstream processes, adjust the Gantt bars, and update delivery deadline tracking.
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.ReallocateModal.confirm('${plan.processId}')">
        Confirm Reallocation &rarr;
      </button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '550px');
  },

  confirm(processId) {
    const selectEl = document.getElementById('realloc-employee-select');
    if (!selectEl) return;
    const newEmployeeId = selectEl.value;

    try {
      const result = window.Zoosh.Allocator.applyReallocation(processId, newEmployeeId);
      window.Zoosh.Modal.close();

      if (window.Zoosh.App) {
        window.Zoosh.App.showToast(result.message || 'Work reallocated successfully!');
      }
    } catch (err) {
      alert(err.message);
    }
  }
};
