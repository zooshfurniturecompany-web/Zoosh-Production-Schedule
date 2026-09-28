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

  scheduleRetry() {
    if (!this._reconnectTimer) {
      this._reconnectTimer = setTimeout(() => {
        this._reconnectTimer = null;
        this.init();
      }, 4000);
    }
  },

  updateStatusUI() {
    const badgeEl = document.getElementById('cloud-sync-badge');
    const mobileBadgeEl = document.getElementById('mobile-cloud-badge');

    if (badgeEl) {
      badgeEl.className = this.isConnected ? 'badge badge-on-schedule' : 'badge badge-at-risk';
      badgeEl.style.cursor = 'default';
      badgeEl.style.pointerEvents = 'none';
      badgeEl.innerHTML = `
        <span style="width: 7px; height: 7px; border-radius: 50%; background: ${this.isConnected ? '#10b981' : '#f59e0b'}; display: inline-block;"></span>
        <span>${this.isConnected ? (this.isSyncing ? 'Syncing...' : 'Live Synced') : 'Connecting...'}</span>
      `;
      badgeEl.title = this.isConnected ? 'Real-time multi-user sync is active.' : 'Connecting to cloud sync...';
    }

    if (mobileBadgeEl) {
      mobileBadgeEl.className = this.isConnected ? 'badge badge-on-schedule' : 'badge badge-at-risk';
      mobileBadgeEl.style.cursor = 'default';
      mobileBadgeEl.style.pointerEvents = 'none';
      mobileBadgeEl.innerHTML = `
        <span style="width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block;"></span>
        <span>${this.isConnected ? 'Live Synced' : 'Syncing'}</span>
      `;
    }
  },

  openConfigModal() {
    // Completely silent: no modal or credentials form shown
    if (window.Zoosh.App) {
      window.Zoosh.App.showToast(this.isConnected ? '🟢 Multi-user realtime sync is active.' : 'Connecting to cloud...');
    }
  }
};
