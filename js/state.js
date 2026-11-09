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

    // Always ensure current date is aligned with today's live date
    this._state.currentDate = window.Zoosh.Config.CURRENT_DATE;

    // Ensure lastDataUpdatedAt exists
    if (!this._state.lastDataUpdatedAt) {
      this._state.lastDataUpdatedAt = '2026-09-02T19:45:00.000Z';
    }

    // Ensure reminders array exists
    if (!this._state.reminders) {
      const defaultState = window.Zoosh.DemoData.getInitialState();
      this._state.reminders = defaultState.reminders || [];
    }

    // Ensure quotation tracking map exists
    if (!this._state.quotationTracking) {
      this._state.quotationTracking = {};
    }

    // Ensure estimates map exists
    if (!this._state.estimates) {
      this._state.estimates = {};
    }

    // Ensure sample Ansar Changaramkulam project is seeded for excel estimate verification
    this._seedAnsarChangaramkulamDemo();

    // Ensure product codes follow CLIENTCODE 001 format
    this._migrateProductCodes();

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
    this._migrateProductCodes();
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

  /**
   * Auto-generate 3-letter client short code from Client Name
   * e.g. "Ganeshan" -> "GNS", "Sreelal" -> "SRL", "Rajeev Babu" -> "RJB"
   */
  generateClientCode(name) {
    if (!name || typeof name !== 'string') return 'PRD';
    const clean = name.trim().toUpperCase();
    if (!clean) return 'PRD';

    const words = clean.split(/[\s\-_]+/).filter(Boolean);
    if (words.length >= 3) {
      return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
    }
    if (words.length === 2) {
      const w1 = words[0];
      const w2 = words[1];
      const w1Cons = w1.slice(1).replace(/[AEIOU]/g, '');
      const mid = w1Cons[0] || w1[1] || '';
      return (w1[0] + mid + w2[0]).substring(0, 3).toUpperCase();
    }

    const word = words[0];
    const consonants = word.split('').filter((ch, idx) => idx === 0 || !'AEIOU'.includes(ch));
    if (consonants.length >= 3) {
      return (consonants[0] + consonants[1] + consonants[2]).toUpperCase();
    }
    return word.replace(/[^A-Z0-9]/g, '').substring(0, 3).padEnd(3, 'X').toUpperCase();
  },

  /**
   * Get next sequential product code for furniture items under a client
   * Format: CLIENTCODE 001, CLIENTCODE 002, CLIENTCODE 003
   * e.g. Ganesh -> "GNS 001", Sreelal -> "SRL 001", Rajeev Babu -> "RJB 001"
   */
  getNextProductCode(projectId) {
    const proj = (this._state.projects || []).find(p => p.id === projectId);
    let clientCode = 'PRD';
    let client = null;
    if (proj) {
      client = (this._state.clients || []).find(c => c.id === proj.clientId);
      if (client && (client.code || client.clientCode)) {
        clientCode = client.code || client.clientCode;
      } else if (client && client.name) {
        clientCode = this.generateClientCode(client.name);
      } else if (proj.clientCode) {
        clientCode = proj.clientCode;
      } else if (proj.clientName) {
        clientCode = this.generateClientCode(proj.clientName);
      } else if (proj.name) {
        clientCode = this.generateClientCode(proj.name);
      }
    }

    // Sequence per client across all client's projects
    const clientProjects = (this._state.projects || []).filter(p => client && p.clientId === client.id).map(p => p.id);
    const clientProjIds = new Set(clientProjects.length > 0 ? clientProjects : [projectId]);
    const items = (this._state.furniture || []).filter(f => clientProjIds.has(f.projectId));

    const existingNums = items.map(item => {
      const c = (item.productCode || item.itemCode || '').trim();
      if (!c) return 0;
      const match = c.match(new RegExp(`^${clientCode}\\s*(\\d+)`, 'i')) || c.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    }).filter(n => n > 0 && n < 10000);

    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    return `${clientCode} ${String(nextNum).padStart(3, '0')}`;
  },

  /**
   * Resolves or ensures a clean, compliant product code for any furniture item
   * e.g. "GNS 001", "SRL 001", "RJB 001"
   */
  getItemProductCode(item) {
    if (!item) return '';
    const proj = (this._state.projects || []).find(p => p.id === item.projectId);
    const client = (this._state.clients || []).find(c => c.id === (proj ? proj.clientId : null));
    let clientCode = 'PRD';
    if (client && (client.code || client.clientCode)) {
      clientCode = client.code || client.clientCode;
    } else if (client && client.name) {
      clientCode = this.generateClientCode(client.name);
    } else if (proj && proj.clientName) {
      clientCode = this.generateClientCode(proj.clientName);
    } else if (proj && proj.name) {
      clientCode = this.generateClientCode(proj.name);
    }

    const c = (item.productCode || item.itemCode || '').trim();
    // If it already matches ${clientCode} \d{3}, return as is
    if (c && new RegExp(`^${clientCode}\\s*\\d{3}$`, 'i').test(c)) {
      return c;
    }
    // If it has clientCode and a number, normalize padding: e.g. "GNS 1" -> "GNS 001"
    if (c) {
      const match = c.match(new RegExp(`^${clientCode}\\s*(\\d+)`, 'i'));
      if (match) {
        return `${clientCode} ${String(parseInt(match[1], 10)).padStart(3, '0')}`;
      }
    }

    // Determine sequence among items for this client
    const clientProjects = (this._state.projects || []).filter(p => client && p.clientId === client.id).map(p => p.id);
    const clientProjIds = new Set(clientProjects.length > 0 ? clientProjects : [item.projectId]);
    const clientItems = (this._state.furniture || []).filter(f => clientProjIds.has(f.projectId));
    const idx = clientItems.findIndex(f => f.id === item.id);
    const seq = idx >= 0 ? idx + 1 : 1;
    return `${clientCode} ${String(seq).padStart(3, '0')}`;
  },

  /**
   * Safely migrates existing legacy codes to CLIENTCODE 001 format without deleting items
   */
  _migrateProductCodes() {
    if (!this._state || !this._state.furniture) return;
    const clientCounters = new Map();

    (this._state.furniture || []).forEach(item => {
      const proj = (this._state.projects || []).find(p => p.id === item.projectId);
      const client = (this._state.clients || []).find(c => c.id === (proj ? proj.clientId : null));
      let clientCode = 'PRD';
      if (client && (client.code || client.clientCode)) {
        clientCode = client.code || client.clientCode;
      } else if (client && client.name) {
        clientCode = this.generateClientCode(client.name);
      } else if (proj && proj.clientName) {
        clientCode = this.generateClientCode(proj.clientName);
      } else if (proj && proj.name) {
        clientCode = this.generateClientCode(proj.name);
      }

      const c = (item.productCode || item.itemCode || '').trim();
      const isLegacyMisuse = c.toUpperCase().startsWith('SRL ') && clientCode !== 'SRL';
      const is100Series = /^\w{2,4}\s+10\d$/i.test(c);
      const isMissing = !c;

      if (isMissing || isLegacyMisuse || is100Series) {
        const count = (clientCounters.get(clientCode) || 0) + 1;
        clientCounters.set(clientCode, count);
        const newCode = `${clientCode} ${String(count).padStart(3, '0')}`;
        item.productCode = newCode;
        item.itemCode = newCode;
      } else {
        const m = c.match(new RegExp(`^${clientCode}\\s*(\\d+)`, 'i'));
        if (m) {
          const num = parseInt(m[1], 10);
          item.productCode = `${clientCode} ${String(num).padStart(3, '0')}`;
          item.itemCode = item.productCode;
        }
      }
    });
  },

  addClient(clientData) {
    this._checkPermission('create');

    const name = (clientData.name || 'New Client').trim();
    const code = (clientData.code || clientData.clientCode || this.generateClientCode(name)).trim().toUpperCase();
    const srl = clientData.srl !== undefined ? clientData.srl : this.getNextClientSrl();

    const id = 'client_' + (name ? name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'client') + '_' + Date.now().toString(36);
    const newClient = {
      id: id,
      code: code,
      clientCode: code,
      srl: srl,
      name: name,
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
      isDelivered: false,
      quotationRef: projectData.quotationRef || null
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

  getFurniture(id) {
    return (this._state.furniture || this._state.srls || []).find(f => f.id === id) || null;
  },

  addFurniture(furnitureData, processesList) {
    this._checkPermission('create');

    const furnId = 'furn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
    const furnitureName = (furnitureData.name || furnitureData.furnitureName || 'New Furniture Item').trim();
    
    // Map temporary node IDs to stable production process IDs
    const idMap = new Map();
    (processesList || []).forEach((p, idx) => {
      const pKey = p.tempId || p.id || `node_${idx + 1}`;
      idMap.set(pKey, `proc_${furnId.replace('furn_', '')}_${idx + 1}`);
    });

    const newProcesses = (processesList || []).map((p, idx) => {
      const pKey = p.tempId || p.id || `node_${idx + 1}`;
      const mappedId = idMap.get(pKey) || `proc_${furnId.replace('furn_', '')}_${idx + 1}`;
      
      const rawDeps = p.dependencyTempIds || p.dependencyIds || [];
      const resolvedDeps = rawDeps.map(d => idMap.get(d) || d);

      return {
        id: mappedId,
        furnitureId: furnId,
        srlId: furnId, // backward compatibility alias for engine
        projectId: furnitureData.projectId,
        sequence: idx + 1,
        department: p.department,
        employeeId: p.employeeId,
        durationDays: parseFloat(p.durationDays) || 1,
        lane: p.lane || 1,
        dependencyIds: resolvedDeps,
        relationType: p.relationType || (idx === 0 ? 'START' : 'AFTER'),
        parallelGroupId: p.parallelGroupId || null,
        status: p.status || 'PENDING',
        progressPercent: p.progressPercent || 0,
        notes: p.notes || ''
      };
    });

    const productCode = (furnitureData.productCode || furnitureData.itemCode || this.getNextProductCode(furnitureData.projectId)).trim();
    const productPhoto = furnitureData.photo || furnitureData.image || (furnitureData.originalQuotationData && furnitureData.originalQuotationData.photoUrl) || null;

    const newFurniture = {
      id: furnId,
      projectId: furnitureData.projectId,
      productCode: productCode,
      itemCode: productCode,
      name: furnitureName,
      furnitureName: furnitureName, // backward compatibility alias
      photo: productPhoto,
      image: productPhoto,
      flowTypeId: furnitureData.flowTypeId || null,
      flowSource: furnitureData.flowSource || (furnitureData.flow ? furnitureData.flow.source : 'PRESET'),
      flow: furnitureData.flow || null,
      qty: parseInt(furnitureData.qty, 10) || 1,
      startDate: furnitureData.startDate || window.Zoosh.Config.CURRENT_DATE,
      status: 'NOT_STARTED',
      processIds: newProcesses.map(p => p.id),
      originalQuotationData: furnitureData.originalQuotationData || null,
      manufacturing: furnitureData.manufacturing || null
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

  updateFurnitureFlow(furnId, furnitureData, processesList) {
    this._checkPermission('edit');

    const item = (this._state.furniture || []).find(f => f.id === furnId);
    if (!item) throw new Error('Furniture item not found: ' + furnId);

    if (furnitureData.name) {
      item.name = furnitureData.name.trim();
      item.furnitureName = item.name;
    }
    if (furnitureData.productCode) {
      item.productCode = furnitureData.productCode.trim();
      item.itemCode = item.productCode;
    }
    if (furnitureData.qty !== undefined) {
      item.qty = parseInt(furnitureData.qty, 10) || 1;
    }
    if (furnitureData.startDate) {
      item.startDate = furnitureData.startDate;
    }
    if (furnitureData.flowTypeId !== undefined) {
      item.flowTypeId = furnitureData.flowTypeId;
    }
    if (furnitureData.flowSource !== undefined) {
      item.flowSource = furnitureData.flowSource;
    }
    if (furnitureData.flow !== undefined) {
      item.flow = furnitureData.flow;
    }

    // Preserve existing process progress/status if matching ID
    const existingProcMap = new Map((this._state.processes || []).filter(p => (p.furnitureId || p.srlId) === furnId).map(p => [p.id, p]));

    const idMap = new Map();
    (processesList || []).forEach((p, idx) => {
      const pKey = p.tempId || p.id || `node_${idx + 1}`;
      const existingId = p.id && existingProcMap.has(p.id) ? p.id : `proc_${furnId.replace('furn_', '')}_${idx + 1}`;
      idMap.set(pKey, existingId);
    });

    const updatedProcesses = (processesList || []).map((p, idx) => {
      const pKey = p.tempId || p.id || `node_${idx + 1}`;
      const mappedId = idMap.get(pKey) || `proc_${furnId.replace('furn_', '')}_${idx + 1}`;
      const existing = existingProcMap.get(mappedId);

      const rawDeps = p.dependencyTempIds || p.dependencyIds || [];
      const resolvedDeps = rawDeps.map(d => idMap.get(d) || d);

      return {
        id: mappedId,
        furnitureId: furnId,
        srlId: furnId,
        projectId: item.projectId,
        sequence: idx + 1,
        department: p.department,
        employeeId: p.employeeId,
        durationDays: parseFloat(p.durationDays) || 1,
        lane: p.lane || 1,
        dependencyIds: resolvedDeps,
        relationType: p.relationType || (idx === 0 ? 'START' : 'AFTER'),
        parallelGroupId: p.parallelGroupId || null,
        status: existing ? existing.status : (p.status || 'PENDING'),
        progressPercent: existing ? existing.progressPercent : (p.progressPercent || 0),
        notes: p.notes || ''
      };
    });

    this._state.processes = (this._state.processes || []).filter(p => (p.furnitureId || p.srlId) !== furnId);
    this._state.processes.push(...updatedProcesses);
    item.processIds = updatedProcesses.map(p => p.id);

    this.touchDataUpdated();
    this.recalculate();
    return item;
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
      reminders: this._state.reminders || [],
      quotationTracking: this._state.quotationTracking || {},
      estimates: this._state.estimates || {}
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
      if (!this._state.quotationTracking) {
        this._state.quotationTracking = {};
      }
      if (!this._state.estimates) {
        this._state.estimates = {};
      }
      this._syncFurnitureAliases();
      this.touchDataUpdated();
      this.recalculate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ==========================================
  // 8. ON-DEMAND QUOTATION TRACKING & IMPORT
  // ==========================================

  getQuotationTracking(quotationId) {
    if (!this._state) return null;
    this._state.quotationTracking = this._state.quotationTracking || {};

    const record = this._state.quotationTracking[quotationId] || {
      quotationId: quotationId,
      conversionStatus: 'NOT_REVIEWED',
      importStatus: 'NOT_IMPORTED',
      linkedProjectIds: [],
      importedItemIds: [],
      importedAt: null,
      notes: ''
    };

    // Dynamically cross-check with existing projects to guarantee accuracy
    const linkedProjects = (this._state.projects || []).filter(p => 
      p.quotationRef && String(p.quotationRef.quotationId) === String(quotationId)
    );

    if (linkedProjects.length > 0) {
      record.importStatus = 'IMPORTED';
      record.linkedProjectIds = Array.from(new Set([...(record.linkedProjectIds || []), ...linkedProjects.map(p => p.id)]));
    }

    return record;
  },

  getAllQuotationTrackings() {
    return (this._state && this._state.quotationTracking) || {};
  },

  setQuotationConversionStatus(quotationId, status, meta = {}) {
    this._checkPermission('edit');
    if (!this._state) return null;

    const validStatuses = ['NOT_REVIEWED', 'CONVERTED', 'NOT_CONVERTED'];
    const finalStatus = validStatuses.includes(status) ? status : 'NOT_REVIEWED';

    this._state.quotationTracking = this._state.quotationTracking || {};
    const existing = this.getQuotationTracking(quotationId);

    this._state.quotationTracking[quotationId] = {
      ...existing,
      conversionStatus: finalStatus,
      quotationNo: meta.no || existing.quotationNo || '',
      clientName: meta.clientName || existing.clientName || '',
      date: meta.date || existing.date || '',
      grandTotal: meta.grandTotal !== undefined ? meta.grandTotal : existing.grandTotal,
      updatedAt: new Date().toISOString()
    };

    this.persist();
    this.touchDataUpdated();
    this.notify();
    return this._state.quotationTracking[quotationId];
  },

  checkQuotationImported(quotationId) {
    if (!this._state) return { isImported: false, projects: [] };

    const linkedProjects = (this._state.projects || []).filter(p => 
      p.quotationRef && String(p.quotationRef.quotationId) === String(quotationId)
    );

    return {
      isImported: linkedProjects.length > 0,
      projects: linkedProjects
    };
  },

  /**
   * Imports selected products from a quotation into a new production project.
   * Preserves original quotation data as read-only reference while establishing
   * separate editable manufacturing specifications.
   */
  importProjectFromQuotation(payload) {
    this._checkPermission('create');

    const quotation = payload.quotation;
    if (!quotation || !quotation.id) {
      throw new Error('Valid quotation information is required for import.');
    }

    const quotationId = String(quotation.id);

    // Duplicate check
    const duplicateCheck = this.checkQuotationImported(quotationId);
    if (duplicateCheck.isImported && !payload.allowDuplicate) {
      return {
        success: false,
        duplicate: true,
        message: `Quotation ${quotation.no} is already imported into project "${duplicateCheck.projects[0].name}".`,
        existingProjects: duplicateCheck.projects
      };
    }

    // 1. Resolve or Create Client
    let targetClient = null;
    const clientData = payload.clientData || {};
    const cleanPhone = (clientData.phone || '').replace(/\D/g, '');
    const cleanName = (clientData.name || '').trim().toLowerCase();

    const existingClients = this._state.clients || [];

    // Match by phone first if available, then by exact name
    if (cleanPhone && cleanPhone.length >= 7) {
      targetClient = existingClients.find(c => {
        const cPhone = (c.phone || '').replace(/\D/g, '');
        return cPhone && cPhone.includes(cleanPhone);
      });
    }

    if (!targetClient && cleanName) {
      targetClient = existingClients.find(c => (c.name || '').trim().toLowerCase() === cleanName);
    }

    // If client does not exist, create client
    if (!targetClient) {
      const generatedCode = clientData.code || clientData.clientCode || this.generateClientCode(clientData.name || 'Client');
      targetClient = this.addClient({
        name: clientData.name || 'Imported Client',
        code: generatedCode,
        clientCode: generatedCode,
        location: clientData.location || '',
        phone: clientData.phone || '',
        notes: `Imported from Quotation ${quotation.no}`
      });
    }

    // 2. Create Project
    const projData = payload.projectData || {};
    const projName = projData.name || `${targetClient.name} - ${quotation.no}`;
    
    const newProject = this.addProject({
      clientId: targetClient.id,
      name: projName,
      location: projData.location || targetClient.location || 'Factory Floor',
      confirmedDate: projData.confirmedDate || window.Zoosh.Config.CURRENT_DATE,
      deliveryDeadline: projData.deliveryDeadline || this._calculateDefaultDeadline(14),
      notes: projData.notes || `Imported on ${new Date().toLocaleDateString()} from Quotation ${quotation.no}.`,
      quotationRef: {
        quotationId: quotationId,
        quotationNo: quotation.no,
        importedAt: new Date().toISOString(),
        grandTotal: quotation.totals ? quotation.totals.grandTotal : 0
      }
    });

    // 3. Create Furniture Items with Strict Data Separation
    const selectedProducts = payload.selectedProducts || [];
    const createdFurniture = [];

    selectedProducts.forEach((prod) => {
      const orig = prod.original || {};
      const mfg = prod.production || {};

      // Build process stages for this furniture item
      let processesList = [];
      if (mfg.flowTypeId && window.Zoosh.ProcessFlow) {
        try {
          const flowInstance = window.Zoosh.ProcessFlow.instantiatePreset(
            mfg.flowTypeId,
            newProject.confirmedDate || window.Zoosh.Config.CURRENT_DATE
          );
          if (flowInstance && Array.isArray(flowInstance.nodes)) {
            // Keep employee assignments unassigned by default for factory manager to assign
            processesList = flowInstance.nodes.map(n => ({
              ...n,
              employeeId: null
            }));
          }
        } catch (e) {
          console.warn('Could not instantiate preset flow:', e);
        }
      }

      const itemPhoto = orig.photoUrl || prod.photoUrl || prod.photo || (quotation.itemPhotos && quotation.itemPhotos[prod.itemId]) || null;

      const originalQuotationData = {
        quotationId: quotationId,
        quotationNo: quotation.no,
        itemId: prod.itemId,
        originalName: orig.name || '',
        originalSpec: orig.spec || '',
        originalMeasurements: orig.measurements || '',
        originalQty: orig.qty || 1,
        originalUtype: orig.utype || 'nos',
        originalRate: orig.unit || 0,
        originalTotal: orig.total || 0,
        photoUrl: itemPhoto
      };

      const manufacturingSpecs = {
        measurements: mfg.measurements || '',
        woodType: mfg.woodType || '',
        structure: mfg.structure || '',
        foam: mfg.foam || '',
        fabric: mfg.fabric || '',
        notes: mfg.notes || ''
      };

      const furnData = {
        projectId: newProject.id,
        name: (mfg.name || orig.name || 'Imported Product').trim(),
        qty: parseInt(mfg.qty, 10) || parseInt(orig.qty, 10) || 1,
        startDate: newProject.confirmedDate || window.Zoosh.Config.CURRENT_DATE,
        flowTypeId: mfg.flowTypeId || null,
        photo: itemPhoto,
        image: itemPhoto,
        originalQuotationData: originalQuotationData,
        manufacturing: manufacturingSpecs
      };

      const newFurniture = this.addFurniture(furnData, processesList);
      createdFurniture.push(newFurniture);
    });

    // 4. Update Quotation Tracking
    this._state.quotationTracking = this._state.quotationTracking || {};
    const existingTrack = this.getQuotationTracking(quotationId);

    const allQuotationItemsCount = (quotation.items || []).length;
    const isFullImport = selectedProducts.length >= allQuotationItemsCount;

    this._state.quotationTracking[quotationId] = {
      ...existingTrack,
      quotationId: quotationId,
      quotationNo: quotation.no,
      clientName: targetClient.name,
      conversionStatus: 'CONVERTED',
      importStatus: isFullImport ? 'IMPORTED' : 'PARTIALLY_IMPORTED',
      importedAt: new Date().toISOString(),
      linkedProjectIds: Array.from(new Set([...(existingTrack.linkedProjectIds || []), newProject.id])),
      importedItemIds: Array.from(new Set([...(existingTrack.importedItemIds || []), ...selectedProducts.map(p => p.itemId)])),
      updatedAt: new Date().toISOString()
    };

    this.touchDataUpdated();
    this.recalculate();

    return {
      success: true,
      project: newProject,
      client: targetClient,
      furnitureCount: createdFurniture.length
    };
  },

  _calculateDefaultDeadline(daysFromNow = 14) {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // ==========================================
  // 9. EXCEL-STYLE ESTIMATE MODULE STATE
  // ==========================================

  STANDARD_COST_CATEGORIES: [
    { id: 'mahogany', name: 'Mahogany', defaultRate: 2500, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'wood_ash', name: 'Wood Ash', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'carpenter', name: 'Carpenter', defaultRate: 3000, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'polish_material', name: 'Polish Material', defaultRate: 1500, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'polish_labour', name: 'Polish Labour', defaultRate: 2400, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'foam', name: 'Foam', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'fabric', name: 'Fabric', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'upholstery_labour', name: 'Upholstery Labour', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'packing', name: 'Packing', defaultRate: 250, defaultQty: 1, defaultAmount: 250, isDirect: true },
    { id: 'factory_expense', name: 'Factory Expense', defaultRate: 500, defaultQty: 1, defaultAmount: 500, isDirect: true },
    { id: 'metal_work', name: 'Metal Work', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'rattan', name: 'Rattan', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'rope', name: 'Rope', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'consumables', name: 'Consumables', defaultRate: 30, defaultQty: 1, defaultAmount: 30, isDirect: true },
    { id: 'ar_marble', name: 'Ar. Marble', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false },
    { id: 'plywood', name: 'Plywood', defaultRate: 0, defaultQty: 0, defaultAmount: 0, isDirect: false }
  ],

  getDefaultEstimate(furnitureId) {
    const furn = this.getFurniture(furnitureId) || {};
    const proj = (this._state.projects || []).find(p => p.id === furn.projectId) || {};
    const client = (this._state.clients || []).find(c => c.id === proj.clientId) || {};

    const costRows = this.STANDARD_COST_CATEGORIES.map(cat => ({
      id: cat.id,
      name: cat.name,
      rate: cat.defaultRate,
      qty: cat.defaultQty,
      amount: cat.defaultAmount,
      isDirect: cat.isDirect
    }));

    const qty = parseInt(furn.qty, 10) || 1;

    return {
      furnitureId: furnitureId,
      projectId: furn.projectId || null,
      clientName: client.name || proj.clientName || 'Client',
      projectName: proj.name || 'Project',
      productNo: furn.productCode || furn.itemCode || '1',
      productName: furn.name || furn.furnitureName || 'Product',
      productQty: qty,
      estimateDate: window.Zoosh.Config.CURRENT_DATE,
      photo: furn.photo || furn.image || (furn.originalQuotationData && furn.originalQuotationData.photoUrl) || null,
      selectedProfitTier: '25',
      customProfitPercent: 25,
      costRows: costRows,
      woodRows: [
        { part: 'Part 1', length: 2.25, width: 2.5, thickness: 2.5, qty: 2, cft: 0.1953 }
      ],
      totals: {
        unitWoodCft: 0.1953,
        totalWoodCft: Math.round(0.1953 * qty * 1000) / 1000,
        unitCost: 780,
        totalCost: 780 * qty,
        profit25: Math.round(780 * qty * 0.25),
        profit30: Math.round(780 * qty * 0.30),
        customProfitPercent: 25,
        customProfitAmount: Math.round(780 * qty * 0.25),
        unitSellingPrice: Math.round((780 * qty * 1.25) / qty),
        totalSellingPrice: Math.round(780 * qty * 1.25)
      },
      isSaved: false
    };
  },

  getEstimate(furnitureId) {
    this._state.estimates = this._state.estimates || {};
    if (this._state.estimates[furnitureId]) {
      return JSON.parse(JSON.stringify(this._state.estimates[furnitureId]));
    }
    return this.getDefaultEstimate(furnitureId);
  },

  saveEstimate(furnitureId, estimateData) {
    this._checkPermission('edit');
    this._state.estimates = this._state.estimates || {};

    const cleanData = JSON.parse(JSON.stringify(estimateData));
    cleanData.isSaved = true;
    cleanData.updatedAt = new Date().toISOString();

    this._state.estimates[furnitureId] = cleanData;

    // Sync furniture photo/image if updated in estimate
    const furn = this.getFurniture(furnitureId);
    if (furn && cleanData.photo) {
      furn.photo = cleanData.photo;
      furn.image = cleanData.photo;
    }

    this.touchDataUpdated();
    this.persist();
    this.notify();

    return cleanData;
  },

  deleteEstimate(furnitureId) {
    this._checkPermission('edit');
    this._state.estimates = this._state.estimates || {};
    delete this._state.estimates[furnitureId];

    this.touchDataUpdated();
    this.persist();
    this.notify();
  },

  getProjectEstimatesSummary(projectId) {
    const furnitureList = (this._state.furniture || this._state.srls || []).filter(f => f.projectId === projectId);
    this._state.estimates = this._state.estimates || {};

    let totalMfgCost = 0;
    let totalSellingValue = 0;
    let totalWoodCft = 0;
    let estimatedCount = 0;

    const items = furnitureList.map((furn, idx) => {
      const isSaved = Boolean(this._state.estimates[furn.id] && this._state.estimates[furn.id].isSaved !== false);
      const est = isSaved ? this._state.estimates[furn.id] : this.getDefaultEstimate(furn.id);

      if (isSaved) {
        estimatedCount++;
      }

      const itemQty = parseInt(furn.qty, 10) || parseInt(est.productQty, 10) || 1;
      const unitCost = (est.totals && est.totals.unitCost) || 0;
      const totalCost = (est.totals && est.totals.totalCost) !== undefined ? est.totals.totalCost : (unitCost * itemQty);
      const totalSelling = (est.totals && est.totals.totalSellingPrice) || Math.round(totalCost * 1.25);
      const woodCft = (est.totals && est.totals.totalWoodCft) || 0;

      totalMfgCost += totalCost;
      totalSellingValue += totalSelling;
      totalWoodCft += woodCft;

      return {
        furniture: furn,
        estimate: est,
        isSaved: isSaved,
        itemIndex: idx + 1,
        qty: itemQty,
        unitCost: unitCost,
        totalCost: totalCost,
        totalSelling: totalSelling,
        profit: totalSelling - totalCost,
        profitMargin: totalCost > 0 ? Math.round(((totalSelling - totalCost) / totalCost) * 100) : 0,
        woodCft: woodCft
      };
    });

    const totalProfit = totalSellingValue - totalMfgCost;
    const overallProfitMargin = totalMfgCost > 0 ? Math.round((totalProfit / totalMfgCost) * 1000) / 10 : 0;

    return {
      projectId: projectId,
      totalProducts: furnitureList.length,
      estimatedCount: estimatedCount,
      totalMfgCost: Math.round(totalMfgCost),
      totalSellingValue: Math.round(totalSellingValue),
      totalProfit: Math.round(totalProfit),
      overallProfitMargin: overallProfitMargin,
      totalWoodCft: Math.round(totalWoodCft * 1000) / 1000,
      items: items
    };
  },

  _seedAnsarChangaramkulamDemo() {
    if (!this._state || !this._state.projects) return;
    const exists = this._state.projects.some(p => p.name && p.name.includes('Ansar'));
    if (exists) return;

    // 1. Add Client
    const client = {
      id: 'client_ansar',
      code: 'ANS',
      clientCode: 'ANS',
      srl: 105,
      name: 'Ansar Changaramkulam',
      location: 'Changaramkulam',
      phone: '+91 98474 56789',
      notes: 'Residential villa furniture project: Living Room, Dining & Sitout'
    };
    this._state.clients = this._state.clients || [];
    this._state.clients.push(client);

    // 2. Add Project
    const proj = {
      id: 'proj_ansar',
      clientId: 'client_ansar',
      clientSrl: 105,
      clientName: 'Ansar Changaramkulam',
      name: 'Ansar Changaramkulam',
      location: 'Changaramkulam',
      confirmedDate: '2026-11-01',
      deliveryDeadline: '2026-11-30',
      notes: 'Custom villa project: Sofa, Dining Table, Dining Chair, Sitout Chair.',
      furnitureIds: ['furn_ansar_sofa', 'furn_ansar_dining_table', 'furn_ansar_dining_chair', 'furn_ansar_sitout_chair'],
      srlIds: ['furn_ansar_sofa', 'furn_ansar_dining_table', 'furn_ansar_dining_chair', 'furn_ansar_sitout_chair'],
      isDelivered: false
    };
    this._state.projects.push(proj);

    // 3. Add 4 Products
    const sampleChairImage = 'public/sample_chair.jpeg';

    const sofaItem = {
      id: 'furn_ansar_sofa',
      projectId: 'proj_ansar',
      productCode: 'ANS 001',
      itemCode: 'ANS 001',
      name: 'Sofa',
      furnitureName: 'Sofa',
      flowTypeId: 'flow_type_2',
      qty: 1,
      startDate: '2026-11-01',
      status: 'IN_PROGRESS',
      photo: null,
      image: null,
      processIds: ['proc_ansar_sofa_1', 'proc_ansar_sofa_2', 'proc_ansar_sofa_3']
    };

    const diningTableItem = {
      id: 'furn_ansar_dining_table',
      projectId: 'proj_ansar',
      productCode: 'ANS 002',
      itemCode: 'ANS 002',
      name: 'Dining Table',
      furnitureName: 'Dining Table',
      flowTypeId: 'flow_type_1',
      qty: 1,
      startDate: '2026-11-01',
      status: 'IN_PROGRESS',
      photo: null,
      image: null,
      processIds: ['proc_ansar_dt_1', 'proc_ansar_dt_2']
    };

    const diningChairItem = {
      id: 'furn_ansar_dining_chair',
      projectId: 'proj_ansar',
      productCode: 'ANS 003',
      itemCode: 'ANS 003',
      name: 'Dining Chair',
      furnitureName: 'Dining Chair',
      flowTypeId: 'flow_type_2',
      qty: 6,
      startDate: '2026-11-01',
      status: 'IN_PROGRESS',
      photo: null,
      image: null,
      processIds: ['proc_ansar_dc_1', 'proc_ansar_dc_2', 'proc_ansar_dc_3']
    };

    const sitoutChairItem = {
      id: 'furn_ansar_sitout_chair',
      projectId: 'proj_ansar',
      productCode: 'ANS 004',
      itemCode: 'ANS 004',
      name: 'Sitout Chair',
      furnitureName: 'Sitout Chair',
      flowTypeId: 'flow_type_1',
      qty: 2,
      startDate: '2026-11-01',
      status: 'IN_PROGRESS',
      photo: sampleChairImage,
      image: sampleChairImage,
      processIds: ['proc_ansar_sc_1', 'proc_ansar_sc_2']
    };

    this._state.furniture = this._state.furniture || [];
    this._state.furniture.push(sofaItem, diningTableItem, diningChairItem, sitoutChairItem);
    this._state.srls = this._state.furniture;

    // 4. Processes for scheduling
    const procs = [
      { id: 'proc_ansar_sofa_1', furnitureId: 'furn_ansar_sofa', projectId: 'proj_ansar', department: 'Carpentry', sequence: 1, durationDays: 3, lane: 1, employeeId: 'emp_rajan', status: 'IN_PROGRESS', progressPercent: 40, dependencyIds: [], relationType: 'START' },
      { id: 'proc_ansar_sofa_2', furnitureId: 'furn_ansar_sofa', projectId: 'proj_ansar', department: 'Polish', sequence: 2, durationDays: 2, lane: 1, employeeId: 'emp_rajesh', status: 'PENDING', progressPercent: 0, dependencyIds: ['proc_ansar_sofa_1'], relationType: 'AFTER' },
      { id: 'proc_ansar_sofa_3', furnitureId: 'furn_ansar_sofa', projectId: 'proj_ansar', department: 'Upholstery', sequence: 3, durationDays: 2, lane: 1, employeeId: 'emp_saddique', status: 'PENDING', progressPercent: 0, dependencyIds: ['proc_ansar_sofa_2'], relationType: 'AFTER' },
      { id: 'proc_ansar_dt_1', furnitureId: 'furn_ansar_dining_table', projectId: 'proj_ansar', department: 'Carpentry', sequence: 1, durationDays: 4, lane: 1, employeeId: 'emp_satheesh', status: 'IN_PROGRESS', progressPercent: 50, dependencyIds: [], relationType: 'START' },
      { id: 'proc_ansar_dt_2', furnitureId: 'furn_ansar_dining_table', projectId: 'proj_ansar', department: 'Polish', sequence: 2, durationDays: 3, lane: 1, employeeId: 'emp_shaji', status: 'PENDING', progressPercent: 0, dependencyIds: ['proc_ansar_dt_1'], relationType: 'AFTER' },
      { id: 'proc_ansar_dc_1', furnitureId: 'furn_ansar_dining_chair', projectId: 'proj_ansar', department: 'Carpentry', sequence: 1, durationDays: 3, lane: 1, employeeId: 'emp_sasi', status: 'IN_PROGRESS', progressPercent: 30, dependencyIds: [], relationType: 'START' },
      { id: 'proc_ansar_dc_2', furnitureId: 'furn_ansar_dining_chair', projectId: 'proj_ansar', department: 'Polish', sequence: 2, durationDays: 2, lane: 1, employeeId: 'emp_pradeep', status: 'PENDING', progressPercent: 0, dependencyIds: ['proc_ansar_dc_1'], relationType: 'AFTER' },
      { id: 'proc_ansar_dc_3', furnitureId: 'furn_ansar_dining_chair', projectId: 'proj_ansar', department: 'Upholstery', sequence: 3, durationDays: 2, lane: 1, employeeId: 'emp_faizal', status: 'PENDING', progressPercent: 0, dependencyIds: ['proc_ansar_dc_2'], relationType: 'AFTER' },
      { id: 'proc_ansar_sc_1', furnitureId: 'furn_ansar_sitout_chair', projectId: 'proj_ansar', department: 'Carpentry', sequence: 1, durationDays: 2, lane: 1, employeeId: 'emp_santhosh', status: 'COMPLETED', progressPercent: 100, dependencyIds: [], relationType: 'START' },
      { id: 'proc_ansar_sc_2', furnitureId: 'furn_ansar_sitout_chair', projectId: 'proj_ansar', department: 'Polish', sequence: 2, durationDays: 2, lane: 1, employeeId: 'emp_murali', status: 'IN_PROGRESS', progressPercent: 60, dependencyIds: ['proc_ansar_sc_1'], relationType: 'AFTER' }
    ];
    this._state.processes = this._state.processes || [];
    this._state.processes.push(...procs);

    // 5. Preload Sitout Chair Excel Estimate from uploaded spreadsheet samle estimate.xlsx
    this._state.estimates = this._state.estimates || {};
    this._state.estimates['furn_ansar_sitout_chair'] = {
      furnitureId: 'furn_ansar_sitout_chair',
      projectId: 'proj_ansar',
      clientName: 'Ansar Changaramkulam',
      projectName: 'Ansar Changaramkulam',
      productNo: 1,
      productName: 'Sitout Chair',
      productQty: 2,
      estimateDate: '2026-11-01',
      photo: sampleChairImage,
      selectedProfitTier: '25',
      customProfitPercent: 25,
      costRows: [
        { id: 'mahogany', name: 'Mahogany', rate: 2500, qty: 1.408, amount: 3520, isDirect: false },
        { id: 'wood_ash', name: 'Wood Ash', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'carpenter', name: 'Carpenter', rate: 3000, qty: 1, amount: 3000, isDirect: false },
        { id: 'polish_material', name: 'Polish Material', rate: 1500, qty: 1, amount: 1500, isDirect: false },
        { id: 'polish_labour', name: 'Polish Labour', rate: 2400, qty: 1, amount: 2400, isDirect: false },
        { id: 'foam', name: 'Foam', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'fabric', name: 'Fabric', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'upholstery_labour', name: 'Upholstery Labour', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'packing', name: 'Packing', rate: 250, qty: 1, amount: 250, isDirect: true },
        { id: 'factory_expense', name: 'Factory Expense', rate: 500, qty: 1, amount: 500, isDirect: true },
        { id: 'metal_work', name: 'Metal Work', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'rattan', name: 'Rattan', rate: 470, qty: 2, amount: 940, isDirect: false },
        { id: 'rope', name: 'Rope', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'consumables', name: 'Consumables', rate: 30, qty: 1, amount: 30, isDirect: true },
        { id: 'ar_marble', name: 'Ar. Marble', rate: 0, qty: 0, amount: 0, isDirect: false },
        { id: 'plywood', name: 'Plywood', rate: 0, qty: 0, amount: 0, isDirect: false }
      ],
      woodRows: [
        { part: 'Piece 1 (Back Rest Plank)', length: 4, width: 10, thickness: 1.5, qty: 1, cft: 0.4167 },
        { part: 'Piece 2 (Seat Rail)', length: 1.5, width: 7, thickness: 1.5, qty: 1, cft: 0.1094 },
        { part: 'Piece 3 (Leg Posts)', length: 2, width: 2.5, thickness: 1.5, qty: 4, cft: 0.2083 },
        { part: 'Piece 4 (Main Uprights)', length: 2, width: 2.5, thickness: 2, qty: 4, cft: 0.2778 },
        { part: 'Piece 5 (Cross Stretchers)', length: 2, width: 2.5, thickness: 1.5, qty: 2, cft: 0.1042 },
        { part: 'Piece 6 (Seat Base Plank)', length: 2, width: 11, thickness: 1.5, qty: 1, cft: 0.2292 },
        { part: 'Piece 7 (Arm Supports)', length: 2, width: 1.5, thickness: 1.5, qty: 2, cft: 0.0625 }
      ],
      totals: {
        unitWoodCft: 1.408,
        totalWoodCft: 2.816,
        unitCost: 12140,
        totalCost: 24280,
        profit25: 6070,
        profit30: 7284,
        customProfitPercent: 25,
        customProfitAmount: 6070,
        unitSellingPrice: 15175,
        totalSellingPrice: 30350
      },
      isSaved: true,
      updatedAt: '2026-11-01T10:00:00.000Z'
    };
  }
};
