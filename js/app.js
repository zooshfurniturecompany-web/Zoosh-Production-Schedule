/**
 * Application Controller & Router
 * Modern Factory Control Room
 * 
 * Features:
 * - Authentication gateway (blocks app access if unauthenticated)
 * - Role-based permissions enforcement
 * - User session profile in headers and sidebar
 * - Dynamic view router including Settings & User Management
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.App = {
  currentView: 'overview',
  isBooted: false,

  init() {
    console.log('Initializing ZOOSH Production Scheduling System...');

    // 1. Initialize Authentication module
    if (window.Zoosh.Auth) {
      window.Zoosh.Auth.init();
    }

    // 2. Check Authentication Gateway
    if (!window.Zoosh.Auth || !window.Zoosh.Auth.isAuthenticated()) {
      this.showLoginScreen();
      return;
    }

    // 3. User is authenticated, boot the application
    this.bootApp();
  },

  showLoginScreen() {
    const appEl = document.getElementById('app');
    const loginContainer = document.getElementById('login-container');
    if (appEl) appEl.style.display = 'none';
    if (loginContainer) {
      loginContainer.style.display = 'block';
      if (window.Zoosh.Views.Login) {
        window.Zoosh.Views.Login.render(loginContainer);
      }
    }
  },

  onLoginSuccess() {
    const loginContainer = document.getElementById('login-container');
    const appEl = document.getElementById('app');
    if (loginContainer) loginContainer.style.display = 'none';
    if (appEl) appEl.style.display = 'flex';

    this.bootApp();
  },

  logout() {
    if (window.Zoosh.Auth) {
      window.Zoosh.Auth.logout();
    }
    this.showLoginScreen();
    this.showToast('You have been logged out.');
  },

  bootApp() {
    const session = window.Zoosh.Auth ? window.Zoosh.Auth.getSession() : null;

    // 1. Initialize State & Persistence
    window.Zoosh.State.init();

    // 2. Initialize Modals
    window.Zoosh.Modal.init();

    // 3. Initialize Supabase Cloud Sync (if configured)
    if (window.Zoosh.CloudSync) {
      window.Zoosh.CloudSync.init();
    }

    // 4. Setup Navigation Event Listeners
    this.setupNavigation();

    // 5. Setup Toolbar & Import/Export Actions
    this.setupToolbar();

    // 6. Mount User Profile Badges in Topbars & Sidebar
    this.updateUserBadges(session);

    // 7. Subscribe to State Changes
    window.Zoosh.State.subscribe((state) => {
      this.renderCurrentView();
      this.updateTopbarBadges(state);
    });

    // 8. Initial Render
    this.navigateTo(this.currentView || 'overview');
    this.updateTopbarBadges(window.Zoosh.State.getState());
    this.isBooted = true;
  },

  updateUserBadges(user) {
    if (!user) return;

    // Desktop Topbar User Badge
    const topbarProfile = document.getElementById('user-topbar-profile');
    if (topbarProfile) {
      topbarProfile.innerHTML = `
        <div class="user-avatar-badge">${user.username.charAt(0).toUpperCase()}</div>
        <div style="font-size: 12px; line-height: 1.2;">
          <strong style="color: var(--text-main); display: block;">${user.displayName || user.username}</strong>
          <span class="badge ${user.role === 'MANAGER' ? 'badge-primary' : 'badge-upholstery'}" style="font-size: 9.5px; padding: 1px 5px;">
            ${user.role}
          </span>
        </div>
        <button class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 11px; margin-left: 4px;" onclick="window.Zoosh.App.navigateTo('settings')" title="Account Settings & Users">
          ⚙️
        </button>
        <button class="btn-logout" style="color: #dc2626; border-color: #fecaca; background: #fff5f5; padding: 4px 8px;" onclick="window.Zoosh.App.logout()" title="Sign Out">
          Logout
        </button>
      `;
    }

    // Mobile Topbar User Indicator
    const mobileUserEl = document.getElementById('mobile-user-profile');
    if (mobileUserEl) {
      mobileUserEl.innerHTML = `
        <button class="btn btn-secondary btn-sm" style="padding: 3px 6px; font-size: 10px;" onclick="window.Zoosh.App.navigateTo('settings')">
          ⚙️
        </button>
        <button class="btn btn-secondary btn-sm" style="padding: 3px 6px; font-size: 10px; color: #dc2626;" onclick="window.Zoosh.App.logout()">
          Logout
        </button>
      `;
    }

    // Sidebar User Session Card
    const sidebarUserBadge = document.getElementById('sidebar-user-badge');
    if (sidebarUserBadge) {
      sidebarUserBadge.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: #ffffff; color: #0f172a; font-weight: 800; font-size: 12px; display: flex; align-items: center; justify-content: center;">
            ${user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 700; color: #ffffff;">${user.displayName || user.username}</div>
            <div style="font-size: 10px; color: #94a3b8;">${user.role}</div>
          </div>
        </div>
        <button class="btn-logout" onclick="window.Zoosh.App.logout()">Logout</button>
      `;
    }

    // Adjust visibility of write buttons in desktop topbar
    const canCreate = window.Zoosh.Auth ? window.Zoosh.Auth.canCreate() : true;
    const btnNewClient = document.getElementById('topbar-btn-new-client');
    const btnNewProj = document.getElementById('topbar-btn-new-proj');
    const btnAddFurn = document.getElementById('topbar-btn-add-furn');
    const mobileAddFurn = document.getElementById('mobile-btn-add-furniture');
    const sidebarControls = document.getElementById('sidebar-data-controls');

    if (btnNewClient) btnNewClient.style.display = canCreate ? 'inline-flex' : 'none';
    if (btnNewProj) btnNewProj.style.display = canCreate ? 'inline-flex' : 'none';
    if (btnAddFurn) btnAddFurn.style.display = canCreate ? 'inline-flex' : 'none';
    if (mobileAddFurn) mobileAddFurn.style.display = canCreate ? 'inline-flex' : 'none';
    if (sidebarControls) sidebarControls.style.display = canCreate ? 'block' : 'none';
  },

  setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const targetView = item.getAttribute('data-view');
        if (targetView) {
          this.navigateTo(targetView);
        }
      });
    });
  },

  setupToolbar() {
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const result = window.Zoosh.State.importJson(event.target.result);
            if (result.success) {
              this.showToast('Data imported successfully!');
            } else {
              alert('Import failed: ' + result.error);
            }
          } catch (err) {
            alert('Import error: ' + err.message);
          }
          fileInput.value = '';
        };
        reader.readAsText(file);
      });
    }
  },

  navigateTo(viewName) {
    this.currentView = viewName;
    this.mobileBackCallback = null;

    // Update active class on desktop nav links
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update active class on mobile bottom nav buttons
    const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
    mobileNavBtns.forEach(btn => {
      if (btn.getAttribute('data-view') === viewName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Mobile Header Title
    const viewTitles = {
      overview: 'Overview',
      projects: 'Clients & Projects',
      schedule: 'Production Schedule',
      team: 'Team & Craftspeople',
      processes: 'Process Flow Types',
      manpower: 'Manpower & Capacity',
      reports: 'Factory Reports',
      settings: 'Settings & Admin'
    };
    this.updateMobileHeader(viewTitles[viewName] || 'Zoosh Production', false);

    this.renderCurrentView();
  },

  updateMobileHeader(title, showBack = false, backCallback = null) {
    const titleEl = document.getElementById('mobile-topbar-title');
    const backBtn = document.getElementById('mobile-back-btn');
    if (titleEl) titleEl.textContent = title;
    if (backBtn) {
      backBtn.style.display = showBack ? 'flex' : 'none';
      this.mobileBackCallback = backCallback;
    }
  },

  handleMobileBack() {
    if (typeof this.mobileBackCallback === 'function') {
      this.mobileBackCallback();
    } else {
      this.navigateTo(this.currentView);
    }
  },

  renderCurrentView() {
    const container = document.getElementById('view-container');
    if (!container) return;

    switch (this.currentView) {
      case 'overview':
        window.Zoosh.Views.Overview.render(container);
        break;
      case 'projects':
        window.Zoosh.Views.Projects.render(container);
        break;
      case 'schedule':
        window.Zoosh.Views.Schedule.render(container);
        break;
      case 'team':
        window.Zoosh.Views.Team.render(container);
        break;
      case 'processes':
        window.Zoosh.Views.Processes.render(container);
        break;
      case 'manpower':
        window.Zoosh.Views.Manpower.render(container);
        break;
      case 'reports':
        window.Zoosh.Views.Reports.render(container);
        break;
      case 'settings':
        window.Zoosh.Views.Settings.render(container);
        break;
      default:
        window.Zoosh.Views.Overview.render(container);
    }
  },

  updateTopbarBadges(state) {
    const alertsCountEl = document.getElementById('topbar-alerts-count');
    if (alertsCountEl && state && state.computed) {
      const alertCount = (state.computed.alerts || []).length;
      if (alertCount > 0) {
        alertsCountEl.textContent = `${alertCount} alert${alertCount > 1 ? 's' : ''}`;
        alertsCountEl.style.display = 'inline-flex';
      } else {
        alertsCountEl.style.display = 'none';
      }
    }
  },

  showToast(message, duration = 3000) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #0f172a;
        color: #ffffff;
        padding: 12px 20px;
        border-radius: var(--radius-sm);
        box-shadow: var(--shadow-lg);
        font-size: 13px;
        font-weight: 500;
        z-index: 9999;
        transition: opacity 0.25s, transform 0.25s;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, duration);
  },

  // Toolbar Actions (RBAC protected)
  exportJson() {
    try {
      window.Zoosh.State.exportJson();
      this.showToast('Factory backup JSON downloaded.');
    } catch (err) {
      alert(err.message);
    }
  },

  triggerImport() {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canImport()) {
      alert('Permission Denied: Only Managers can import data.');
      return;
    }
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) fileInput.click();
  },

  resetDemoData() {
    try {
      if (confirm('Reset all factory data back to original Demo Data? User accounts will be preserved.')) {
        window.Zoosh.State.resetDemoData();
        this.showToast('Reset to demo data.');
      }
    } catch (err) {
      alert(err.message);
    }
  },

  startFresh() {
    try {
      if (confirm('Start fresh? This will clear all clients, projects, furniture items, and schedules while keeping employees and user accounts.')) {
        window.Zoosh.State.startFresh();
        this.showToast('Factory cleared for fresh production plan.');
      }
    } catch (err) {
      alert(err.message);
    }
  }
};

// Auto-boot upon DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.Zoosh.App.init();
});
