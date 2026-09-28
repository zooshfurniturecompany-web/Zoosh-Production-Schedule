/**
 * Mobile "More" Menu Sheet Controller
 * Secondary features access: Processes, Manpower, Reports, Cloud Sync, and Database Tools
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.More = {
  isOpen: false,

  open() {
    const sheetEl = document.getElementById('mobile-more-sheet');
    if (!sheetEl) return;
    this.isOpen = true;
    sheetEl.classList.add('open');
  },

  close() {
    const sheetEl = document.getElementById('mobile-more-sheet');
    if (!sheetEl) return;
    this.isOpen = false;
    sheetEl.classList.remove('open');
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  navigate(viewName) {
    this.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.navigateTo(viewName);
    }
  },

  openCloudSettings() {
    this.close();
    if (window.Zoosh.CloudSync) {
      window.Zoosh.CloudSync.openConfigModal();
    }
  },

  exportData() {
    this.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.exportJson();
    }
  },

  importData() {
    this.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.triggerImport();
    }
  },

  resetDemo() {
    this.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.resetDemoData();
    }
  },

  startFresh() {
    this.close();
    if (window.Zoosh.App) {
      window.Zoosh.App.startFresh();
    }
  }
};
