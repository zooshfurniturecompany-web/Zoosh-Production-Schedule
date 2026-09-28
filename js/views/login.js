/**
 * Login Gateway View
 * Modern, responsive authentication screen for Factory Control Room.
 * Provides role-based access for Managers and Visitors.
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Login = {
  render(container) {
    if (!container) return;

    container.innerHTML = `
      <div class="login-wrapper">
        <div class="login-card">
          <!-- Brand Header -->
          <div class="login-brand">
            <div class="login-logo-circle">Z</div>
            <h1 class="login-title">Zoosh Production</h1>
            <div class="login-subtitle">Factory Control Room &bull; Authentication Gateway</div>
          </div>

          <!-- Alert / Error Notice -->
          <div id="login-error-alert" class="login-error-box" style="display: none;"></div>

          <!-- Credentials Form -->
          <form id="factory-login-form" onsubmit="window.Zoosh.Views.Login.handleSubmit(event)">
            <div class="form-group" style="margin-bottom: 16px;">
              <label class="form-label" for="login-username">Username</label>
              <div class="input-with-icon">
                <span class="input-icon">👤</span>
                <input 
                  type="text" 
                  id="login-username" 
                  class="form-input" 
                  placeholder="Enter username (zooshadmin or zooshadmin1234)" 
                  autocomplete="username"
                  required 
                  autofocus
                />
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <label class="form-label" for="login-password" style="margin-bottom: 0;">Password</label>
                <button type="button" class="btn-link" onclick="window.Zoosh.Views.Login.togglePasswordVisibility()">
                  <span id="pwd-toggle-text">Show</span>
                </button>
              </div>
              <div class="input-with-icon">
                <span class="input-icon">🔒</span>
                <input 
                  type="password" 
                  id="login-password" 
                  class="form-input" 
                  placeholder="Enter password" 
                  autocomplete="current-password"
                  required 
                />
              </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; font-size: 13px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-secondary);">
                <input type="checkbox" id="login-remember" checked />
                <span>Remember me on this device</span>
              </label>
            </div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block" style="padding: 12px; font-size: 15px; font-weight: 700; width: 100%;">
              Sign In to Factory Control Room &rarr;
            </button>
          </form>

          <!-- Quick Access Shortcuts for Demo/Evaluation -->
          <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-light);">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; color: var(--text-muted); text-align: center; margin-bottom: 12px;">
              Quick Evaluation Credentials
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px;"
                onclick="window.Zoosh.Views.Login.quickFill('zooshadmin', 'zooshadmin1234')"
              >
                <span>🔑</span> Manager Login
              </button>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px;"
                onclick="window.Zoosh.Views.Login.quickFill('zooshadmin1234', 'zooshadmin098')"
              >
                <span>👁️</span> Visitor Login
              </button>
            </div>
          </div>

          <!-- Role Permissions Guide -->
          <div class="login-role-guide">
            <div class="role-pill manager-pill">
              <strong>Manager (zooshadmin):</strong> Full write control &bull; Client, Project &amp; Furniture CRUD &bull; Reallocations &bull; Admin
            </div>
            <div class="role-pill visitor-pill">
              <strong>Visitor (zooshadmin1234):</strong> Read-only access &bull; Overview &bull; Live Gantt &bull; Capacity &bull; Reports
            </div>
          </div>
        </div>
      </div>
    `;
  },

  togglePasswordVisibility() {
    const pwdInput = document.getElementById('login-password');
    const toggleText = document.getElementById('pwd-toggle-text');
    if (!pwdInput) return;
    if (pwdInput.type === 'password') {
      pwdInput.type = 'text';
      if (toggleText) toggleText.textContent = 'Hide';
    } else {
      pwdInput.type = 'password';
      if (toggleText) toggleText.textContent = 'Show';
    }
  },

  quickFill(username, password) {
    const userInput = document.getElementById('login-username');
    const pwdInput = document.getElementById('login-password');
    if (userInput) userInput.value = username;
    if (pwdInput) pwdInput.value = password;
    this.hideError();
    // Submit automatically
    const form = document.getElementById('factory-login-form');
    if (form) {
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        this.handleSubmit(new Event('submit'));
      }
    }
  },

  showError(message) {
    const errorBox = document.getElementById('login-error-alert');
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';
    }
  },

  hideError() {
    const errorBox = document.getElementById('login-error-alert');
    if (errorBox) {
      errorBox.style.display = 'none';
      errorBox.textContent = '';
    }
  },

  async handleSubmit(event) {
    if (event && event.preventDefault) event.preventDefault();

    const userInput = document.getElementById('login-username');
    const pwdInput = document.getElementById('login-password');
    const rememberInput = document.getElementById('login-remember');
    const submitBtn = document.getElementById('btn-login-submit');

    const username = userInput ? userInput.value.trim() : '';
    const password = pwdInput ? pwdInput.value : '';
    const rememberMe = rememberInput ? rememberInput.checked : false;

    if (!username || !password) {
      this.showError('Please enter both username and password.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Authenticating...';
    }

    try {
      await window.Zoosh.Auth.login(username, password, rememberMe);
      this.hideError();
      // On success, boot application
      if (window.Zoosh.App) {
        window.Zoosh.App.onLoginSuccess();
      }
    } catch (err) {
      this.showError(err.message || 'Login failed. Please check credentials.');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Sign In to Factory Control Room &rarr;';
      }
    }
  }
};
