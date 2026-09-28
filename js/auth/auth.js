/**
 * Zoosh Factory Control Room — Authentication & Role-Based Access Control (RBAC)
 * 
 * Features:
 * - Isolated credential storage: ZOOSH_AUTH_V1 (strictly separated from production data)
 * - Browser-side SHA-256 hashing with salt
 * - Roles: MANAGER (full access), VISITOR (strictly read-only)
 * - Code-level assertion guards for all write operations
 * - Session management with remember me support
 */
(function() {
  'use strict';

  const AUTH_STORAGE_KEY = 'ZOOSH_AUTH_V2';
  const SESSION_STORAGE_KEY = 'ZOOSH_SESSION_V2';
  const SALT = 'zoosh_salt_2026';

  // Precomputed SHA-256 hashes with SALT for default accounts
  const DEFAULT_MANAGER_HASH = '716d19c6d03204a0a5ff1d843ab699706a8699d1f13293599ba9a898f59afe81'; // zooshadmin1234
  const DEFAULT_VISITOR_HASH = '0e12124f9ce52b88e2121f8976841b050d78c01119e6416e3fd6a019042b365f'; // zooshadmin098

  function getStorage(type = 'local') {
    if (type === 'session' && typeof sessionStorage !== 'undefined') return sessionStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    if (!globalThis._mockStorage) {
      const store = new Map();
      globalThis._mockStorage = {
        getItem: (k) => store.get(k) || null,
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
      };
    }
    return globalThis._mockStorage;
  }

  async function sha256Hex(plainText) {
    const salted = plainText + SALT;
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const encoder = new TextEncoder();
      const data = encoder.encode(salted);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    try {
      const nodeCrypto = require('crypto');
      return nodeCrypto.createHash('sha256').update(salted).digest('hex');
    } catch (e) {
      // Fallback pseudo-hash for minimal environments
      let hash = 0;
      for (let i = 0; i < salted.length; i++) {
        hash = (hash << 5) - hash + salted.charCodeAt(i);
        hash |= 0;
      }
      return 'fb_' + Math.abs(hash).toString(16);
    }
  }

  function getDefaultAuthStore() {
    return {
      version: 2,
      users: [
        {
          id: 'usr_manager',
          username: 'zooshadmin',
          displayName: 'Factory Manager (Admin)',
          role: 'MANAGER',
          passwordHash: DEFAULT_MANAGER_HASH,
          active: true,
          createdAt: '2026-09-28'
        },
        {
          id: 'usr_visitor',
          username: 'zooshadmin1234',
          displayName: 'Factory Visitor',
          role: 'VISITOR',
          passwordHash: DEFAULT_VISITOR_HASH,
          active: true,
          createdAt: '2026-09-28'
        }
      ]
    };
  }

  const Auth = {
    _currentUser: null,
    _listeners: [],

    init() {
      const localStorage = getStorage('local');
      let authData = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) {
        authData = JSON.stringify(getDefaultAuthStore());
        localStorage.setItem(AUTH_STORAGE_KEY, authData);
      } else {
        try {
          const parsed = JSON.parse(authData);
          let modified = false;
          // Ensure zooshadmin exists
          if (!parsed.users.find(u => u.username === 'zooshadmin')) {
            parsed.users.push({
              id: 'usr_manager',
              username: 'zooshadmin',
              displayName: 'Factory Manager (Admin)',
              role: 'MANAGER',
              passwordHash: DEFAULT_MANAGER_HASH,
              active: true,
              createdAt: '2026-09-28'
            });
            modified = true;
          }
          // Ensure zooshadmin1234 exists
          if (!parsed.users.find(u => u.username === 'zooshadmin1234')) {
            parsed.users.push({
              id: 'usr_visitor',
              username: 'zooshadmin1234',
              displayName: 'Factory Visitor',
              role: 'VISITOR',
              passwordHash: DEFAULT_VISITOR_HASH,
              active: true,
              createdAt: '2026-09-28'
            });
            modified = true;
          }
          if (modified) {
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch (e) {}
      }

      // Check for active session in sessionStorage first, then localStorage
      const sessionStorage = getStorage('session');
      let sessionStr = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionStr) {
        try {
          const parsed = JSON.parse(sessionStr);
          // Verify user still exists and is active
          const user = this.getUserById(parsed.userId);
          if (user && user.active) {
            this._currentUser = {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              role: user.role
            };
          } else {
            this.logout();
          }
        } catch (e) {
          this.logout();
        }
      }
    },

    getAuthStore() {
      const storage = getStorage('local');
      const str = storage.getItem(AUTH_STORAGE_KEY);
      if (!str) {
        const defaults = getDefaultAuthStore();
        storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
      }
      try {
        return JSON.parse(str);
      } catch (e) {
        const defaults = getDefaultAuthStore();
        storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(defaults));
        return defaults;
      }
    },

    _saveAuthStore(data) {
      getStorage('local').setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
    },

    getUserById(id) {
      const store = this.getAuthStore();
      return store.users.find(u => u.id === id) || null;
    },

    getUserByUsername(username) {
      if (!username) return null;
      const store = this.getAuthStore();
      return store.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
    },

    async login(username, password, rememberMe = false) {
      if (!username || !password) {
        throw new Error('Please enter both username and password.');
      }

      const user = this.getUserByUsername(username);
      if (!user) {
        throw new Error('Invalid username or password.');
      }

      if (!user.active) {
        throw new Error('This user account has been disabled. Please contact the administrator.');
      }

      const hashed = await sha256Hex(password);
      if (hashed !== user.passwordHash) {
        throw new Error('Invalid username or password.');
      }

      const session = {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        loginTime: new Date().toISOString()
      };

      this._currentUser = session;

      // Persist session
      const sessionJson = JSON.stringify(session);
      getStorage('session').setItem(SESSION_STORAGE_KEY, sessionJson);
      if (rememberMe) {
        getStorage('local').setItem(SESSION_STORAGE_KEY, sessionJson);
      } else {
        getStorage('local').removeItem(SESSION_STORAGE_KEY);
      }

      this._notify();
      return this._currentUser;
    },

    logout() {
      this._currentUser = null;
      getStorage('session').removeItem(SESSION_STORAGE_KEY);
      getStorage('local').removeItem(SESSION_STORAGE_KEY);
      this._notify();
    },

    getSession() {
      return this._currentUser;
    },

    isAuthenticated() {
      return !!this._currentUser;
    },

    isManager() {
      return this._currentUser && this._currentUser.role === 'MANAGER';
    },

    isVisitor() {
      return this._currentUser && this._currentUser.role === 'VISITOR';
    },

    hasPermission(action) {
      if (!this._currentUser) return false;
      const role = this._currentUser.role;

      // Visitors have read-only access to view and filter
      if (role === 'VISITOR') {
        const readOnlyActions = ['view', 'filter', 'search'];
        return readOnlyActions.includes(action.toLowerCase());
      }

      // Managers have full access to all system actions
      if (role === 'MANAGER') {
        return true;
      }

      return false;
    },

    /**
     * Code-level assertion guard.
     * Throws an error immediately if the current user cannot perform the requested action.
     */
    assertPermission(action) {
      if (!this.isAuthenticated()) {
        const err = new Error('Authentication required. Please log in.');
        err.name = 'AuthRequiredError';
        throw err;
      }
      if (!this.hasPermission(action)) {
        const err = new Error(`Permission denied: Your role (${this._currentUser.role}) is read-only and cannot perform '${action}'. Only Managers have write permissions.`);
        err.name = 'PermissionDeniedError';
        throw err;
      }
      return true;
    },

    canCreate() { return this.hasPermission('create'); },
    canEdit() { return this.hasPermission('edit'); },
    canDelete() { return this.hasPermission('delete'); },
    canManageUsers() { return this.hasPermission('manage_users'); },
    canSchedule() { return this.hasPermission('schedule'); },
    canReset() { return this.hasPermission('reset'); },
    canExport() { return this.hasPermission('export'); },
    canImport() { return this.hasPermission('import'); },

    // --- User Administration (Manager Only) ---

    getUsers() {
      this.assertPermission('manage_users');
      const store = this.getAuthStore();
      return store.users.map(u => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        active: u.active,
        createdAt: u.createdAt
      }));
    },

    async addUser({ username, displayName, role, password }) {
      this.assertPermission('manage_users');
      if (!username || !password) throw new Error('Username and password are required.');
      if (this.getUserByUsername(username)) {
        throw new Error(`Username "${username}" already exists.`);
      }

      const validRoles = ['MANAGER', 'VISITOR'];
      const targetRole = validRoles.includes(role) ? role : 'VISITOR';
      const passwordHash = await sha256Hex(password);

      const newUser = {
        id: 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
        username: username.trim().toLowerCase(),
        displayName: displayName || username.trim(),
        role: targetRole,
        passwordHash: passwordHash,
        active: true,
        createdAt: new Date().toISOString().split('T')[0]
      };

      const store = this.getAuthStore();
      store.users.push(newUser);
      this._saveAuthStore(store);
      return newUser;
    },

    updateUserRole(userId, newRole) {
      this.assertPermission('manage_users');
      if (!['MANAGER', 'VISITOR'].includes(newRole)) throw new Error('Invalid role.');
      const store = this.getAuthStore();
      const user = store.users.find(u => u.id === userId);
      if (!user) throw new Error('User not found.');

      // Prevent demoting the last manager
      if (user.role === 'MANAGER' && newRole !== 'MANAGER') {
        const activeManagers = store.users.filter(u => u.role === 'MANAGER' && u.active && u.id !== userId);
        if (activeManagers.length === 0) {
          throw new Error('Cannot change role: Factory must have at least one active Manager.');
        }
      }

      user.role = newRole;
      this._saveAuthStore(store);

      // If updating current user's session
      if (this._currentUser && this._currentUser.id === userId) {
        this._currentUser.role = newRole;
      }
      return user;
    },

    toggleUserActive(userId) {
      this.assertPermission('manage_users');
      const store = this.getAuthStore();
      const user = store.users.find(u => u.id === userId);
      if (!user) throw new Error('User not found.');

      if (this._currentUser && this._currentUser.id === userId) {
        throw new Error('You cannot deactivate your own logged-in account.');
      }

      user.active = !user.active;
      this._saveAuthStore(store);
      return user;
    },

    async resetUserPassword(userId, newPassword) {
      this.assertPermission('manage_users');
      if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters.');
      }
      const store = this.getAuthStore();
      const user = store.users.find(u => u.id === userId);
      if (!user) throw new Error('User not found.');

      user.passwordHash = await sha256Hex(newPassword);
      this._saveAuthStore(store);
      return true;
    },

    async changeMyPassword(currentPassword, newPassword) {
      if (!this.isAuthenticated()) throw new Error('Not logged in.');
      if (!newPassword || newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters.');
      }

      const store = this.getAuthStore();
      const user = store.users.find(u => u.id === this._currentUser.id);
      if (!user) throw new Error('User account not found.');

      const currentHash = await sha256Hex(currentPassword);
      if (currentHash !== user.passwordHash) {
        throw new Error('Current password is incorrect.');
      }

      user.passwordHash = await sha256Hex(newPassword);
      this._saveAuthStore(store);
      return true;
    },

    subscribe(listener) {
      if (typeof listener === 'function') {
        this._listeners.push(listener);
      }
      return () => {
        this._listeners = this._listeners.filter(l => l !== listener);
      };
    },

    _notify() {
      this._listeners.forEach(fn => {
        try { fn(this._currentUser); } catch (e) { console.error('Auth listener error:', e); }
      });
    },

    // Utilities for test injection & direct mocking
    _setSessionDirect(userObj) {
      this._currentUser = userObj;
      this._notify();
    }
  };

  // Expose to window / global
  if (typeof window !== 'undefined') {
    window.Zoosh = window.Zoosh || {};
    window.Zoosh.Auth = Auth;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Auth;
  }
})();
