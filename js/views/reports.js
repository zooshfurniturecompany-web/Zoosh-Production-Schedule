/**
 * Production Reports & Factory Analytics View
 * Department capacity, delivery punctuality, craftsperson queue distribution, and schedule exports.
 * 
 * Hierarchy: Client / SRL -> Project -> Furniture Item -> Process
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Reports = {
  render(container) {
    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const projects = state.projects || [];
    const processes = state.processes || [];
    const employees = (state.employees || []).filter(e => e.active);
    const auth = window.Zoosh.Auth;
    const canExport = auth ? auth.canExport() : true;

    const onScheduleCount = projects.filter(p => p.deadlineStatus === 'ON_SCHEDULE').length;
    const atRiskCount = projects.filter(p => p.deadlineStatus === 'AT_RISK').length;
    const delayedCount = projects.filter(p => p.deadlineStatus === 'DELAYED').length;
    const totalProjects = Math.max(1, projects.length);
    const onTimeRate = Math.round((onScheduleCount / totalProjects) * 100);

    // Department workload
    const deptHours = {};
    Object.keys(config.DEPARTMENTS).forEach(d => { deptHours[d] = 0; });
    processes.forEach(p => {
      if (p.status !== 'COMPLETED') {
        const days = parseFloat(p.durationDays) || 1;
        deptHours[p.department] = (deptHours[p.department] || 0) + (days * 8);
      }
    });

    const maxDeptHours = Math.max(1, ...Object.values(deptHours));

    // Employee hours
    const empHours = {};
    employees.forEach(e => { empHours[e.id] = { name: e.name, dept: e.department, hours: 0 }; });
    processes.forEach(p => {
      if (p.status !== 'COMPLETED' && empHours[p.employeeId]) {
        const days = parseFloat(p.durationDays) || 1;
        empHours[p.employeeId].hours += days * 8;
      }
    });

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-header-title">Factory Reports &amp; Analytics</h2>
          <div class="view-header-subtitle">Capacity throughput, punctuality ratios, and queue metrics</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" onclick="window.print()">
            🖨️ Print Report
          </button>
          ${canExport ? `
            <button class="btn btn-primary" onclick="window.Zoosh.Views.Reports.exportCsv()">
              📥 Export CSV
            </button>
          ` : ''}
        </div>
      </div>

      <!-- High Level KPIs -->
      <div class="metrics-grid">
        <div class="metric-card success">
          <div class="metric-card-label">On-Time Delivery Rate</div>
          <div class="metric-card-value">${onTimeRate}%</div>
          <div class="metric-card-hint">${onScheduleCount} of ${projects.length} orders safely on schedule</div>
        </div>
        <div class="metric-card ${atRiskCount > 0 ? 'warning' : ''}">
          <div class="metric-card-label">At-Risk Orders</div>
          <div class="metric-card-value">${atRiskCount}</div>
          <div class="metric-card-hint">Under 2 days buffer remaining</div>
        </div>
        <div class="metric-card ${delayedCount > 0 ? 'danger' : ''}">
          <div class="metric-card-label">Delayed Orders</div>
          <div class="metric-card-value">${delayedCount}</div>
          <div class="metric-card-hint">Exceeded fixed client deadline</div>
        </div>
        <div class="metric-card">
          <div class="metric-card-label">Active Factory Queue</div>
          <div class="metric-card-value">${processes.filter(p => p.status !== 'COMPLETED').length}</div>
          <div class="metric-card-hint">Pending process stages</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;">
        <!-- Department Workload Breakdown -->
        <div class="card-panel">
          <div class="card-panel-header">
            <div class="card-panel-title">Department Workload Distribution (Hours)</div>
          </div>
          <div class="card-panel-body">
            <div style="display: flex; flex-direction: column; gap: 16px;">
              ${Object.entries(deptHours).map(([dept, hours]) => {
                const percent = Math.round((hours / maxDeptHours) * 100);
                const days = (hours / 8).toFixed(1);
                return `
                  <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge badge-${dept.toLowerCase()}">${dept}</span>
                      </div>
                      <span style="font-weight: 700; color: var(--text-main); font-family: var(--font-mono);">
                        ${hours} hrs <span style="font-weight: normal; color: var(--text-muted); font-size: 11.5px;">(${days} days)</span>
                      </span>
                    </div>
                    <div class="progress-bar-container" style="height: 10px;">
                      <div class="progress-bar-fill" style="width: ${percent}%; background-color: var(--dept-${dept.toLowerCase()});"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Craftsperson Allocation Breakdown -->
        <div class="card-panel">
          <div class="card-panel-header">
            <div class="card-panel-title">Craftsperson Workload Queue</div>
          </div>
          <div class="card-panel-body" style="padding: 0;">
            <div class="data-table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Craftsperson</th>
                    <th>Department</th>
                    <th>Committed Hours</th>
                    <th>Days in Queue</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.values(empHours).map(info => `
                    <tr>
                      <td style="font-weight: 700; color: var(--text-main);">${info.name}</td>
                      <td><span class="badge badge-${info.dept.toLowerCase()}">${info.dept}</span></td>
                      <td style="font-family: var(--font-mono); font-weight: 600;">${info.hours} hrs</td>
                      <td style="font-family: var(--font-mono); font-weight: 700; color: ${info.hours > 40 ? '#d97706' : 'var(--text-secondary)'};">
                        ${(info.hours / 8).toFixed(1)} days
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  exportCsv() {
    if (window.Zoosh.Auth) {
      window.Zoosh.Auth.assertPermission('export');
    }

    const state = window.Zoosh.State.getState();
    const srlsMap = new Map((state.furniture || state.srls || []).map(s => [s.id, s]));
    const projectsMap = new Map((state.projects || []).map(p => [p.id, p]));
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    let csv = 'Client,Client SRL,Project Name,Furniture Item,Stage Sequence,Department,Craftsperson,Start Date,End Date,Duration Days,Status\n';

    (state.processes || []).forEach(p => {
      const srl = srlsMap.get(p.furnitureId || p.srlId);
      const proj = srl ? projectsMap.get(srl.projectId) : null;
      const client = proj ? clientsMap.get(proj.clientId) : null;
      const clientSrl = client ? client.srl : (proj ? proj.clientSrl : '—');
      const clientName = client ? client.name : (proj ? proj.clientName : 'Client');
      const emp = employeesMap.get(p.employeeId);
      const furnitureName = srl ? (srl.name || srl.furnitureName) : 'Furniture';

      const row = [
        `"${clientName.replace(/"/g, '""')}"`,
        clientSrl,
        `"${(proj ? proj.name : '').replace(/"/g, '""')}"`,
        `"${furnitureName.replace(/"/g, '""')}"`,
        p.sequence,
        p.department,
        `"${(emp ? emp.name : '').replace(/"/g, '""')}"`,
        p.calculatedStartDate || '',
        p.calculatedEndDate || '',
        p.durationDays,
        p.status
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', url);
    downloadAnchor.setAttribute('download', `zoosh_production_schedule_${window.Zoosh.Config.CURRENT_DATE}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
};
