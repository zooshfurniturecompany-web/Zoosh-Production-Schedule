/**
 * Settings & User Administration View
 * 
 * Features:
 * - Profile and password change for logged-in user
 * - User administration for Manager (add user, role changes, deactivation, password reset)
 * - Factory Data Lifecycle for Manager (Start Fresh, Reset Demo Data, Dangerous Clear All Data)
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Settings = {
  render(container) {
    if (!container) return;

    const auth = window.Zoosh.Auth;
    const session = auth.getSession();
    const isManager = auth.isManager();

    if (!session) {
      container.innerHTML = `<div style="padding: 40px; text-align: center;">Please log in to view settings.</div>`;
      return;
    }

    if (window.Zoosh.App) {
      window.Zoosh.App.updateMobileHeader('Settings & Admin', false);
    }

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-header-title">Settings &amp; Administration</h2>
          <div class="view-header-subtitle">Account security, user access permissions, and data lifecycle management</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; margin-bottom: 24px;">
        
        <!-- Card 1: My Profile & Password -->
        <div class="card-panel">
          <div class="card-panel-header">
            <div class="card-panel-title">👤 My Account Profile</div>
            <span class="badge ${session.role === 'MANAGER' ? 'badge-primary' : 'badge-upholstery'}">
              ${session.role}
            </span>
          </div>
          <div class="card-panel-body" style="padding: 20px;">
            <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
              <div style="width: 48px; height: 48px; border-radius: 50%; background: ${session.role === 'MANAGER' ? 'var(--primary-color)' : '#3b82f6'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800;">
                ${session.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-weight: 800; font-size: 16px; color: var(--text-main);">${session.displayName || session.username}</div>
                <div style="font-size: 12px; color: var(--text-muted); font-family: var(--font-mono);">@${session.username} &bull; Active Session</div>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-light); padding-top: 16px;">
              <h4 style="font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 12px;">Change Password</h4>
              <div id="pwd-change-msg" style="display: none; padding: 8px 12px; border-radius: 6px; font-size: 12.5px; margin-bottom: 12px;"></div>
              
              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label" style="font-size: 12px;">Current Password</label>
                <input type="password" id="input-curr-pwd" class="form-input" placeholder="Enter current password" />
              </div>

              <div class="form-group" style="margin-bottom: 12px;">
                <label class="form-label" style="font-size: 12px;">New Password (min 6 chars)</label>
                <input type="password" id="input-new-pwd" class="form-input" placeholder="Enter new secure password" />
              </div>

              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" style="font-size: 12px;">Confirm New Password</label>
                <input type="password" id="input-confirm-pwd" class="form-input" placeholder="Repeat new password" />
              </div>

              <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Settings.handleChangePassword()">
                Update My Password
              </button>
            </div>
          </div>
        </div>

        <!-- Card 2: Permissions Matrix & Role Info -->
        <div class="card-panel">
          <div class="card-panel-header">
            <div class="card-panel-title">🛡️ Security &amp; Role Permissions</div>
          </div>
          <div class="card-panel-body" style="padding: 20px;">
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
              Zoosh Production enforces role-based access control at the code execution level. Direct write operations are guarded.
            </div>

            <table style="width: 100%; font-size: 12.5px; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border-light); text-align: left; color: var(--text-muted);">
                  <th style="padding: 6px 0;">Capability</th>
                  <th style="padding: 6px 0; text-align: center;">MANAGER</th>
                  <th style="padding: 6px 0; text-align: center;">VISITOR</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 8px 0;">View Dashboards &amp; Schedules</td>
                  <td style="text-align: center; color: #059669; font-weight: 700;">✅ Full</td>
                  <td style="text-align: center; color: #059669; font-weight: 700;">✅ Full</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 8px 0;">Client / SRL Management</td>
                  <td style="text-align: center; color: #059669; font-weight: 700;">✅ Full</td>
                  <td style="text-align: center; color: #dc2626; font-weight: 700;">❌ Blocked</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 8px 0;">Project &amp; Furniture CRUD</td>
                  <td style="text-align: center; color: #059669; font-weight: 700;">✅ Full</td>
                  <td style="text-align: center; color: #dc2626; font-weight: 700;">❌ Blocked</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 8px 0;">Schedule Reallocations</td>
                  <td style="text-align: center; color: #059669; font-weight: 700;">✅ Full</td>
                  <td style="text-align: center; color: #dc2626; font-weight: 700;">❌ Blocked</td>
                </tr>
                <tr style="border-bottom: 1px solid var(--border-light);">
                  <td style="padding: 8px 0;">Team &amp; Leave Records</td>
                  <td style="text-align: center; color: #059669; font-weight: 700;">✅ Full</td>
                  <td style="text-align: center; color: #dc2626; font-weight: 700;">❌ Blocked</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">Data Lifecycle &amp; Admin</td>
                  <td style="text-align: center; color: #059669; font-weight: 700;">✅ Full</td>
                  <td style="text-align: center; color: #dc2626; font-weight: 700;">❌ Blocked</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      ${isManager ? `
        <!-- Card 3: User Management (Manager Only) -->
        <div class="card-panel" style="margin-bottom: 24px;">
          <div class="card-panel-header">
            <div>
              <div class="card-panel-title">👥 User Account Administration</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Manage factory operator and visitor accounts</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.Zoosh.Views.Settings.openAddUserModal()">
              + Add User
            </button>
          </div>
          <div class="card-panel-body" style="padding: 0;">
            <div style="overflow-x: auto;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                  <tr style="background: var(--bg-surface-secondary); border-bottom: 1px solid var(--border-light); text-align: left; color: var(--text-muted); font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 12px 16px;">User</th>
                    <th style="padding: 12px 16px;">Role</th>
                    <th style="padding: 12px 16px;">Status</th>
                    <th style="padding: 12px 16px;">Created</th>
                    <th style="padding: 12px 16px; text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${auth.getUsers().map(u => `
                    <tr style="border-bottom: 1px solid var(--border-light);">
                      <td style="padding: 12px 16px;">
                        <strong style="color: var(--text-main);">${u.displayName || u.username}</strong>
                        <div style="font-size: 11.5px; color: var(--text-muted); font-family: var(--font-mono);">@${u.username}</div>
                      </td>
                      <td style="padding: 12px 16px;">
                        <span class="badge ${u.role === 'MANAGER' ? 'badge-primary' : 'badge-upholstery'}">
                          ${u.role}
                        </span>
                      </td>
                      <td style="padding: 12px 16px;">
                        <span style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600; color: ${u.active ? '#059669' : '#dc2626'}; font-size: 12px;">
                          <span style="width: 7px; height: 7px; border-radius: 50%; background: currentColor;"></span>
                          ${u.active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td style="padding: 12px 16px; color: var(--text-secondary); font-size: 12px;">
                        ${u.createdAt || '2026-09-28'}
                      </td>
                      <td style="padding: 12px 16px; text-align: right;">
                        <div style="display: inline-flex; gap: 6px;">
                          <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.Zoosh.Views.Settings.openResetUserPwdModal('${u.id}', '${u.username}')">
                            Reset Password
                          </button>
                          ${u.id !== session.userId ? `
                            <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.Zoosh.Views.Settings.toggleRole('${u.id}', '${u.role}')">
                              Switch to ${u.role === 'MANAGER' ? 'VISITOR' : 'MANAGER'}
                            </button>
                            <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px; color: ${u.active ? '#dc2626' : '#059669'};" onclick="window.Zoosh.Views.Settings.toggleActive('${u.id}')">
                              ${u.active ? 'Disable' : 'Enable'}
                            </button>
                          ` : `
                            <span style="font-size: 11px; color: var(--text-muted); align-self: center; padding: 0 4px;">(Current)</span>
                          `}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Card 4: Factory Data Lifecycle (Manager Only) -->
        <div class="card-panel">
          <div class="card-panel-header" style="border-left: 4px solid var(--accent-color);">
            <div>
              <div class="card-panel-title">⚙️ Factory Data Lifecycle &amp; Maintenance</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Manager controls to start fresh, restore demo data, or completely wipe factory records</div>
            </div>
          </div>
          <div class="card-panel-body" style="padding: 20px;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
              
              <!-- Start Fresh -->
              <div style="border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 16px; background: var(--bg-surface);">
                <div style="font-weight: 800; font-size: 14px; color: var(--text-main); margin-bottom: 6px;">
                  🌱 Start Fresh
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; min-height: 48px;">
                  Clears all current client orders, projects, furniture items, processes, and leave records. Preserves craftspeople, flow types, and user accounts.
                </div>
                <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Settings.confirmStartFresh()">
                  Start Fresh Factory
                </button>
              </div>

              <!-- Reset Demo Data -->
              <div style="border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 16px; background: var(--bg-surface);">
                <div style="font-weight: 800; font-size: 14px; color: var(--text-main); margin-bottom: 6px;">
                  🔄 Reset Demo Data
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 14px; min-height: 48px;">
                  Reloads the realistic Zoosh demo factory dataset (Clients SRL 101, 102, 103, villa projects, craftspeople, and schedule). User accounts remain intact.
                </div>
                <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Settings.confirmResetDemo()">
                  Reset to Demo State
                </button>
              </div>

              <!-- Clear All Production Data -->
              <div style="border: 1px solid #fecaca; border-radius: var(--radius-md); padding: 16px; background: #fff5f5;">
                <div style="font-weight: 800; font-size: 14px; color: #b91c1c; margin-bottom: 6px;">
                  ⚠️ Clear All Production Data
                </div>
                <div style="font-size: 12px; color: #7f1d1d; margin-bottom: 14px; min-height: 48px;">
                  Destructive operation. Completely empties all production records. Requires typing <code>DELETE ALL DATA</code> confirmation string. User accounts are preserved.
                </div>
                <button class="btn btn-sm" style="background: #dc2626; color: #fff;" onclick="window.Zoosh.Views.Settings.openDangerousDeleteModal()">
                  Wipe All Data...
                </button>
              </div>

            </div>
          </div>
        </div>
      ` : ''}
    `;
  },

  async handleChangePassword() {
    const currInput = document.getElementById('input-curr-pwd');
    const newInput = document.getElementById('input-new-pwd');
    const confInput = document.getElementById('input-confirm-pwd');
    const msgEl = document.getElementById('pwd-change-msg');

    const curr = currInput ? currInput.value : '';
    const newP = newInput ? newInput.value : '';
    const conf = confInput ? confInput.value : '';

    if (!curr || !newP || !conf) {
      this._showMsg(msgEl, 'Please fill in all password fields.', 'danger');
      return;
    }
    if (newP.length < 6) {
      this._showMsg(msgEl, 'New password must be at least 6 characters.', 'danger');
      return;
    }
    if (newP !== conf) {
      this._showMsg(msgEl, 'New password and confirmation do not match.', 'danger');
      return;
    }

    try {
      await window.Zoosh.Auth.changeMyPassword(curr, newP);
      this._showMsg(msgEl, 'Password updated successfully!', 'success');
      currInput.value = '';
      newInput.value = '';
      confInput.value = '';
    } catch (err) {
      this._showMsg(msgEl, err.message || 'Failed to change password.', 'danger');
    }
  },

  _showMsg(el, text, type) {
    if (!el) return;
    el.style.display = 'block';
    el.textContent = text;
    if (type === 'success') {
      el.style.background = '#ecfdf5';
      el.style.color = '#065f46';
      el.style.border = '1px solid #a7f3d0';
    } else {
      el.style.background = '#fef2f2';
      el.style.color = '#991b1b';
      el.style.border = '1px solid #fecaca';
    }
  },

  openAddUserModal() {
    const modalContent = `
      <div id="add-user-error" style="display: none; padding: 8px 12px; border-radius: 6px; background: #fef2f2; color: #991b1b; font-size: 12.5px; margin-bottom: 12px;"></div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Username</label>
        <input type="text" id="new-user-username" class="form-input" placeholder="e.g. supervisor1" />
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Full Name / Display Name</label>
        <input type="text" id="new-user-fullname" class="form-input" placeholder="e.g. John Doe (Floor Supervisor)" />
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Role</label>
        <select id="new-user-role" class="form-input">
          <option value="VISITOR">VISITOR (Read-Only Observer)</option>
          <option value="MANAGER">MANAGER (Full Production Control)</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Initial Password (min 6 chars)</label>
        <input type="password" id="new-user-password" class="form-input" placeholder="Enter secure password" />
      </div>
    `;

    const modalFooter = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Settings.submitNewUser()">Create Account</button>
    `;

    window.Zoosh.Modal.open('Add Factory User Account', modalContent, modalFooter, '480px');
  },

  async submitNewUser() {
    const usernameInput = document.getElementById('new-user-username');
    const nameInput = document.getElementById('new-user-fullname');
    const roleInput = document.getElementById('new-user-role');
    const pwdInput = document.getElementById('new-user-password');
    const errEl = document.getElementById('add-user-error');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const displayName = nameInput ? nameInput.value.trim() : '';
    const role = roleInput ? roleInput.value : 'VISITOR';
    const password = pwdInput ? pwdInput.value : '';

    if (!username || !password) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Username and password are required.'; }
      return;
    }

    try {
      await window.Zoosh.Auth.addUser({ username, displayName, role, password });
      window.Zoosh.Modal.close();
      this.render(document.getElementById('view-container'));
    } catch (err) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
    }
  },

  toggleRole(userId, currentRole) {
    const newRole = currentRole === 'MANAGER' ? 'VISITOR' : 'MANAGER';
    if (!confirm(`Switch this user to ${newRole}?`)) return;
    try {
      window.Zoosh.Auth.updateUserRole(userId, newRole);
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message);
    }
  },

  toggleActive(userId) {
    try {
      window.Zoosh.Auth.toggleUserActive(userId);
      this.render(document.getElementById('view-container'));
    } catch (err) {
      alert(err.message);
    }
  },

  openResetUserPwdModal(userId, username) {
    const modalContent = `
      <div id="reset-pwd-error" style="display: none; padding: 8px 12px; border-radius: 6px; background: #fef2f2; color: #991b1b; font-size: 12.5px; margin-bottom: 12px;"></div>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
        Setting a new password for account <strong>@${username}</strong>.
      </p>
      <div class="form-group">
        <label class="form-label">New Password (min 6 chars)</label>
        <input type="password" id="reset-target-pwd" class="form-input" placeholder="Enter new password" />
      </div>
    `;

    const modalFooter = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Settings.submitResetPwd('${userId}')">Set Password</button>
    `;

    window.Zoosh.Modal.open(`Reset Password for @${username}`, modalContent, modalFooter, '450px');
  },

  async submitResetPwd(userId) {
    const pwdInput = document.getElementById('reset-target-pwd');
    const errEl = document.getElementById('reset-pwd-error');
    const pwd = pwdInput ? pwdInput.value : '';

    if (!pwd || pwd.length < 6) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Password must be at least 6 characters.'; }
      return;
    }

    try {
      await window.Zoosh.Auth.resetUserPassword(userId, pwd);
      window.Zoosh.Modal.close();
      alert('Password updated successfully.');
    } catch (err) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
    }
  },

  confirmStartFresh() {
    if (!confirm('Start Fresh?\n\nThis will remove all Clients, Projects, Furniture items, and Schedules from the factory floor. Employees, flow types, and user accounts will remain intact.\n\nProceed?')) {
      return;
    }
    window.Zoosh.State.startFresh();
    alert('Factory reset to clean state. Ready for first Client / SRL.');
    if (window.Zoosh.App) window.Zoosh.App.navigateTo('projects');
  },

  confirmResetDemo() {
    if (!confirm('Reset to Demo Data?\n\nThis will restore the standard Zoosh demo dataset (Clients SRL 101, 102, 103, Projects, and Furniture items). User accounts will remain intact.\n\nProceed?')) {
      return;
    }
    window.Zoosh.State.resetDemoData();
    alert('Factory demo data restored successfully.');
    if (window.Zoosh.App) window.Zoosh.App.navigateTo('overview');
  },

  openDangerousDeleteModal() {
    const modalContent = `
      <div style="color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px; font-size: 13px; margin-bottom: 16px;">
        <strong>DANGER ZONE:</strong> This action permanently deletes all clients, projects, furniture, and production schedules from local storage and real-time cloud database.
      </div>
      <p style="font-size: 13px; color: var(--text-main); margin-bottom: 12px;">
        To confirm, please type exactly <strong>DELETE ALL DATA</strong> in the box below:
      </p>
      <input 
        type="text" 
        id="dangerous-delete-confirm-input" 
        class="form-input" 
        placeholder="Type DELETE ALL DATA here" 
        oninput="window.Zoosh.Views.Settings.checkDangerousInput(this.value)"
      />
    `;

    const modalFooter = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button id="btn-dangerous-delete" class="btn" style="background: #dc2626; color: #fff; opacity: 0.4; cursor: not-allowed;" disabled onclick="window.Zoosh.Views.Settings.executeDangerousDelete()">
        Permanently Delete All Data
      </button>
    `;

    window.Zoosh.Modal.open('Confirm Factory Data Wipe', modalContent, modalFooter, '480px');
  },

  checkDangerousInput(val) {
    const btn = document.getElementById('btn-dangerous-delete');
    if (!btn) return;
    if (val === 'DELETE ALL DATA') {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    }
  },

  executeDangerousDelete() {
    try {
      window.Zoosh.State.clearAllProductionData('DELETE ALL DATA');
      window.Zoosh.Modal.close();
      alert('All factory production data has been wiped.');
      if (window.Zoosh.App) window.Zoosh.App.navigateTo('projects');
    } catch (err) {
      alert(err.message);
    }
  }
};
