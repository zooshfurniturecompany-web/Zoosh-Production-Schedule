/**
 * Team / Employee Database View
 * Departments: Carpentry, Polish, Upholstery, Metal, Turning
 * Workload tracking, active status, joining dates, and overtime eligibility
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Team = {
  activeDeptFilter: 'ALL',

  render(container) {
    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const calendar = window.Zoosh.Calendar;
    let employees = state.employees || [];

    if (this.activeDeptFilter !== 'ALL') {
      employees = employees.filter(e => e.department === this.activeDeptFilter || (e.secondaryDepartments || []).includes(this.activeDeptFilter));
    }

    // Calculate current assigned days for each employee
    const workloadMap = new Map();
    (state.processes || []).forEach(p => {
      if (p.status !== 'COMPLETED') {
        const current = workloadMap.get(p.employeeId) || 0;
        workloadMap.set(p.employeeId, current + (parseFloat(p.durationDays) || 1));
      }
    });

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-header-title">Team &amp; Craftspeople</h2>
          <div class="view-header-subtitle">Factory capacity, skills database, and workload queue</div>
        </div>
        <button class="btn btn-primary" onclick="window.Zoosh.Views.Team.openAddModal()">
          <span>+</span> Add Employee
        </button>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
        <button class="btn btn-sm ${this.activeDeptFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.Zoosh.Views.Team.setDeptFilter('ALL')">
          All Departments (${(state.employees || []).length})
        </button>
        ${Object.keys(config.DEPARTMENTS).map(d => {
          const count = (state.employees || []).filter(e => e.department === d).length;
          return `
            <button class="btn btn-sm ${this.activeDeptFilter === d ? 'btn-primary' : 'btn-secondary'}" 
              onclick="window.Zoosh.Views.Team.setDeptFilter('${d}')">
              ${d} (${count})
            </button>
          `;
        }).join('')}
      </div>

      <div class="card-panel">
        <div class="card-panel-body" style="padding: 0;">
          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Primary Department</th>
                  <th>Secondary Skills</th>
                  <th>Joining Date</th>
                  <th>Standard Hours</th>
                  <th>Overtime</th>
                  <th>Current Queue</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${employees.map(emp => {
                  const queueDays = workloadMap.get(emp.id) || 0;
                  return `
                    <tr>
                      <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <div style="width: 32px; height: 32px; border-radius: 50%; background: #0f172a; color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; font-size: 13px;">
                            ${emp.name.charAt(0)}
                          </div>
                          <div>
                            <div style="font-weight: 700; color: var(--text-main); font-size: 13.5px;">${emp.name}</div>
                            <div style="font-size: 11px; color: var(--text-muted);">ID: ${emp.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="badge badge-${emp.department.toLowerCase()}">${emp.department}</span>
                      </td>
                      <td>
                        ${(emp.secondaryDepartments || []).length > 0 ? (emp.secondaryDepartments || []).map(s => `
                          <span class="badge badge-${s.toLowerCase()}" style="font-size: 10px; margin-right: 4px;">${s}</span>
                        `).join('') : '<span style="color: var(--text-muted); font-size: 12px;">—</span>'}
                      </td>
                      <td style="font-family: var(--font-mono); font-size: 12.5px;">
                        ${calendar.formatDisplayDate(emp.joiningDate, false, true)}
                      </td>
                      <td>${emp.standardHoursPerDay || 8} hrs / day</td>
                      <td>
                        <span style="font-size: 12px; font-weight: 600; color: ${emp.overtimeAvailable ? '#059669' : 'var(--text-muted)'};">
                          ${emp.overtimeAvailable ? '✓ Available' : 'No'}
                        </span>
                      </td>
                      <td>
                        <span style="font-weight: 700; color: ${queueDays > 6 ? '#d97706' : 'var(--text-secondary)'}; font-family: var(--font-mono);">
                          ${queueDays} days
                        </span>
                      </td>
                      <td>
                        <span class="badge ${emp.active ? 'badge-on-schedule' : 'badge-delayed'}">
                          ${emp.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div style="display: flex; gap: 6px;">
                          <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Team.openEditModal('${emp.id}')">
                            Edit
                          </button>
                          <button class="btn btn-sm ${emp.active ? 'btn-secondary' : 'btn-primary'}" onclick="window.Zoosh.Views.Team.toggleActive('${emp.id}')">
                            ${emp.active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  setDeptFilter(dept) {
    this.activeDeptFilter = dept;
    this.render(document.getElementById('view-container'));
  },

  toggleActive(empId) {
    const state = window.Zoosh.State.getState();
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;

    window.Zoosh.State.updateEmployee(empId, {
      active: !emp.active
    });
  },

  openAddModal() {
    const config = window.Zoosh.Config;
    const title = 'Add Craftsperson';
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" id="add-emp-name" class="form-input" placeholder="e.g. Ramesh" />
        </div>
        <div class="form-group">
          <label class="form-label">Primary Department</label>
          <select id="add-emp-dept" class="form-select">
            ${Object.keys(config.DEPARTMENTS).map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Secondary Trained Departments (Optional)</label>
          <select id="add-emp-sec-dept" class="form-select" multiple style="height: 80px;">
            ${Object.keys(config.DEPARTMENTS).map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Hold Ctrl / Cmd to select multiple skills.</div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Joining Date</label>
            <input type="date" id="add-emp-join" class="form-input" value="${config.CURRENT_DATE}" />
          </div>
          <div class="form-group">
            <label class="form-label">Standard Hours / Day</label>
            <input type="number" id="add-emp-hours" class="form-input" value="8" />
          </div>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
            <input type="checkbox" id="add-emp-overtime" checked />
            Available for authorized overtime
          </label>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Team.submitAdd()">Add Craftsperson</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml);
  },

  submitAdd() {
    const name = document.getElementById('add-emp-name').value.trim();
    const dept = document.getElementById('add-emp-dept').value;
    const secSelect = document.getElementById('add-emp-sec-dept');
    const secondaryDepartments = Array.from(secSelect.selectedOptions).map(o => o.value).filter(v => v !== dept);
    const joiningDate = document.getElementById('add-emp-join').value;
    const standardHours = parseInt(document.getElementById('add-emp-hours').value, 10) || 8;
    const overtimeAvailable = document.getElementById('add-emp-overtime').checked;

    if (!name) {
      alert('Please enter employee name.');
      return;
    }

    window.Zoosh.State.addEmployee({
      name,
      department: dept,
      secondaryDepartments,
      joiningDate,
      standardHoursPerDay: standardHours,
      overtimeAvailable,
      active: true
    });

    window.Zoosh.Modal.close();
  },

  openEditModal(empId) {
    const state = window.Zoosh.State.getState();
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;
    const config = window.Zoosh.Config;

    const title = `Edit Employee — ${emp.name}`;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" id="edit-emp-name" class="form-input" value="${emp.name}" />
        </div>
        <div class="form-group">
          <label class="form-label">Primary Department</label>
          <select id="edit-emp-dept" class="form-select">
            ${Object.keys(config.DEPARTMENTS).map(d => `
              <option value="${d}" ${d === emp.department ? 'selected' : ''}>${d}</option>
            `).join('')}
          </select>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Joining Date</label>
            <input type="date" id="edit-emp-join" class="form-input" value="${emp.joiningDate}" />
          </div>
          <div class="form-group">
            <label class="form-label">Standard Hours / Day</label>
            <input type="number" id="edit-emp-hours" class="form-input" value="${emp.standardHoursPerDay || 8}" />
          </div>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
            <input type="checkbox" id="edit-emp-overtime" ${emp.overtimeAvailable ? 'checked' : ''} />
            Available for authorized overtime
          </label>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
            <input type="checkbox" id="edit-emp-active" ${emp.active ? 'checked' : ''} />
            Active on factory roster
          </label>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-danger btn-sm" style="margin-right: auto;" onclick="window.Zoosh.Views.Team.deleteEmployee('${emp.id}')">Delete</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Team.submitEdit('${emp.id}')">Save Changes</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml);
  },

  submitEdit(empId) {
    const name = document.getElementById('edit-emp-name').value.trim();
    const dept = document.getElementById('edit-emp-dept').value;
    const joiningDate = document.getElementById('edit-emp-join').value;
    const standardHours = parseInt(document.getElementById('edit-emp-hours').value, 10) || 8;
    const overtimeAvailable = document.getElementById('edit-emp-overtime').checked;
    const active = document.getElementById('edit-emp-active').checked;

    window.Zoosh.State.updateEmployee(empId, {
      name,
      department: dept,
      joiningDate,
      standardHoursPerDay: standardHours,
      overtimeAvailable,
      active
    });

    window.Zoosh.Modal.close();
  },

  deleteEmployee(empId) {
    if (confirm('Are you sure you want to delete this employee? Any assigned tasks will need reassignment.')) {
      window.Zoosh.State.deleteEmployee(empId);
      window.Zoosh.Modal.close();
    }
  }
};
