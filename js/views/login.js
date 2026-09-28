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
                  placeholder="Enter username" 
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

            <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block" style="padding: 12px; font-size: 15px; font-weight: 700; width: 100%; margin-top: 8px;">
              Sign In to Factory Control Room &rarr;
            </button>
          </form>

          <!-- Role Permissions Guide -->
          <div class="login-role-guide">
            <div class="role-pill manager-pill">
              <strong>Manager:</strong> Full write control &bull; Client, Project &amp; Furniture CRUD &bull; Reallocations &bull; Admin
            </div>
            <div class="role-pill visitor-pill">
              <strong>Visitor:</strong> Read-only access &bull; Overview &bull; Live Gantt &bull; Capacity &bull; Reports
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
    const submitBtn = document.getElementById('btn-login-submit');

    const username = userInput ? userInput.value.trim() : '';
    const password = pwdInput ? pwdInput.value : '';

    if (!username || !password) {
      this.showError('Please enter both username and password.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Authenticating...';
    }

    try {
      // Always persist login session forever
      await window.Zoosh.Auth.login(username, password, true);
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
