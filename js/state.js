/**
 * State Management & LocalStorage Persistence
 * Reactive store with event dispatching, persistence, import/export, and data resets.
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

    // Always ensure current date is configured
    if (!this._state.currentDate) {
      this._state.currentDate = window.Zoosh.Config.CURRENT_DATE;
    }

    // Run initial schedule calculation
    this.recalculate();
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
    // Skip pushing back to avoid ping-pong loop
    this.recalculate(true);
  },

  // --- CRUD Operations ---

  getNextSrlNumber() {
    const srls = this._state.srls || [];
    if (srls.length === 0) return 101;
    const max = Math.max(...srls.map(s => Number(s.srlNumber) || 100));
    return max + 1;
  },

  addProject(projectData) {
    const id = 'proj_' + Date.now();
    const newProject = {
      id: id,
      name: projectData.name || 'New Project',
      clientName: projectData.clientName || 'Client',
      location: projectData.location || 'Factory Floor',
      confirmedDate: projectData.confirmedDate || window.Zoosh.Config.CURRENT_DATE,
      deliveryDeadline: projectData.deliveryDeadline, // Fixed target
      notes: projectData.notes || '',
      srlIds: []
    };
    this._state.projects.push(newProject);
    this.recalculate();
    return newProject;
  },

  updateProject(id, projectData) {
    const proj = this._state.projects.find(p => p.id === id);
    if (!proj) return null;
    Object.assign(proj, projectData);
    this.recalculate();
    return proj;
  },

  deleteProject(id) {
    // Delete project and related SRLs and processes
    const srlsToDelete = this._state.srls.filter(s => s.projectId === id).map(s => s.id);
    this._state.processes = this._state.processes.filter(p => !srlsToDelete.includes(p.srlId));
    this._state.srls = this._state.srls.filter(s => s.projectId !== id);
    this._state.projects = this._state.projects.filter(p => p.id !== id);
    this.recalculate();
  },

  addSrl(srlData, processesList) {
    const srlNumber = this.getNextSrlNumber();
    const srlId = 'srl_' + srlNumber;
    
    const newProcesses = (processesList || []).map((p, idx) => ({
      id: `proc_${srlNumber}_${idx + 1}`,
      srlId: srlId,
      projectId: srlData.projectId,
      sequence: idx + 1,
      department: p.department,
      employeeId: p.employeeId,
      durationDays: parseFloat(p.durationDays) || 1,
      status: 'PENDING',
      progressPercent: 0,
      notes: p.notes || ''
    }));

    const newSrl = {
      id: srlId,
      srlNumber: srlNumber,
      projectId: srlData.projectId,
      furnitureName: srlData.furnitureName,
      flowTypeId: srlData.flowTypeId || null,
      startDate: srlData.startDate || window.Zoosh.Config.CURRENT_DATE,
      status: 'NOT_STARTED',
      processIds: newProcesses.map(p => p.id)
    };

    this._state.srls.push(newSrl);
    this._state.processes.push(...newProcesses);

    // Link into project
    const proj = this._state.projects.find(p => p.id === srlData.projectId);
    if (proj) {
      proj.srlIds = proj.srlIds || [];
      proj.srlIds.push(srlId);
    }

    this.recalculate();
    return newSrl;
  },

  updateProcess(id, procData) {
    const proc = this._state.processes.find(p => p.id === id);
    if (!proc) return null;
    Object.assign(proc, procData);
    this.recalculate();
    return proc;
  },

  deleteSrl(srlId) {
    this._state.processes = this._state.processes.filter(p => p.srlId !== srlId);
    const srl = this._state.srls.find(s => s.id === srlId);
    if (srl) {
      const proj = this._state.projects.find(p => p.id === srl.projectId);
      if (proj && proj.srlIds) {
        proj.srlIds = proj.srlIds.filter(id => id !== srlId);
      }
    }
    this._state.srls = this._state.srls.filter(s => s.id !== srlId);
    this.recalculate();
  },

  addEmployee(empData) {
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
    this.recalculate();
    return newEmp;
  },

  updateEmployee(id, empData) {
    const emp = this._state.employees.find(e => e.id === id);
    if (!emp) return null;
    Object.assign(emp, empData);
    this.recalculate();
    return emp;
  },

  deleteEmployee(id) {
    this._state.employees = this._state.employees.filter(e => e.id !== id);
    this.recalculate();
  },

  addManpowerRecord(recordData) {
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
    this.recalculate();
    return newRec;
  },

  deleteManpowerRecord(id) {
    this._state.manpowerRecords = this._state.manpowerRecords.filter(m => m.id !== id);
    this.recalculate();
  },

  addFlowType(flowData) {
    const id = 'flow_type_' + Date.now();
    const newFlow = {
      id: id,
      code: flowData.code || 'CUSTOM',
      name: flowData.name,
      description: flowData.description || '',
      steps: flowData.steps || []
    };
    this._state.flowTypes.push(newFlow);
    this.persist();
    this.notify();
    return newFlow;
  },

  deleteFlowType(id) {
    this._state.flowTypes = this._state.flowTypes.filter(f => f.id !== id);
    this.persist();
    this.notify();
  },

  // --- Reset & Import/Export ---

  resetDemoData() {
    this._state = window.Zoosh.DemoData.getInitialState();
    this.recalculate();
  },

  startFresh() {
    const initial = window.Zoosh.DemoData.getInitialState();
    this._state = {
      currentDate: window.Zoosh.Config.CURRENT_DATE,
      employees: initial.employees, // retain basic team template
      flowTypes: initial.flowTypes, // retain standard flow types
      projects: [],
      srls: [],
      processes: [],
      manpowerRecords: []
    };
    this.recalculate();
  },

  exportJson() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this._state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `zoosh_production_backup_${window.Zoosh.Config.CURRENT_DATE}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  importJson(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.projects || !parsed.employees || !parsed.processes) {
        throw new Error('Invalid schema: Missing projects, employees, or processes.');
      }
      this._state = parsed;
      this.recalculate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};
