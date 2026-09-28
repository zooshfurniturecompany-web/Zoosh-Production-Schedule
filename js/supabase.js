/**
 * Supabase Realtime Cloud Sync
 * Enables real-time multi-user synchronization across devices and browser sessions.
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.CloudSync = {
  client: null,
  channel: null,
  isConnected: false,
  isSyncing: false,
  clientId: 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
  lastSyncTime: null,
  configKey: 'ZOOSH_SUPABASE_CONFIG_V1',

  init() {
    const creds = this.getCredentials();
    if (creds && creds.url && creds.key) {
      this.connect(creds.url, creds.key);
    } else {
      this.updateStatusUI();
    }
  },

  getCredentials() {
    // 1. Check localStorage configuration
    try {
      const stored = localStorage.getItem(this.configKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.url && parsed.key) return parsed;
      }
    } catch (e) {}

    // 2. Check config.js constants
    const config = window.Zoosh.Config;
    if (config && config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
      return { url: config.SUPABASE_URL, key: config.SUPABASE_ANON_KEY };
    }

    return null;
  },

  async connect(url, key) {
    if (!window.supabase) {
      console.warn('Supabase JS library not loaded. Running in local mode.');
      this.updateStatusUI();
      return { success: false, message: 'Supabase library not loaded.' };
    }

    try {
      this.isSyncing = true;
      this.updateStatusUI();

      this.client = window.supabase.createClient(url, key);

      // Test connection by fetching existing factory state
      const { data, error } = await this.client
        .from('factory_state')
        .select('*')
        .eq('id', 'zoosh_main')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        // Table might not exist or permissions error
        console.error('Supabase query error:', error);
        this.isConnected = false;
        this.isSyncing = false;
        this.updateStatusUI();
        return { success: false, message: error.message };
      }

      this.isConnected = true;
      this.isSyncing = false;
      this.lastSyncTime = new Date();

      // Save valid credentials to localStorage
      localStorage.setItem(this.configKey, JSON.stringify({ url, key }));

      if (data && data.state) {
        // Synchronize remote state to local
        console.log('Synchronized latest state from Supabase Cloud.');
        window.Zoosh.State.applyRemoteState(data.state, data.updated_by || 'Cloud');
      } else {
        // First-time setup: push initial demo state to Supabase
        console.log('Seeding initial state to Supabase Cloud...');
        await this.pushState(window.Zoosh.State.getState());
      }

      // Setup Realtime WebSocket Channel
      this.setupRealtimeSubscription();
      this.updateStatusUI();

      return { success: true, message: 'Connected to Supabase Cloud Sync!' };
    } catch (err) {
      console.error('Supabase connection failed:', err);
      this.isConnected = false;
      this.isSyncing = false;
      this.updateStatusUI();
      return { success: false, message: err.message };
    }
  },

  setupRealtimeSubscription() {
    if (!this.client) return;

    if (this.channel) {
      this.client.removeChannel(this.channel);
    }

    this.channel = this.client
      .channel('factory-state-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'factory_state', filter: 'id=eq.zoosh_main' },
        (payload) => {
          if (payload.new && payload.new.state) {
            // Ignore echo from this specific browser tab
            if (payload.new.updated_by === this.clientId) {
              return;
            }

            console.log('Received real-time update from another user/tab:', payload.new.updated_by);
            this.lastSyncTime = new Date();
            this.updateStatusUI();

            // Apply incoming remote update to local store
            window.Zoosh.State.applyRemoteState(payload.new.state, payload.new.updated_by);

            if (window.Zoosh.App) {
              window.Zoosh.App.showToast('🔔 Schedule updated in real-time by another user!');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Supabase Realtime Channel Status:', status);
      });
  },

  async pushState(state) {
    if (!this.isConnected || !this.client) return;

    try {
      this.isSyncing = true;
      this.updateStatusUI();

      const { error } = await this.client
        .from('factory_state')
        .upsert({
          id: 'zoosh_main',
          state: state,
          updated_at: new Date().toISOString(),
          updated_by: this.clientId
        });

      this.isSyncing = false;
      if (error) {
        console.error('Failed to push state to Supabase:', error);
      } else {
        this.lastSyncTime = new Date();
      }
      this.updateStatusUI();
    } catch (err) {
      this.isSyncing = false;
      console.error('Error pushing state to Supabase:', err);
      this.updateStatusUI();
    }
  },

  disconnect() {
    if (this.client && this.channel) {
      this.client.removeChannel(this.channel);
    }
    this.client = null;
    this.channel = null;
    this.isConnected = false;
    localStorage.removeItem(this.configKey);
    this.updateStatusUI();
  },

  updateStatusUI() {
    const badgeEl = document.getElementById('cloud-sync-badge');
    if (!badgeEl) return;

    if (this.isConnected) {
      badgeEl.className = 'badge badge-on-schedule';
      badgeEl.style.cursor = 'pointer';
      badgeEl.innerHTML = `
        <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
        <span>${this.isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
      `;
      badgeEl.title = `Connected to Supabase. Live Realtime Active. Click to manage settings.`;
    } else {
      badgeEl.className = 'badge badge-at-risk';
      badgeEl.style.cursor = 'pointer';
      badgeEl.innerHTML = `
        <span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; display: inline-block;"></span>
        <span>Local Mode (Connect Cloud)</span>
      `;
      badgeEl.title = 'Running locally on this device. Click to connect Supabase and enable real-time sync with other users.';
    }
  },

  openConfigModal() {
    const creds = this.getCredentials() || { url: '', key: '' };
    const title = 'Cloud Synchronization & Realtime Settings';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: var(--bg-hover); padding: 14px 18px; border-radius: var(--radius-sm); border-left: 4px solid var(--accent-blue);">
          <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">
            Multi-User Realtime Sync via Supabase
          </div>
          <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px; line-height: 1.4;">
            Connecting Supabase allows multiple managers and factory floor tablets to view and edit the production schedule simultaneously. 
            Edits made on one screen update on all other screens in real time without refreshing.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Supabase Project URL</label>
          <input type="text" id="sync-supabase-url" class="form-input" 
            placeholder="https://your-project.supabase.co" 
            value="${creds.url}" />
        </div>

        <div class="form-group">
          <label class="form-label">Supabase Anon Public API Key</label>
          <input type="password" id="sync-supabase-key" class="form-input" 
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
            value="${creds.key}" />
        </div>

        <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px 14px; font-size: 12px; color: var(--text-muted);">
          <div style="font-weight: 700; color: var(--text-main); margin-bottom: 4px;">⚡ 1-Minute Supabase Setup Instructions:</div>
          <ol style="margin-left: 18px; display: flex; flex-direction: column; gap: 4px;">
            <li>Go to <a href="https://supabase.com" target="_blank" style="color: var(--accent-blue);">supabase.com</a> (free).</li>
            <li>Create a project, then open the <strong>SQL Editor</strong>.</li>
            <li>Paste and run the SQL code from <code>supabase_schema.sql</code>.</li>
            <li>Copy your <strong>Project URL</strong> and <strong>Anon Key</strong> (from Project Settings &gt; API) and paste them above.</li>
          </ol>
        </div>

        <div id="sync-modal-feedback" style="display: none; font-size: 12.5px; padding: 10px; border-radius: 4px;"></div>
      </div>
    `;

    const footerHtml = `
      ${this.isConnected ? `
        <button class="btn btn-secondary btn-sm" style="margin-right: auto; color: #b91c1c;" onclick="window.Zoosh.CloudSync.disconnect(); window.Zoosh.Modal.close(); window.Zoosh.App.showToast('Disconnected from cloud sync.');">
          Disconnect Cloud
        </button>
      ` : ''}
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.CloudSync.handleSaveModal()">
        Connect &amp; Sync Now &rarr;
      </button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '580px');
  },

  async handleSaveModal() {
    const url = document.getElementById('sync-supabase-url').value.trim();
    const key = document.getElementById('sync-supabase-key').value.trim();
    const feedback = document.getElementById('sync-modal-feedback');

    if (!url || !key) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#991b1b';
        feedback.textContent = 'Please enter both Supabase Project URL and Anon Key.';
      }
      return;
    }

    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.background = '#eff6ff';
      feedback.style.color = '#1e40af';
      feedback.textContent = 'Connecting and syncing state...';
    }

    const result = await this.connect(url, key);

    if (result.success) {
      window.Zoosh.Modal.close();
      if (window.Zoosh.App) {
        window.Zoosh.App.showToast('🟢 Connected to Supabase Cloud! Real-time sync is now active.');
      }
    } else {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#991b1b';
        feedback.textContent = 'Connection failed: ' + result.message;
      }
    }
  }
};
