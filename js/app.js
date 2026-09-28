/**
 * Application Controller & Router
 * Modern Factory Control Room
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.App = {
  currentView: 'overview',

  init() {
    console.log('Initializing ZOOSH Production Scheduling System...');

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

    // 4. Setup Toolbar & Import/Export Actions
    this.setupToolbar();

    // 5. Subscribe to State Changes
    window.Zoosh.State.subscribe((state) => {
      this.renderCurrentView();
      this.updateTopbarBadges(state);
    });

    // 6. Initial Render
    this.navigateTo('overview');
    this.updateTopbarBadges(window.Zoosh.State.getState());
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
    // Hidden file input for JSON import
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const result = window.Zoosh.State.importJson(event.target.result);
          if (result.success) {
            this.showToast('Data imported successfully!');
          } else {
            alert('Import failed: ' + result.error);
          }
          fileInput.value = '';
        };
        reader.readAsText(file);
      });
    }
  },

  navigateTo(viewName) {
    this.currentView = viewName;

    // Update active class on nav links
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    this.renderCurrentView();
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
      default:
        window.Zoosh.Views.Overview.render(container);
    }
  },

  updateTopbarBadges(state) {
    const alertsCountEl = document.getElementById('topbar-alerts-count');
    if (alertsCountEl && state.computed) {
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

  // Toolbar Actions
  exportJson() {
    window.Zoosh.State.exportJson();
    this.showToast('Factory backup JSON downloaded.');
  },

  triggerImport() {
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) fileInput.click();
  },

  resetDemoData() {
    if (confirm('Reset all factory data back to original Demo Data?')) {
      window.Zoosh.State.resetDemoData();
      this.showToast('Reset to demo data.');
    }
  },

  startFresh() {
    if (confirm('Start fresh? This will clear all projects, furniture items, and tasks while keeping basic employee and process templates.')) {
      window.Zoosh.State.startFresh();
      this.showToast('Factory cleared for fresh production plan.');
    }
  }
};

// Auto-boot upon DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.Zoosh.App.init();
});
