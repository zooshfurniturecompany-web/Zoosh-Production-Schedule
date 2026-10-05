/**
 * Schedule Process Flow Order Panel / Modal Component
 * 
 * Provides right-side slide-over interface for:
 * 1. Quick Flow Order (12 standard two-lane presets)
 * 2. Custom Flow Order (+ Add Next Process, + Add Parallel Process, department builders)
 * 3. Proportional two-lane graphical flow visualization
 * 4. Flow summary and duration table with 0.25 working day step validation
 * 5. Smart employee allocation with leave conflict alerts
 * 6. Isolated temporary editing state (Cancel leaves saved data untouched)
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.ProcessFlowModal = {
  isOpen: false,
  mode: 'ADD', // 'ADD' | 'EDIT'
  projectId: null,
  furnitureId: null,
  clientSrl: null,
  clientName: '',
  projectName: '',
  
  // Temporary working copy (never mutates saved data until Apply)
  workingData: {
    itemName: '',
    qty: 1,
    startDate: '',
    source: 'PRESET', // 'PRESET' | 'CUSTOM'
    presetId: 'preset_8',
    nodes: [],
    error: null
  },

  /**
   * Open panel to Add a New Item with fresh, isolated flow state
   */
  openAdd(projectId) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canCreate()) {
      alert('Permission Denied: Your role is Visitor (read-only) and cannot add furniture.');
      return;
    }

    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;
    const projects = state.projects || [];

    if (projects.length === 0) {
      alert('Please create at least one Project first before adding furniture.\nClick "+ New Project" to begin.');
      return;
    }

    const targetProjId = projectId || (projects[0] ? projects[0].id : null);
    const proj = projects.find(p => p.id === targetProjId) || projects[0];
    const client = (state.clients || []).find(c => c.id === proj.clientId);
    const clientCode = client ? (client.code || client.clientCode || client.srl) : (proj.clientCode || proj.clientSrl || '—');
    const nextProductCode = window.Zoosh.State.getNextProductCode ? window.Zoosh.State.getNextProductCode(proj.id) : '';

    this.mode = 'ADD';
    this.projectId = proj.id;
    this.furnitureId = null;
    this.projectName = proj.name;
    this.clientCode = clientCode;
    this.clientSrl = clientCode;
    this.clientName = client ? client.name : (proj.clientName || 'Client');

    // Fresh, completely independent working context
    const defaultStartDate = proj.confirmedDate || config.CURRENT_DATE;
    const initialPreset = window.Zoosh.ProcessFlow.instantiatePreset('preset_8', defaultStartDate);

    // Clear any previous container DOM so syncInputsFromDOM doesn't read old inputs
    const container = document.getElementById('flow-drawer-container');
    if (container) {
      container.innerHTML = '';
    }

    this.workingData = {
      productCode: nextProductCode,
      itemName: '',
      qty: 1,
      startDate: defaultStartDate,
      source: 'PRESET',
      presetId: 'preset_8',
      nodes: initialPreset.nodes,
      error: null
    };

    this.isOpen = true;
    this.render();

    setTimeout(() => {
      const nameInput = document.getElementById('flow-input-item-name');
      if (nameInput && typeof nameInput.focus === 'function') nameInput.focus();
    }, 60);
  },

  /**
   * Open panel to Edit an Existing Furniture Item's Flow
   */
  openEdit(furnitureId) {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canEdit()) {
      alert('Permission Denied: Your role is Visitor (read-only) and cannot edit furniture.');
      return;
    }

    const state = window.Zoosh.State.getState();
    const item = (state.furniture || state.srls || []).find(f => f.id === furnitureId);
    if (!item) {
      alert('Furniture item not found.');
      return;
    }

    const proj = (state.projects || []).find(p => p.id === item.projectId);
    const client = proj ? (state.clients || []).find(c => c.id === proj.clientId) : null;
    const clientCode = client ? (client.code || client.clientCode || client.srl) : (proj ? (proj.clientCode || proj.clientSrl) : '—');
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    this.mode = 'EDIT';
    this.projectId = item.projectId;
    this.furnitureId = item.id;
    this.projectName = proj ? proj.name : '—';
    this.clientCode = clientCode;
    this.clientSrl = clientCode;
    this.clientName = client ? client.name : (proj ? proj.clientName : 'Client');

    // Load saved processes into temporary nodes
    const savedProcs = (state.processes || []).filter(p => (p.furnitureId || p.srlId) === item.id);
    savedProcs.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    const nodes = savedProcs.map((p, idx) => {
      const emp = employeesMap.get(p.employeeId);
      return {
        tempId: p.id || `node_${idx + 1}`,
        id: p.id,
        sequence: idx + 1,
        department: p.department,
        lane: p.lane || 1,
        durationDays: parseFloat(p.durationDays) || 1,
        employeeId: p.employeeId || '',
        employeeName: emp ? emp.name : '',
        relationType: p.relationType || (idx === 0 ? 'START' : 'AFTER'),
        dependencyTempIds: [...(p.dependencyIds || [])],
        parallelWithId: p.parallelWithId || null,
        status: p.status || 'PENDING',
        progressPercent: p.progressPercent || 0,
        notes: p.notes || ''
      };
    });

    // Clear any previous container DOM so syncInputsFromDOM doesn't read old inputs
    const editContainer = document.getElementById('flow-drawer-container');
    if (editContainer) {
      editContainer.innerHTML = '';
    }

    this.workingData = {
      productCode: item.productCode || item.itemCode || '',
      itemName: item.name || item.furnitureName || '',
      qty: item.qty || 1,
      startDate: item.startDate || (proj ? proj.confirmedDate : window.Zoosh.Config.CURRENT_DATE),
      source: item.flowSource || (item.flow && item.flow.source) || 'CUSTOM',
      presetId: item.flowTypeId || null,
      nodes: nodes.length > 0 ? nodes : window.Zoosh.ProcessFlow.instantiatePreset('preset_8').nodes,
      error: null
    };

    this.isOpen = true;
    this.render();
  },

  /**
   * Close panel and discard temporary working state without saving
   */
  close() {
    this.isOpen = false;
    this.workingData = {
      productCode: '',
      itemName: '',
      qty: 1,
      startDate: '',
      source: 'PRESET',
      presetId: null,
      nodes: [],
      error: null
    };

    const container = document.getElementById('flow-drawer-container');
    if (container) {
      container.classList.remove('open');
      container.innerHTML = '';
    }
  },

  /**
   * Escape HTML special characters for attributes and text
   */
  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  /**
   * Synchronize DOM input values into workingData before re-rendering or saving
   */
  syncInputsFromDOM() {
    const codeEl = document.getElementById('flow-input-product-code');
    const nameEl = document.getElementById('flow-input-item-name');
    const qtyEl = document.getElementById('flow-input-qty');
    const dateEl = document.getElementById('flow-input-start-date');

    if (codeEl && typeof codeEl.value === 'string' && codeEl.value.trim() !== '') {
      this.workingData.productCode = codeEl.value.trim().toUpperCase();
    }
    if (nameEl && typeof nameEl.value === 'string' && nameEl.value.trim() !== '') {
      this.workingData.itemName = nameEl.value;
    }
    if (qtyEl && qtyEl.value) {
      const q = parseInt(qtyEl.value, 10);
      if (q > 0) this.workingData.qty = q;
    }
    if (dateEl && dateEl.value) {
      this.workingData.startDate = dateEl.value;
    }

    (this.workingData.nodes || []).forEach(n => {
      const tempId = n.tempId || n.id;
      const durEl = document.getElementById(`flow-duration-${tempId}`);
      if (durEl && durEl.value) {
        const val = parseFloat(durEl.value);
        if (!isNaN(val)) n.durationDays = val;
      }
    });
  },

  /**
   * Handle real-time input for Furniture Item Name
   */
  handleItemNameInput(val) {
    this.workingData.itemName = val;
    if (this.workingData.error && this.workingData.error.toLowerCase().includes('furniture item name')) {
      this.workingData.error = null;
      const banner = document.querySelector('.flow-error-banner');
      if (banner) banner.remove();
    }
  },

  /**
   * Select a Preset from Quick Flow Order
   */
  selectPreset(presetId) {
    this.syncInputsFromDOM();
    const instantiated = window.Zoosh.ProcessFlow.instantiatePreset(presetId, this.workingData.startDate);
    this.workingData.presetId = presetId;
    this.workingData.source = 'PRESET';
    this.workingData.nodes = instantiated.nodes;
    this.workingData.error = null;
    this.render();
  },

  /**
   * Add Next Process to Lane 1 (Sequential)
   */
  addNextProcess(dept = 'Carpentry') {
    this.syncInputsFromDOM();
    this.workingData.source = 'CUSTOM';
    this.workingData.presetId = null;

    const nodes = this.workingData.nodes;
    const lane1Nodes = nodes.filter(n => (n.lane || 1) === 1);
    const lastLane1 = lane1Nodes[lane1Nodes.length - 1];

    let suggestedEmp = null;
    if (window.Zoosh.Allocator) {
      const suggestion = window.Zoosh.Allocator.suggestEmployee(dept, this.workingData.startDate, 2);
      suggestedEmp = suggestion ? suggestion.suggestedEmployee : null;
    }

    const newNodeId = `node_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
    const newNode = {
      tempId: newNodeId,
      sequence: nodes.length + 1,
      department: dept,
      lane: 1,
      durationDays: dept === 'Polish' ? 2 : (dept === 'Upholstery' ? 1.5 : 2),
      employeeId: suggestedEmp ? suggestedEmp.id : '',
      employeeName: suggestedEmp ? suggestedEmp.name : '',
      relationType: lastLane1 ? 'AFTER' : 'START',
      dependencyTempIds: lastLane1 ? [lastLane1.tempId || lastLane1.id] : [],
      parallelWithId: null,
      notes: ''
    };

    this.workingData.nodes.push(newNode);
    this.workingData.error = null;
    this.render();
  },

  /**
   * Add Parallel Process to Lane 2
   */
  addParallelProcess(dept = 'Upholstery') {
    this.syncInputsFromDOM();
    this.workingData.source = 'CUSTOM';
    this.workingData.presetId = null;

    const nodes = this.workingData.nodes;
    const lane1Nodes = nodes.filter(n => (n.lane || 1) === 1);
    const targetLane1 = lane1Nodes[lane1Nodes.length - 1] || nodes[nodes.length - 1];

    let suggestedEmp = null;
    if (window.Zoosh.Allocator) {
      const suggestion = window.Zoosh.Allocator.suggestEmployee(dept, this.workingData.startDate, 1.25);
      suggestedEmp = suggestion ? suggestion.suggestedEmployee : null;
    }

    const newNodeId = `node_par_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 5)}`;
    const newNode = {
      tempId: newNodeId,
      sequence: nodes.length + 1,
      department: dept,
      lane: 2,
      durationDays: 1.25,
      employeeId: suggestedEmp ? suggestedEmp.id : '',
      employeeName: suggestedEmp ? suggestedEmp.name : '',
      relationType: 'PARALLEL',
      dependencyTempIds: targetLane1 ? [...(targetLane1.dependencyTempIds || [])] : [],
      parallelWithId: targetLane1 ? (targetLane1.tempId || targetLane1.id) : null,
      notes: ''
    };

    this.workingData.nodes.push(newNode);
    this.workingData.error = null;
    this.render();
  },

  /**
   * Remove a node from the flow
   */
  removeNode(tempId) {
    this.syncInputsFromDOM();
    if (this.workingData.nodes.length <= 1) {
      this.workingData.error = 'Flow must have at least one production process.';
      this.render();
      return;
    }

    this.workingData.source = 'CUSTOM';
    this.workingData.presetId = null;

    // Remove node
    this.workingData.nodes = this.workingData.nodes.filter(n => (n.tempId || n.id) !== tempId);

    // Clean up dependencies referencing removed node
    this.workingData.nodes.forEach(n => {
      n.dependencyTempIds = (n.dependencyTempIds || []).filter(id => id !== tempId);
      if (n.parallelWithId === tempId) n.parallelWithId = null;
    });

    this.workingData.error = null;
    this.render();
  },

  /**
   * Update duration of a node with real-time recalculation
   */
  updateDuration(tempId, val) {
    const node = this.workingData.nodes.find(n => (n.tempId || n.id) === tempId);
    if (!node) return;

    const num = parseFloat(val);
    node.durationDays = isNaN(num) ? 1 : num;
    this.renderVisualsAndMetricsOnly();
  },

  /**
   * Update employee of a node with leave conflict detection
   */
  updateEmployee(tempId, empId) {
    this.syncInputsFromDOM();
    const node = this.workingData.nodes.find(n => (n.tempId || n.id) === tempId);
    if (!node) return;

    const state = window.Zoosh.State.getState();
    const emp = (state.employees || []).find(e => e.id === empId);
    node.employeeId = empId;
    node.employeeName = emp ? emp.name : '';
    this.render();
  },

  /**
   * Update department of a node
   */
  updateDepartment(tempId, dept) {
    this.syncInputsFromDOM();
    const node = this.workingData.nodes.find(n => (n.tempId || n.id) === tempId);
    if (!node) return;

    node.department = dept;
    // Suggest optimal employee for new department
    if (window.Zoosh.Allocator) {
      const suggestion = window.Zoosh.Allocator.suggestEmployee(dept, this.workingData.startDate, node.durationDays);
      if (suggestion && suggestion.suggestedEmployee) {
        node.employeeId = suggestion.suggestedEmployee.id;
        node.employeeName = suggestion.suggestedEmployee.name;
      }
    }
    this.workingData.source = 'CUSTOM';
    this.workingData.presetId = null;
    this.render();
  },

  /**
   * Toggle node lane between 1 and 2
   */
  updateLane(tempId, laneNum) {
    this.syncInputsFromDOM();
    const node = this.workingData.nodes.find(n => (n.tempId || n.id) === tempId);
    if (!node) return;

    node.lane = parseInt(laneNum, 10) || 1;
    if (node.lane === 2) {
      node.relationType = 'PARALLEL';
    } else if (node.relationType === 'PARALLEL') {
      node.relationType = 'AFTER';
    }
    this.workingData.source = 'CUSTOM';
    this.workingData.presetId = null;
    this.render();
  },

  /**
   * Apply Flow: Validates and saves item & structured processes to state
   */
  applyFlow() {
    this.syncInputsFromDOM();

    if (!this.workingData.itemName || !this.workingData.itemName.trim()) {
      this.workingData.error = 'Please enter a furniture item name.';
      this.render();
      return;
    }
    this.workingData.itemName = this.workingData.itemName.trim();

    // Validate entire flow
    const validation = window.Zoosh.ProcessFlow.validate(this.workingData.nodes);
    if (!validation.valid) {
      this.workingData.error = validation.error;
      this.render();
      return;
    }

    try {
      const { totalWorkload, criticalDuration } = window.Zoosh.ProcessFlow.calculateDurations(this.workingData.nodes);

      const structuredFlow = {
        source: this.workingData.source,
        presetId: this.workingData.presetId,
        totalWorkloadDays: totalWorkload,
        criticalDurationDays: criticalDuration,
        nodes: this.workingData.nodes.map((n, idx) => ({
          tempId: n.tempId || `node_${idx + 1}`,
          sequence: idx + 1,
          department: n.department,
          lane: n.lane || 1,
          durationDays: n.durationDays,
          employeeId: n.employeeId,
          relationType: n.relationType,
          dependencyTempIds: [...(n.dependencyTempIds || [])],
          parallelWithId: n.parallelWithId || null
        }))
      };

      if (this.mode === 'ADD') {
        window.Zoosh.State.addFurniture(
          {
            projectId: this.projectId,
            productCode: this.workingData.productCode,
            name: this.workingData.itemName,
            qty: this.workingData.qty,
            startDate: this.workingData.startDate,
            flowTypeId: this.workingData.presetId,
            flowSource: this.workingData.source,
            flow: structuredFlow
          },
          this.workingData.nodes
        );
      } else {
        window.Zoosh.State.updateFurnitureFlow(
          this.furnitureId,
          {
            productCode: this.workingData.productCode,
            name: this.workingData.itemName,
            qty: this.workingData.qty,
            startDate: this.workingData.startDate,
            flowTypeId: this.workingData.presetId,
            flowSource: this.workingData.source,
            flow: structuredFlow
          },
          this.workingData.nodes
        );
      }

      this.close();

      // Refresh current view
      if (window.Zoosh.Views && window.Zoosh.Views.Projects) {
        window.Zoosh.Views.Projects.renderProjectDetail(document.getElementById('view-container'), this.projectId);
      }
    } catch (err) {
      this.workingData.error = err.message;
      this.render();
    }
  },

  /**
   * Fast live update of visual flow and metrics without re-rendering inputs
   */
  renderVisualsAndMetricsOnly() {
    const previewEl = document.getElementById('flow-live-preview-mount');
    const metricsEl = document.getElementById('flow-live-metrics-mount');
    if (!previewEl || !metricsEl) return;

    const { totalWorkload, criticalDuration } = window.Zoosh.ProcessFlow.calculateDurations(this.workingData.nodes);

    previewEl.innerHTML = window.Zoosh.ProcessFlow.renderTwoLaneFlowHtml(this.workingData.nodes, {
      compact: false,
      showLabels: true,
      showEmployees: true
    });

    metricsEl.innerHTML = `
      <div style="display: flex; gap: 14px; align-items: center;">
        <div style="background: #ffffff; border: 1px solid var(--border-light); padding: 8px 14px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); display: block;">Total Workload</span>
          <strong style="font-size: 16px; color: var(--text-main); font-family: var(--font-mono);">${totalWorkload} Days</strong>
        </div>
        <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 8px 14px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #166534; display: block;">Critical Flow Duration</span>
          <strong style="font-size: 16px; color: #15803d; font-family: var(--font-mono);">${criticalDuration} Days</strong>
        </div>
      </div>
    `;
  },

  /**
   * Render the complete right-side slide-over panel
   */
  render() {
    this.syncInputsFromDOM();

    // Preserve active element ID so focus isn't jarringly lost on live updates
    const activeElId = (typeof document !== 'undefined' && document.activeElement) ? document.activeElement.id : null;

    let container = document.getElementById('flow-drawer-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'flow-drawer-container';
      container.className = 'flow-drawer-overlay';
      document.body.appendChild(container);
    }

    if (!this.isOpen) {
      container.classList.remove('open');
      container.innerHTML = '';
      return;
    }

    container.classList.add('open');

    const state = window.Zoosh.State.getState();
    const employees = state.employees || [];
    const presets = window.Zoosh.ProcessFlow.PRESETS;
    const { totalWorkload, criticalDuration } = window.Zoosh.ProcessFlow.calculateDurations(this.workingData.nodes);

    container.innerHTML = `
      <div class="flow-drawer-panel" onclick="event.stopPropagation();">
        <!-- Drawer Header -->
        <div class="flow-drawer-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="badge badge-primary" style="font-size: 11px; padding: 2px 7px; font-family: var(--font-mono); font-weight: 700;">${this.escapeHtml(this.workingData.productCode || this.clientCode || 'Product')}</span>
              <span style="font-size: 12px; color: var(--text-muted);">${this.clientName} &bull; ${this.projectName}</span>
            </div>
            <h3 style="font-size: 18px; font-weight: 800; color: var(--text-main); margin: 0;">
              ${this.mode === 'ADD' ? 'Schedule Process Flow Order' : 'Edit Process Flow Order'}
            </h3>
          </div>
          <button class="modal-close-btn" onclick="window.Zoosh.ProcessFlowModal.close()" title="Cancel / Close">&times;</button>
        </div>

        <!-- Drawer Body -->
        <div class="flow-drawer-body">
          ${this.workingData.error ? `
            <div class="flow-error-banner" style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 6px; font-size: 12.5px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
              <span>⚠️</span>
              <span>${this.workingData.error}</span>
            </div>
          ` : ''}

          <!-- Furniture Item Basic Inputs -->
          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: 8px; padding: 14px; margin-bottom: 18px;">
            <div style="display: grid; grid-template-columns: 1.2fr 2fr 1fr 1fr; gap: 12px; align-items: flex-end;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 11.5px;">Product Code</label>
                <input 
                  type="text" 
                  id="flow-input-product-code" 
                  class="form-input" 
                  style="font-family: var(--font-mono); font-weight: 700; text-transform: uppercase;"
                  placeholder="e.g. GNS 101" 
                  value="${this.escapeHtml(this.workingData.productCode || '')}" 
                  oninput="window.Zoosh.ProcessFlowModal.workingData.productCode = this.value" 
                />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 11.5px;">Furniture Item Name</label>
                <input 
                  type="text" 
                  id="flow-input-item-name" 
                  class="form-input" 
                  placeholder="e.g. 3 Seater Sofa, 8-Seater Dining Table" 
                  value="${this.escapeHtml(this.workingData.itemName)}" 
                  oninput="window.Zoosh.ProcessFlowModal.handleItemNameInput(this.value)" 
                />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 11.5px;">Quantity</label>
                <input 
                  type="number" 
                  id="flow-input-qty" 
                  class="form-input" 
                  min="1" 
                  value="${this.workingData.qty || 1}" 
                  oninput="window.Zoosh.ProcessFlowModal.workingData.qty = parseInt(this.value, 10) || 1" 
                />
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" style="font-size: 11.5px;">Intake Date</label>
                <input 
                  type="date" 
                  id="flow-input-start-date" 
                  class="form-input" 
                  value="${this.workingData.startDate || ''}" 
                  onchange="window.Zoosh.ProcessFlowModal.workingData.startDate = this.value" 
                  oninput="window.Zoosh.ProcessFlowModal.workingData.startDate = this.value" 
                />
              </div>
            </div>
          </div>

          <!-- Section 1: Custom Flow Order Builder -->
          <div style="margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">
                Custom Flow Order
              </span>
              <span style="font-size: 11px; color: var(--text-muted);">Click to append process:</span>
            </div>
            
            <!-- Department Buttons (Image 3) -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
              ${window.Zoosh.ProcessFlow.DEPARTMENTS.map(dept => {
                const s = window.Zoosh.ProcessFlow.DEPT_STYLES[dept];
                return `
                  <button 
                    type="button"
                    class="btn btn-sm"
                    style="background: ${s.bg}; border: 1.5px solid ${s.border}; color: ${s.text}; font-weight: 700; padding: 6px 12px; border-radius: 6px;"
                    onclick="window.Zoosh.ProcessFlowModal.addNextProcess('${dept}')"
                    title="Add ${dept} as next sequential stage"
                  >
                    + ${dept}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Flow Action Buttons -->
            <div style="display: flex; gap: 8px; align-items: center;">
              <button 
                type="button" 
                class="btn btn-secondary btn-sm"
                onclick="window.Zoosh.ProcessFlowModal.addNextProcess('Carpentry')"
              >
                + Add Next Process (Lane 1)
              </button>
              <button 
                type="button" 
                class="btn btn-secondary btn-sm" 
                style="color: #ca8a04; border-color: #fef08a; background: #fefce8;"
                onclick="window.Zoosh.ProcessFlowModal.addParallelProcess('Upholstery')"
              >
                + Add Parallel Process (Lane 2)
              </button>
            </div>
          </div>

          <!-- Section 2: Quick Flow Order (12 Presets) -->
          <div style="margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">
                Quick Flow Order (Standard Presets)
              </span>
              <span style="font-size: 11px; color: var(--text-muted);">Select standard sequence:</span>
            </div>

            <div class="flow-presets-scroller" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; max-height: 180px; overflow-y: auto; padding: 4px; border: 1px solid var(--border-light); border-radius: 6px; background: #fafafa;">
              ${presets.map(p => {
                const isSelected = this.workingData.presetId === p.id;
                return `
                  <div 
                    class="flow-preset-card ${isSelected ? 'selected' : ''}" 
                    style="
                      background: ${isSelected ? '#f0fdf4' : '#ffffff'};
                      border: 1.5px solid ${isSelected ? '#22c55e' : 'var(--border-light)'};
                      border-radius: 6px;
                      padding: 8px 10px;
                      cursor: pointer;
                      transition: all 0.15s ease;
                    "
                    onclick="window.Zoosh.ProcessFlowModal.selectPreset('${p.id}')"
                  >
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <strong style="font-size: 12px; color: var(--text-main);">${p.name}</strong>
                      <span class="badge ${isSelected ? 'badge-primary' : 'badge-completed'}" style="font-size: 10px;">${p.code}</span>
                    </div>
                    <!-- Mini visual preview -->
                    ${window.Zoosh.ProcessFlow.renderTwoLaneFlowHtml(p.nodes, { compact: true, showLabels: true })}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 3: Live Proportional Two-Lane Graphical Chart -->
          <div style="margin-bottom: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">
                Scheduled Process Flow Order (Two Lanes)
              </span>
              <div id="flow-live-metrics-mount">
                <div style="display: flex; gap: 14px; align-items: center;">
                  <div style="background: #ffffff; border: 1px solid var(--border-light); padding: 8px 14px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); display: block;">Total Workload</span>
                    <strong style="font-size: 16px; color: var(--text-main); font-family: var(--font-mono);">${totalWorkload} Days</strong>
                  </div>
                  <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 8px 14px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
                    <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #166534; display: block;">Critical Flow Duration</span>
                    <strong style="font-size: 16px; color: #15803d; font-family: var(--font-mono);">${criticalDuration} Days</strong>
                  </div>
                </div>
              </div>
            </div>

            <div id="flow-live-preview-mount" style="margin-bottom: 10px;">
              ${window.Zoosh.ProcessFlow.renderTwoLaneFlowHtml(this.workingData.nodes, { compact: false, showLabels: true, showEmployees: true })}
            </div>
            <div style="font-size: 11px; color: var(--text-muted); font-style: italic;">
              * Cell widths change proportionally to working days duration. Lane 1 represents primary sequential flow; Lane 2 represents parallel operations.
            </div>
          </div>

          <!-- Section 4: Flow Summary & Duration Table (Image 1) -->
          <div style="margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">
                Production Stages &amp; Craftspeople Assignment
              </span>
              <span style="font-size: 11px; color: var(--text-muted);">Durations in 0.25 day steps (e.g. 1.25, 2.5)</span>
            </div>

            <div class="data-table-wrapper" style="border: 1px solid var(--border-light); border-radius: 6px; overflow-x: auto;">
              <table class="data-table" style="font-size: 12px; margin: 0;">
                <thead>
                  <tr style="background: #f8fafc;">
                    <th style="width: 45px;">#</th>
                    <th style="width: 90px;">Lane</th>
                    <th style="width: 140px;">Process</th>
                    <th>Craftsperson (Auto-Allocated)</th>
                    <th style="width: 110px;">Days (0.25)</th>
                    <th style="width: 140px;">Relationship</th>
                    <th style="width: 40px; text-align: center;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${this.workingData.nodes.map((n, idx) => {
                    const tempId = n.tempId || n.id;
                    const qualifiedEmps = employees.filter(e => 
                      e.active && (e.department === n.department || (e.secondaryDepartments || []).includes(n.department))
                    );

                    // Check leave conflict
                    const hasConflict = (state.manpowerRecords || []).some(m => 
                      m.employeeId === n.employeeId && m.action === 'LEAVE' && m.status === 'APPROVED'
                    );

                    return `
                      <tr>
                        <td style="font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
                        <td>
                          <select 
                            id="flow-select-lane-${tempId}"
                            class="form-input form-input-sm" 
                            style="padding: 2px 6px; font-size: 11.5px;"
                            onchange="window.Zoosh.ProcessFlowModal.updateLane('${tempId}', this.value)"
                          >
                            <option value="1" ${(n.lane || 1) === 1 ? 'selected' : ''}>Lane 1 (Main)</option>
                            <option value="2" ${n.lane === 2 ? 'selected' : ''}>Lane 2 (Parallel)</option>
                          </select>
                        </td>
                        <td>
                          <select 
                            id="flow-select-dept-${tempId}"
                            class="form-input form-input-sm" 
                            style="padding: 2px 6px; font-size: 11.5px; font-weight: 700;"
                            onchange="window.Zoosh.ProcessFlowModal.updateDepartment('${tempId}', this.value)"
                          >
                            ${window.Zoosh.ProcessFlow.DEPARTMENTS.map(dept => `
                              <option value="${dept}" ${dept === n.department ? 'selected' : ''}>${dept}</option>
                            `).join('')}
                          </select>
                        </td>
                        <td>
                          <div style="display: flex; flex-direction: column; gap: 2px;">
                            <select 
                              id="flow-select-emp-${tempId}"
                              class="form-input form-input-sm" 
                              style="padding: 2px 6px; font-size: 11.5px;"
                              onchange="window.Zoosh.ProcessFlowModal.updateEmployee('${tempId}', this.value)"
                            >
                              ${qualifiedEmps.map(emp => `
                                <option value="${emp.id}" ${emp.id === n.employeeId ? 'selected' : ''}>
                                  ${emp.name} (${emp.department}${emp.department !== n.department ? ' - Sec' : ''})
                                </option>
                              `).join('')}
                            </select>
                            ${hasConflict ? `
                              <span style="font-size: 10px; color: #b45309; font-weight: 600;">
                                ⚠️ Caution: On approved leave
                              </span>
                            ` : ''}
                          </div>
                        </td>
                        <td>
                          <input 
                            type="number" 
                            id="flow-duration-${tempId}"
                            class="form-input form-input-sm" 
                            step="0.25" 
                            min="0.25" 
                            value="${n.durationDays}" 
                            style="padding: 2px 6px; font-size: 12px; font-weight: 700; font-family: var(--font-mono);"
                            oninput="window.Zoosh.ProcessFlowModal.updateDuration('${tempId}', this.value)"
                          />
                        </td>
                        <td>
                          <span class="badge ${n.relationType === 'PARALLEL' ? 'badge-upholstery' : 'badge-on-schedule'}" style="font-size: 10px;">
                            ${n.relationType || (idx === 0 ? 'START' : 'AFTER')}
                          </span>
                        </td>
                        <td style="text-align: center;">
                          <button 
                            type="button" 
                            class="btn btn-secondary btn-sm" 
                            style="color: #dc2626; padding: 2px 6px; font-size: 11px; min-width: 24px;"
                            onclick="window.Zoosh.ProcessFlowModal.removeNode('${tempId}')"
                            title="Remove stage"
                          >
                            &times;
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Drawer Footer -->
        <div class="flow-drawer-footer">
          <button class="btn btn-secondary" onclick="window.Zoosh.ProcessFlowModal.close()">
            Cancel
          </button>
          <button class="btn btn-primary" onclick="window.Zoosh.ProcessFlowModal.applyFlow()">
            ${this.mode === 'ADD' ? 'Apply Flow &amp; Schedule Item' : 'Save Changes to Flow'}
          </button>
        </div>
      </div>
    `;

    // Restore focus if element was active prior to re-render
    if (activeElId && typeof document !== 'undefined') {
      const activeEl = document.getElementById(activeElId);
      if (activeEl && typeof activeEl.focus === 'function') {
        try {
          activeEl.focus();
        } catch (e) {}
      }
    }
  }
};

// Aliases for compatibility
window.Zoosh.ScheduleFlowPanel = window.Zoosh.ProcessFlowModal;
window.Zoosh.AddFurnitureWizard = {
  open(projectId) {
    window.Zoosh.ProcessFlowModal.openAdd(projectId);
  }
};
