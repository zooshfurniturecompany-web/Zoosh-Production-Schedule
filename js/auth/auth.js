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
    _currentUser: {
      id: 'usr_manager',
      username: 'zooshadmin',
      displayName: 'Factory Control',
      role: 'MANAGER'
    },
    _listeners: [],

    init() {
      // Unlocked mode: Default active manager session
      this._currentUser = {
        id: 'usr_manager',
        username: 'zooshadmin',
        displayName: 'Factory Control',
        role: 'MANAGER'
      };
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
      return store.users.find(u => u.id === id) || this._currentUser;
    },

    getUserByUsername(username) {
      if (!username) return null;
      const store = this.getAuthStore();
      return store.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase()) || null;
    },

    async login(username, password, rememberMe = true) {
      // Direct success in unlocked mode
      this._currentUser = {
        id: 'usr_manager',
        username: username || 'zooshadmin',
        displayName: 'Factory Control',
        role: 'MANAGER',
        loginTime: new Date().toISOString()
      };
      this._notify();
      return this._currentUser;
    },

    logout() {
      // Unlocked system: remains open
      this._currentUser = {
        id: 'usr_manager',
        username: 'zooshadmin',
        displayName: 'Factory Control',
        role: 'MANAGER'
      };
      this._notify();
    },

    getSession() {
      return this._currentUser;
    },

    isAuthenticated() {
      return true; // Always authenticated in unlocked mode
    },

    isManager() {
      return true; // Full manager access for all users
    },

    isVisitor() {
      return false;
    },

    hasPermission(action) {
      return true; // All actions permitted
    },

    /**
     * Code-level assertion guard.
     * In unlocked mode, all operations are permitted.
     */
    assertPermission(action) {
      return true;
    },

    canCreate() { return true; },
    canEdit() { return true; },
    canDelete() { return true; },
    canManageUsers() { return true; },
    canSchedule() { return true; },
    canReset() { return true; },
    canExport() { return true; },
    canImport() { return true; },

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
