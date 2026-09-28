/**
 * Reusable Modal Manager
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.Modal = {
  backdropEl: null,
  containerEl: null,

  init() {
    this.backdropEl = document.getElementById('modal-backdrop');
    this.containerEl = document.getElementById('modal-container');
    
    if (this.backdropEl) {
      this.backdropEl.addEventListener('click', (e) => {
        if (e.target === this.backdropEl) {
          this.close();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  },

  isOpen() {
    return this.backdropEl && this.backdropEl.classList.contains('open');
  },

  open(title, bodyHtml, footerHtml = '', maxWidth = '600px') {
    if (!this.backdropEl || !this.containerEl) {
      this.init();
    }

    this.containerEl.style.maxWidth = maxWidth;
    this.containerEl.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close-btn" onclick="window.Zoosh.Modal.close()">&times;</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    `;

    this.backdropEl.classList.add('open');
  },

  close() {
    if (this.backdropEl) {
      this.backdropEl.classList.remove('open');
    }
  }
};
