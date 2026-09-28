/**
 * Manpower & Capacity Management View
 * Production capacity control, leave scheduling, overtime authorizations,
 * and intelligent work reallocation.
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Manpower = {
  render(container) {
    const state = window.Zoosh.State.getState();
    const calendar = window.Zoosh.Calendar;
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));
    const records = state.manpowerRecords || [];
    const leaveConflicts = (state.computed && state.computed.leaveConflicts) || [];
    const auth = window.Zoosh.Auth;
    const canCreate = auth ? auth.canCreate() : true;
    const canEdit = auth ? auth.canEdit() : true;
    const canDelete = auth ? auth.canDelete() : true;

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-header-title">Manpower &amp; Capacity Control</h2>
          <div class="view-header-subtitle">Floor capacity, leave planning, overtime authorization, and bottleneck resolution</div>
        </div>
        ${canCreate ? `
          <button class="btn btn-primary" onclick="window.Zoosh.Views.Manpower.openAddModal()">
            <span>+</span> Add Capacity Event / Leave
          </button>
        ` : `
          <span class="badge badge-upholstery">👁️ Visitor Read-Only</span>
        `}
      </div>

      <!-- Active Conflicts Notice -->
      ${leaveConflicts.length > 0 ? `
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-left: 4px solid #f59e0b; padding: 16px 20px; border-radius: var(--radius-md); margin-bottom: 24px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: gap: 12px;">
            <div>
              <div style="font-weight: 700; color: #92400e; font-size: 14px;">
                ⚠️ Active Leave Collisions (${leaveConflicts.length} scheduled task${leaveConflicts.length > 1 ? 's' : ''} affected)
              </div>
              <div style="font-size: 12.5px; color: #78350f; margin-top: 3px;">
                Craftspeople with approved leave have tasks currently assigned to them during their absence.
              </div>
            </div>
          </div>

          <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 8px;">
            ${leaveConflicts.map(conf => `
              <div style="background: #ffffff; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid #fde68a; display: flex; align-items: center; justify-content: space-between;">
                <div style="font-size: 13px;">
                  <strong>${conf.employeeName}</strong> unavailable &bull; Affected: <strong>${conf.furnitureName} (Client: ${conf.clientName}, SRL: ${conf.srlNumber}, Dept: ${conf.department})</strong>
                </div>
                ${canEdit ? `
                  <button class="btn btn-accent btn-sm" onclick="window.Zoosh.ReallocateModal.open('${conf.processId}')">
                    Reallocate Work &rarr;
                  </button>
                ` : `
                  <span class="badge badge-delayed">Reallocation Required</span>
                `}
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Capacity & Leave Log Table -->
      <div class="card-panel">
        <div class="card-panel-header">
          <div class="card-panel-title">Capacity &amp; Unavailability Log</div>
          <div style="font-size: 12px; color: var(--text-muted);">${records.length} total event records</div>
        </div>
        <div class="card-panel-body" style="padding: 0;">
          ${records.length === 0 ? `
            <div style="padding: 40px; text-align: center; color: var(--text-muted);">
              No manpower records or leaves logged yet.
            </div>
          ` : `
            <div class="data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Action</th>
                    <th>From</th>
                    <th>Till</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Notes / Reason</th>
                    ${canDelete ? '<th>Actions</th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${records.map(rec => {
                    const emp = employeesMap.get(rec.employeeId);
                    const daysSpan = calendar.diffCalendarDays(rec.fromDate, rec.tillDate) + 1;
                    const hasConflict = leaveConflicts.some(c => c.employeeId === rec.employeeId);

                    return `
                      <tr>
                        <td style="font-weight: 700; color: var(--text-main);">
                          ${emp ? emp.name : 'Unknown'}
                        </td>
                        <td>
                          ${emp ? `<span class="badge badge-${emp.department.toLowerCase()}">${emp.department}</span>` : '—'}
                        </td>
                        <td>
                          <span style="font-weight: 700; font-size: 11.5px; padding: 2px 7px; border-radius: 4px; ${rec.action === 'LEAVE' ? 'background: #fef2f2; color: #b91c1c;' : 'background: #eff6ff; color: #1e40af;'}">
                            ${rec.action}
                          </span>
                        </td>
                        <td style="font-family: var(--font-mono); font-size: 12.5px;">
                          ${calendar.formatDisplayDate(rec.fromDate, false, false)}
                        </td>
                        <td style="font-family: var(--font-mono); font-size: 12.5px;">
                          ${calendar.formatDisplayDate(rec.tillDate, false, false)}
                        </td>
                        <td>${daysSpan} day${daysSpan > 1 ? 's' : ''}</td>
                        <td>
                          <span class="badge ${rec.status === 'APPROVED' ? 'badge-on-schedule' : 'badge-at-risk'}">
                            ${rec.status}
                          </span>
                        </td>
                        <td style="font-size: 12.5px; color: var(--text-secondary); max-width: 250px;">
                          ${rec.notes || '—'}
                        </td>
                        ${canDelete ? `
                          <td>
                            <div style="display: flex; gap: 6px; align-items: center;">
                              ${hasConflict && canEdit ? `
                                <button class="btn btn-sm btn-accent" onclick="window.Zoosh.Views.Manpower.reallocateForEmployee('${rec.employeeId}')">
                                  Reallocate
                                </button>
                              ` : ''}
                              <button class="btn btn-secondary btn-sm" style="color: #b91c1c;" onclick="window.Zoosh.Views.Manpower.deleteRecord('${rec.id}')">
                                Delete
                              </button>
                            </div>
                          </td>
                        ` : ''}
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

  reallocateForEmployee(empId) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canEdit()) {
      alert('Permission Denied: Only Managers can reallocate work.');
      return;
    }
    const state = window.Zoosh.State.getState();
    const conf = (state.computed && state.computed.leaveConflicts || []).find(c => c.employeeId === empId);
    if (conf) {
      window.Zoosh.ReallocateModal.open(conf.processId);
    } else {
      alert('No active scheduled conflicts for this employee.');
    }
  },

  openAddModal() {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canCreate()) {
      alert('Permission Denied: Only Managers can add manpower records.');
      return;
    }
    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const title = 'Log Manpower / Capacity Event';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Employee</label>
          <select id="manpower-emp-select" class="form-select">
            ${(state.employees || []).filter(e => e.active).map(e => `
              <option value="${e.id}">${e.name} (${e.department})</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Action Type</label>
          <select id="manpower-action-select" class="form-select">
            <option value="LEAVE">LEAVE (Unavailability)</option>
            <option value="OVERTIME">OVERTIME (+Extra Floor Hours)</option>
            <option value="JOIN">JOIN (New Onboarding)</option>
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">From Date</label>
            <input type="date" id="manpower-from-date" class="form-input" value="${config.CURRENT_DATE}" />
          </div>
          <div class="form-group">
            <label class="form-label">Till Date</label>
            <input type="date" id="manpower-till-date" class="form-input" value="${config.CURRENT_DATE}" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Status</label>
          <select id="manpower-status-select" class="form-select">
            <option value="APPROVED">APPROVED</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Reason / Notes</label>
          <input type="text" id="manpower-notes" class="form-input" placeholder="e.g. Family wedding, sick leave, overtime project rush..." />
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Manpower.submitAdd()">Save Event &amp; Check Impact</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml);
  },

  submitAdd() {
    const employeeId = document.getElementById('manpower-emp-select').value;
    const action = document.getElementById('manpower-action-select').value;
    const fromDate = document.getElementById('manpower-from-date').value;
    const tillDate = document.getElementById('manpower-till-date').value;
    const status = document.getElementById('manpower-status-select').value;
    const notes = document.getElementById('manpower-notes').value.trim();

    if (!fromDate || !tillDate) {
      alert('Please specify from and till dates.');
      return;
    }

    try {
      window.Zoosh.State.addManpowerRecord({
        employeeId,
        action,
        fromDate,
        tillDate,
        status,
        notes
      });

      window.Zoosh.Modal.close();

      const state = window.Zoosh.State.getState();
      const conf = (state.computed && state.computed.leaveConflicts || []).find(c => c.employeeId === employeeId);
      if (conf) {
        setTimeout(() => {
          window.Zoosh.ReallocateModal.open(conf.processId);
        }, 200);
      }
    } catch (err) {
      alert(err.message);
    }
  },

  deleteRecord(id) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canDelete()) {
      alert('Permission Denied: Only Managers can delete manpower records.');
      return;
    }
    if (confirm('Delete this manpower record? Schedule will automatically recalculate.')) {
      try {
        window.Zoosh.State.deleteManpowerRecord(id);
      } catch (err) {
        alert(err.message);
      }
    }
  }
};
