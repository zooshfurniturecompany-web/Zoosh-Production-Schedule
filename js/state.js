/**
 * State Management & LocalStorage Persistence
 * Reactive store with event dispatching, persistence, import/export, and data resets.
 * 
 * Data Hierarchy:
 * CLIENT / SRL (SRL is client/customer short-form identifier)
 *   ↓
 * PROJECT
 *   ↓
 * FURNITURE ITEMS (NO SRL numbers on furniture items!)
 *   ↓
 * PRODUCTION PROCESSES
 *   ↓
 * EMPLOYEE
 *   ↓
 * SCHEDULE
 * 
 * Security:
 * All write methods are guarded with Auth.assertPermission().
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.State = {
  _state: null,
  _listeners: [],

  _getStorage() {
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
  },

  _checkPermission(action) {
    if (window.Zoosh.Auth && typeof window.Zoosh.Auth.assertPermission === 'function') {
      window.Zoosh.Auth.assertPermission(action);
    }
  },

  init() {
    const key = window.Zoosh.Config.STORAGE_KEY;
    const storage = this._getStorage();
    const saved = storage.getItem(key);
    if (saved) {
      try {
        this._state = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved state, resetting to demo data:', e);
        this._state = window.Zoosh.DemoData.getInitialState();
      }
    } else {
      this._state = window.Zoosh.DemoData.getInitialState();
    }

    // Ensure synchronized furniture / srls aliases
    this._syncFurnitureAliases();

    // Ensure clients array exists
    if (!this._state.clients) {
      const defaultState = window.Zoosh.DemoData.getInitialState();
      this._state.clients = defaultState.clients || [];
    }

    // Always ensure current date is configured
    if (!this._state.currentDate) {
      this._state.currentDate = window.Zoosh.Config.CURRENT_DATE;
    }

    // Ensure lastDataUpdatedAt exists
    if (!this._state.lastDataUpdatedAt) {
      this._state.lastDataUpdatedAt = '2026-09-02T19:45:00.000Z';
    }

    // Ensure reminders array exists
    if (!this._state.reminders) {
      const defaultState = window.Zoosh.DemoData.getInitialState();
      this._state.reminders = defaultState.reminders || [];
    }

    // Run initial schedule calculation
    this.recalculate();
  },

  touchDataUpdated() {
    if (!this._state) return;
    this._state.lastDataUpdatedAt = new Date().toISOString();
  },

  getLastDataUpdatedAt() {
    return (this._state && this._state.lastDataUpdatedAt) || '2026-09-02T19:45:00.000Z';
  },

  _syncFurnitureAliases() {
    if (!this._state) return;
    if (this._state.furniture && !this._state.srls) {
      this._state.srls = this._state.furniture;
    } else if (this._state.srls && !this._state.furniture) {
      this._state.furniture = this._state.srls;
    } else if (this._state.furniture && this._state.srls && this._state.furniture !== this._state.srls) {
      this._state.srls = this._state.furniture;
    }
  },

  getState() {
    return this._state;
  },

  subscribe(listener) {
    if (typeof listener === 'function') {
      this._listeners.push(listener);
    }
    return () => {
      this._listeners = this._listeners.filter(l => l !== listener);
    };
  },

  notify() {
    this._listeners.forEach(fn => {
      try {
        fn(this._state);
      } catch (err) {
        console.error('Error in state subscriber:', err);
      }
    });
  },

  persist() {
    try {
      this._syncFurnitureAliases();
      this._getStorage().setItem(window.Zoosh.Config.STORAGE_KEY, JSON.stringify(this._state));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  /**
   * Recalculates all schedules, dependencies, and project deadline statuses,
   * persists to localStorage, and notifies listeners.
   */
  recalculate(skipCloudPush = false) {
    if (window.Zoosh.Scheduler) {
      this._state = window.Zoosh.Scheduler.recalculateAll(this._state);
      this._syncFurnitureAliases();
    }
    this.persist();
    this.notify();

    // Push to Supabase Realtime if cloud sync is connected
    if (!skipCloudPush && window.Zoosh.CloudSync && window.Zoosh.CloudSync.isConnected) {
      window.Zoosh.CloudSync.pushState(this._state);
    }
  },

  /**
   * Applies state received from remote user via Supabase Realtime
   */
  applyRemoteState(remoteState, author = 'Cloud') {
    if (!remoteState || !remoteState.projects) return;
    this._state = remoteState;
    this._syncFurnitureAliases();
    // Skip pushing back to avoid ping-pong loop
    this.recalculate(true);
  },

  // ==========================================
  // 1. CLIENT / SRL CRUD
  // SRL belongs to Client/Customer
  // ==========================================

  getClients() {
    return this._state.clients || [];
  },

  getClient(id) {
    return (this._state.clients || []).find(c => c.id === id) || null;
  },

  getClientBySrl(srl) {
    return (this._state.clients || []).find(c => Number(c.srl) === Number(srl)) || null;
  },

  getNextClientSrl() {
    const clients = this._state.clients || [];
    if (clients.length === 0) return 101;
    const max = Math.max(...clients.map(c => Number(c.srl) || 100));
    return max + 1;
  },

  addClient(clientData) {
    this._checkPermission('create');

    const srl = Number(clientData.srl) || this.getNextClientSrl();
    const existing = this.getClientBySrl(srl);
    if (existing) {
      throw new Error(`A client with SRL ${srl} already exists (${existing.name}). Please use a unique SRL number.`);
    }

    const id = 'client_' + (clientData.name ? clientData.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'client') + '_' + Date.now().toString(36);
    const newClient = {
      id: id,
      srl: srl,
      name: (clientData.name || 'New Client').trim(),
      location: (clientData.location || '').trim(),
      phone: (clientData.phone || '').trim(),
      notes: (clientData.notes || '').trim(),
      createdAt: new Date().toISOString().split('T')[0]
    };

    this._state.clients = this._state.clients || [];
    this._state.clients.push(newClient);
    this.touchDataUpdated();
    this.recalculate();
    return newClient;
  },

  updateClient(id, clientData) {
    this._checkPermission('edit');

    const client = (this._state.clients || []).find(c => c.id === id);
    if (!client) throw new Error('Client not found');

    if (clientData.srl !== undefined && Number(clientData.srl) !== Number(client.srl)) {
      const targetSrl = Number(clientData.srl);
      const existing = (this._state.clients || []).find(c => Number(c.srl) === targetSrl && c.id !== id);
      if (existing) {
        throw new Error(`A client with SRL ${targetSrl} already exists (${existing.name}).`);
      }
      client.srl = targetSrl;
    }

    if (clientData.name) client.name = clientData.name.trim();
    if (clientData.location !== undefined) client.location = clientData.location.trim();
    if (clientData.phone !== undefined) client.phone = clientData.phone.trim();
    if (clientData.notes !== undefined) client.notes = clientData.notes.trim();

    // Propagate updated client info to linked projects
    (this._state.projects || []).forEach(p => {
      if (p.clientId === id) {
        p.clientName = client.name;
        p.clientSrl = client.srl;
      }
    });

    this.touchDataUpdated();
    this.recalculate();
    return client;
  },

  deleteClient(id) {
    this._checkPermission('delete');

    // Cascade delete: find all projects for this client
    const projectsToDelete = (this._state.projects || []).filter(p => p.clientId === id);
    projectsToDelete.forEach(proj => {
      // Delete furniture and processes for project
      const furnIds = (this._state.furniture || []).filter(f => f.projectId === proj.id).map(f => f.id);
      this._state.processes = (this._state.processes || []).filter(p => !furnIds.includes(p.furnitureId || p.srlId));
      this._state.furniture = (this._state.furniture || []).filter(f => f.projectId !== proj.id);
      this._state.srls = this._state.furniture;
    });

    this._state.projects = (this._state.projects || []).filter(p => p.clientId !== id);
    this._state.clients = (this._state.clients || []).filter(c => c.id !== id);
    this.touchDataUpdated();
    this.recalculate();
  },

  // ==========================================
  // 2. PROJECT CRUD
  // Belongs to Client / SRL
  // ==========================================

  addProject(projectData) {
    this._checkPermission('create');

    const id = 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    
    // Resolve client
    let clientId = projectData.clientId;
    let client = null;
    if (clientId) {
      client = this.getClient(clientId);
    }
    if (!client && (this._state.clients || []).length > 0) {
      client = this._state.clients[0];
      clientId = client.id;
    }

    const newProject = {
      id: id,
      clientId: clientId || null,
      clientName: client ? client.name : (projectData.clientName || 'Client'),
      clientSrl: client ? client.srl : (projectData.clientSrl || null),
      name: projectData.name || 'New Project',
      location: projectData.location || (client ? client.location : 'Factory Floor'),
      confirmedDate: projectData.confirmedDate || window.Zoosh.Config.CURRENT_DATE,
      deliveryDeadline: projectData.deliveryDeadline, // Fixed target
      notes: projectData.notes || '',
      furnitureIds: [],
      srlIds: [],
      isDelivered: false
    };

    this._state.projects = this._state.projects || [];
    this._state.projects.push(newProject);
    this.touchDataUpdated();
    this.recalculate();
    return newProject;
  },

  updateProject(id, projectData) {
    this._checkPermission('edit');

    const proj = (this._state.projects || []).find(p => p.id === id);
    if (!proj) return null;

    if (projectData.clientId && projectData.clientId !== proj.clientId) {
      const client = this.getClient(projectData.clientId);
      if (client) {
        proj.clientId = client.id;
        proj.clientName = client.name;
        proj.clientSrl = client.srl;
      }
    }

    Object.assign(proj, projectData);
    this.touchDataUpdated();
    this.recalculate();
    return proj;
  },

  markProjectDelivered(id, isDelivered = true) {
    this._checkPermission('edit');
    const proj = (this._state.projects || []).find(p => p.id === id);
    if (!proj) return null;

    proj.isDelivered = Boolean(isDelivered);
    if (isDelivered) {
      proj.status = 'DELIVERED';
      proj.deliveredAt = new Date().toISOString().split('T')[0];
    } else {
      proj.status = proj.completionPercent === 100 ? 'COMPLETED' : 'IN_PROGRESS';
      delete proj.deliveredAt;
    }

    this.touchDataUpdated();
    this.recalculate();
    return proj;
  },

  deleteProject(id) {
    this._checkPermission('delete');

    // Delete project and its furniture items and processes
    const furnToDelete = (this._state.furniture || []).filter(s => s.projectId === id).map(s => s.id);
    this._state.processes = (this._state.processes || []).filter(p => !furnToDelete.includes(p.furnitureId || p.srlId));
    this._state.furniture = (this._state.furniture || []).filter(s => s.projectId !== id);
    this._state.srls = this._state.furniture;
    this._state.projects = (this._state.projects || []).filter(p => p.id !== id);
    this.touchDataUpdated();
    this.recalculate();
  },

  // ==========================================
  // 3. FURNITURE CRUD
  // Belongs to Project. NO SRL numbers on furniture!
  // ==========================================

  addFurniture(furnitureData, processesList) {
    this._checkPermission('create');

    const furnId = 'furn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const furnitureName = (furnitureData.name || furnitureData.furnitureName || 'New Furniture Item').trim();
    
    const newProcesses = (processesList || []).map((p, idx) => ({
      id: `proc_${furnId.replace('furn_', '')}_${idx + 1}`,
      furnitureId: furnId,
      srlId: furnId, // backward compatibility alias for engine
      projectId: furnitureData.projectId,
      sequence: idx + 1,
      department: p.department,
      employeeId: p.employeeId,
      durationDays: parseFloat(p.durationDays) || 1,
      status: 'PENDING',
      progressPercent: 0,
      notes: p.notes || ''
    }));

    const newFurniture = {
      id: furnId,
      projectId: furnitureData.projectId,
      name: furnitureName,
      furnitureName: furnitureName, // backward compatibility alias
      flowTypeId: furnitureData.flowTypeId || null,
      startDate: furnitureData.startDate || window.Zoosh.Config.CURRENT_DATE,
      status: 'NOT_STARTED',
      processIds: newProcesses.map(p => p.id)
    };

    this._state.furniture = this._state.furniture || [];
    this._state.furniture.push(newFurniture);
    this._state.srls = this._state.furniture; // synchronized alias

    this._state.processes = this._state.processes || [];
    this._state.processes.push(...newProcesses);

    // Link into project
    const proj = (this._state.projects || []).find(p => p.id === furnitureData.projectId);
    if (proj) {
      proj.furnitureIds = proj.furnitureIds || [];
      proj.furnitureIds.push(furnId);
      proj.srlIds = proj.srlIds || [];
      proj.srlIds.push(furnId);
    }

    this.touchDataUpdated();
    this.recalculate();
    return newFurniture;
  },

  updateFurniture(id, furnitureData) {
    this._checkPermission('edit');

    const item = (this._state.furniture || []).find(f => f.id === id);
    if (!item) return null;

    if (furnitureData.name) {
      item.name = furnitureData.name;
      item.furnitureName = furnitureData.name;
    }
    Object.assign(item, furnitureData);
    this.touchDataUpdated();
    this.recalculate();
    return item;
  },

  deleteFurniture(furnId) {
    this._checkPermission('delete');

    this._state.processes = (this._state.processes || []).filter(p => (p.furnitureId || p.srlId) !== furnId);
    const furn = (this._state.furniture || []).find(s => s.id === furnId);
    if (furn) {
      const proj = (this._state.projects || []).find(p => p.id === furn.projectId);
      if (proj) {
        if (proj.furnitureIds) proj.furnitureIds = proj.furnitureIds.filter(id => id !== furnId);
        if (proj.srlIds) proj.srlIds = proj.srlIds.filter(id => id !== furnId);
      }
    }
    this._state.furniture = (this._state.furniture || []).filter(s => s.id !== furnId);
    this._state.srls = this._state.furniture;
    this.touchDataUpdated();
    this.recalculate();
  },

  // Legacy aliases
  addSrl(data, procs) {
    return this.addFurniture(data, procs);
  },

  deleteSrl(srlId) {
    return this.deleteFurniture(srlId);
  },

  getNextSrlNumber() {
    return this.getNextClientSrl();
  },

  // ==========================================
  // 4. PROCESS, EMPLOYEE, MANPOWER & FLOW CRUD
  // ==========================================

  updateProcess(id, procData) {
    this._checkPermission('edit');
    const proc = (this._state.processes || []).find(p => p.id === id);
    if (!proc) return null;
    Object.assign(proc, procData);
    this.touchDataUpdated();
    this.recalculate();
    return proc;
  },

  addEmployee(empData) {
    this._checkPermission('create');
    const id = 'emp_' + (empData.name.toLowerCase().replace(/[^a-z0-9]/g, '_')) + '_' + Date.now().toString().slice(-4);
    const newEmp = {
      id: id,
      name: empData.name,
      department: empData.department,
      secondaryDepartments: empData.secondaryDepartments || [],
      joiningDate: empData.joiningDate || window.Zoosh.Config.CURRENT_DATE,
      active: empData.active !== undefined ? empData.active : true,
      standardHoursPerDay: Number(empData.standardHoursPerDay) || 8,
      overtimeAvailable: Boolean(empData.overtimeAvailable),
      avatarColor: empData.avatarColor || '#64748b'
    };
    this._state.employees.push(newEmp);
    this.touchDataUpdated();
    this.recalculate();
    return newEmp;
  },

  updateEmployee(id, empData) {
    this._checkPermission('edit');
    const emp = (this._state.employees || []).find(e => e.id === id);
    if (!emp) return null;
    Object.assign(emp, empData);
    this.touchDataUpdated();
    this.recalculate();
    return emp;
  },

  deleteEmployee(id) {
    this._checkPermission('delete');
    this._state.employees = (this._state.employees || []).filter(e => e.id !== id);
    this.touchDataUpdated();
    this.recalculate();
  },

  addManpowerRecord(recordData) {
    this._checkPermission('create');
    const id = 'manpower_' + Date.now();
    const newRec = {
      id: id,
      employeeId: recordData.employeeId,
      action: recordData.action || 'LEAVE',
      fromDate: recordData.fromDate,
      tillDate: recordData.tillDate,
      status: recordData.status || 'APPROVED',
      notes: recordData.notes || ''
    };
    this._state.manpowerRecords.push(newRec);
    this.touchDataUpdated();
    this.recalculate();
    return newRec;
  },

  deleteManpowerRecord(id) {
    this._checkPermission('delete');
    this._state.manpowerRecords = (this._state.manpowerRecords || []).filter(m => m.id !== id);
    this.touchDataUpdated();
    this.recalculate();
  },

  addFlowType(flowData) {
    this._checkPermission('create');
    const id = 'flow_type_' + Date.now();
    const newFlow = {
      id: id,
      code: flowData.code || 'CUSTOM',
      name: flowData.name,
      description: flowData.description || '',
      steps: flowData.steps || []
    };
    this._state.flowTypes.push(newFlow);
    this.touchDataUpdated();
    this.persist();
    this.notify();
    return newFlow;
  },

  deleteFlowType(id) {
    this._checkPermission('delete');
    this._state.flowTypes = (this._state.flowTypes || []).filter(f => f.id !== id);
    this.touchDataUpdated();
    this.persist();
    this.notify();
  },

  // ==========================================
  // 5. OPERATIONAL REMINDERS CRUD
  // ==========================================

  getReminders() {
    return this._state.reminders || [];
  },

  addReminder(reminderData) {
    this._checkPermission('create');
    const id = 'rem_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const newRem = {
      id: id,
      title: (reminderData.title || reminderData.type || 'Reminder').trim(),
      type: reminderData.type || 'Purchase Order Follow-up',
      date: reminderData.date || this._state.currentDate,
      projectId: reminderData.projectId || null,
      projectName: reminderData.projectName || '',
      notes: reminderData.notes || '',
      status: reminderData.status || 'PENDING',
      priority: reminderData.priority || 'MEDIUM',
      createdAt: new Date().toISOString()
    };
    this._state.reminders = this._state.reminders || [];
    this._state.reminders.push(newRem);
    this.touchDataUpdated();
    this.recalculate();
    return newRem;
  },

  updateReminder(id, reminderData) {
    this._checkPermission('edit');
    const rem = (this._state.reminders || []).find(r => r.id === id);
    if (!rem) return null;
    Object.assign(rem, reminderData);
    this.touchDataUpdated();
    this.recalculate();
    return rem;
  },

  deleteReminder(id) {
    this._checkPermission('delete');
    this._state.reminders = (this._state.reminders || []).filter(r => r.id !== id);
    this.touchDataUpdated();
    this.recalculate();
  },

  // ==========================================
  // 5. DATA LIFECYCLE MANAGEMENT (RBAC Controlled)
  // Accounts and Auth store are NEVER altered by these actions!
  // ==========================================

  resetDemoData() {
    this._checkPermission('reset');
    this._state = window.Zoosh.DemoData.getInitialState();
    this._syncFurnitureAliases();
    this.touchDataUpdated();
    this.recalculate();
  },

  startFresh() {
    this._checkPermission('reset');
    const initial = window.Zoosh.DemoData.getInitialState();
    this._state = {
      currentDate: window.Zoosh.Config.CURRENT_DATE,
      lastDataUpdatedAt: new Date().toISOString(),
      employees: initial.employees, // retain basic team template
      flowTypes: initial.flowTypes, // retain standard flow types
      clients: [],
      projects: [],
      furniture: [],
      srls: [],
      processes: [],
      manpowerRecords: [],
      reminders: []
    };
    this._syncFurnitureAliases();
    this.touchDataUpdated();
    this.recalculate();
  },

  clearAllProductionData(confirmationText) {
    this._checkPermission('reset');
    if (confirmationText !== 'DELETE ALL DATA') {
      throw new Error('Confirmation string did not match. Action aborted.');
    }
    const initial = window.Zoosh.DemoData.getInitialState();
    this._state = {
      currentDate: window.Zoosh.Config.CURRENT_DATE,
      lastDataUpdatedAt: new Date().toISOString(),
      employees: initial.employees,
      flowTypes: initial.flowTypes,
      clients: [],
      projects: [],
      furniture: [],
      srls: [],
      processes: [],
      manpowerRecords: [],
      reminders: []
    };
    this._syncFurnitureAliases();
    this.touchDataUpdated();
    this.recalculate();
  },

  exportJson() {
    this._checkPermission('export');
    // Export strictly production data, never include auth accounts
    const exportPayload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      lastDataUpdatedAt: this._state.lastDataUpdatedAt,
      currentDate: this._state.currentDate,
      clients: this._state.clients || [],
      projects: this._state.projects || [],
      furniture: this._state.furniture || [],
      processes: this._state.processes || [],
      employees: this._state.employees || [],
      flowTypes: this._state.flowTypes || [],
      manpowerRecords: this._state.manpowerRecords || [],
      reminders: this._state.reminders || []
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `zoosh_production_backup_${window.Zoosh.Config.CURRENT_DATE}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  importJson(jsonString) {
    this._checkPermission('import');
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.projects || !parsed.employees || !parsed.processes) {
        throw new Error('Invalid schema: Missing projects, employees, or processes.');
      }
      this._state = parsed;
      if (!this._state.lastDataUpdatedAt) {
        this._state.lastDataUpdatedAt = new Date().toISOString();
      }
      if (!this._state.reminders) {
        this._state.reminders = [];
      }
      this._syncFurnitureAliases();
      this.touchDataUpdated();
      this.recalculate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
