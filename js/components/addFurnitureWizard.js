/**
 * Guided 4-Step Add Furniture Wizard Modal
 * Step 1: Furniture Info & Project Selection (Shows Client & SRL context)
 * Step 2: Production Process Flow selection
 * Step 3: Employee suggestion & assignment
 * Step 4: Duration (supports decimals) & Preview
 * 
 * NOTE: Strictly NO SRL numbers are assigned to furniture!
 * SRL belongs to the Client/Customer.
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.AddFurnitureWizard = {
  currentStep: 1,
  wizardData: {
    projectId: '',
    furnitureName: '',
    flowTypeId: '',
    startDate: '',
    processes: [] // array of { department, employeeId, durationDays, notes }
  },

  open(preselectedProjectId = '') {
    // RBAC check
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canCreate()) {
      alert('Permission Denied: Your role is Visitor (read-only) and cannot add furniture.');
      return;
    }

    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;

    if (!state.projects || state.projects.length === 0) {
      alert('Please create at least one Project first before adding furniture.\nClick "+ New Project" to begin.');
      return;
    }

    const defaultProjId = preselectedProjectId || (state.projects[0] ? state.projects[0].id : '');
    const defaultFlow = state.flowTypes && state.flowTypes[0] ? state.flowTypes[0].id : '';

    this.currentStep = 1;
    this.wizardData = {
      projectId: defaultProjId,
      furnitureName: '',
      flowTypeId: defaultFlow,
      startDate: config.CURRENT_DATE,
      processes: []
    };

    this.render();
  },

  render() {
    const title = 'Add Furniture Item to Production';
    
    const stepsHeader = `
      <div class="wizard-steps">
        <div class="wizard-step-node ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}">
          <div class="wizard-step-circle">1</div>
          <span class="wizard-step-label">Furniture Info</span>
        </div>
        <div class="wizard-step-node ${this.currentStep === 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''}">
          <div class="wizard-step-circle">2</div>
          <span class="wizard-step-label">Process Flow</span>
        </div>
        <div class="wizard-step-node ${this.currentStep === 3 ? 'active' : ''} ${this.currentStep > 3 ? 'completed' : ''}">
          <div class="wizard-step-circle">3</div>
          <span class="wizard-step-label">Craftspeople</span>
        </div>
        <div class="wizard-step-node ${this.currentStep === 4 ? 'active' : ''}">
          <div class="wizard-step-circle">4</div>
          <span class="wizard-step-label">Duration &amp; Review</span>
        </div>
      </div>
    `;

    let bodyHtml = stepsHeader;
    let footerHtml = '';

    if (this.currentStep === 1) {
      bodyHtml += this.renderStep1();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="window.Zoosh.AddFurnitureWizard.goToStep(2)">Continue to Process Flow &rarr;</button>
      `;
    } else if (this.currentStep === 2) {
      bodyHtml += this.renderStep2();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.AddFurnitureWizard.goToStep(1)">&larr; Back</button>
        <button class="btn btn-primary" onclick="window.Zoosh.AddFurnitureWizard.goToStep(3)">Continue to Craftspeople &rarr;</button>
      `;
    } else if (this.currentStep === 3) {
      bodyHtml += this.renderStep3();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.AddFurnitureWizard.goToStep(2)">&larr; Back</button>
        <button class="btn btn-primary" onclick="window.Zoosh.AddFurnitureWizard.goToStep(4)">Continue to Durations &rarr;</button>
      `;
    } else if (this.currentStep === 4) {
      bodyHtml += this.renderStep4();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.AddFurnitureWizard.goToStep(3)">&larr; Back</button>
        <button class="btn btn-accent" onclick="window.Zoosh.AddFurnitureWizard.submit()">Confirm &amp; Schedule Furniture</button>
      `;
    }

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '650px');
  },

  renderStep1() {
    const state = window.Zoosh.State.getState();
    const projects = state.projects || [];
    const clientsMap = new Map((state.clients || []).map(c => [c.id, c]));

    const selectedProj = projects.find(p => p.id === this.wizardData.projectId) || projects[0];
    const selectedClient = selectedProj ? clientsMap.get(selectedProj.clientId) : null;

    return `
      <div style="padding: 10px 0;">
        <div class="form-group">
          <label class="form-label" for="wizard-proj-select">Target Project</label>
          <select id="wizard-proj-select" class="form-input" onchange="window.Zoosh.AddFurnitureWizard.onProjectChange(this.value)">
            ${projects.map(p => {
              const cl = clientsMap.get(p.clientId);
              const srlLabel = cl ? `[SRL ${cl.srl} &bull; ${cl.name}]` : (p.clientSrl ? `[SRL ${p.clientSrl}]` : '');
              return `
                <option value="${p.id}" ${p.id === this.wizardData.projectId ? 'selected' : ''}>
                  ${p.name} ${srlLabel} &mdash; ${p.location}
                </option>
              `;
            }).join('')}
          </select>
        </div>

        ${selectedProj ? `
          <div style="background: var(--bg-surface-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px 14px; margin-bottom: 18px; font-size: 12.5px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="color: var(--text-muted);">Client / SRL:</span>
              <strong style="color: var(--primary-color);">
                ${selectedClient ? `${selectedClient.name} (SRL ${selectedClient.srl})` : (selectedProj.clientName ? `${selectedProj.clientName} (SRL ${selectedProj.clientSrl || '—'})` : '—')}
              </strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="color: var(--text-muted);">Delivery Target:</span>
              <span style="font-family: var(--font-mono); font-weight: 700; color: #b91c1c;">
                ${window.Zoosh.Calendar.formatDisplayDate(selectedProj.deliveryDeadline, false, true)}
              </span>
            </div>
          </div>
        ` : ''}

        <div class="form-group">
          <label class="form-label" for="wizard-item-name">Furniture Item Name</label>
          <input 
            type="text" 
            id="wizard-item-name" 
            class="form-input" 
            placeholder="e.g. 8-Seater Dining Table, Master Bed Frame, Sectional Sofa" 
            value="${this.wizardData.furnitureName || ''}" 
            required 
            autofocus 
          />
          <div class="form-help-text">Enter the specific furniture item to be built under this project.</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="wizard-start-date">Factory Start Date</label>
          <input 
            type="date" 
            id="wizard-start-date" 
            class="form-input" 
            value="${this.wizardData.startDate}" 
          />
          <div class="form-help-text">Production line intake date for this furniture piece.</div>
        </div>
      </div>
    `;
  },

  onProjectChange(newProjId) {
    this.saveStep1Inputs();
    this.wizardData.projectId = newProjId;
    this.render();
  },

  saveStep1Inputs() {
    const projSelect = document.getElementById('wizard-proj-select');
    const nameInput = document.getElementById('wizard-item-name');
    const dateInput = document.getElementById('wizard-start-date');

    if (projSelect) this.wizardData.projectId = projSelect.value;
    if (nameInput) this.wizardData.furnitureName = nameInput.value.trim();
    if (dateInput) this.wizardData.startDate = dateInput.value;
  },

  renderStep2() {
    const state = window.Zoosh.State.getState();
    const flowTypes = state.flowTypes || [];

    return `
      <div style="padding: 10px 0;">
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
          Select the sequence of manufacturing stages required for <strong>${this.wizardData.furnitureName || 'this item'}</strong>:
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${flowTypes.map(f => {
            const isSelected = f.id === this.wizardData.flowTypeId;
            return `
              <div 
                class="card-panel" 
                style="padding: 14px 16px; cursor: pointer; border: 2px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-light)'}; background: ${isSelected ? '#f0fdf4' : 'var(--bg-surface)'};"
                onclick="window.Zoosh.AddFurnitureWizard.selectFlowType('${f.id}')"
              >
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <strong style="color: var(--text-main); font-size: 13.5px;">${f.name}</strong>
                  <span class="badge ${isSelected ? 'badge-primary' : 'badge-completed'}" style="font-size: 11px;">
                    ${f.code}
                  </span>
                </div>
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
                  ${f.description}
                </div>
                <div class="flow-breadcrumbs">
                  ${f.steps.map((st, idx) => `
                    <span class="badge badge-${st.toLowerCase()}" style="font-size: 10px;">${st}</span>
                    ${idx < f.steps.length - 1 ? '<span class="flow-crumb-arrow">&rarr;</span>' : ''}
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  selectFlowType(flowTypeId) {
    this.wizardData.flowTypeId = flowTypeId;
    this.render();
  },

  renderStep3() {
    const state = window.Zoosh.State.getState();
    const flowType = (state.flowTypes || []).find(f => f.id === this.wizardData.flowTypeId) || state.flowTypes[0];
    const steps = flowType ? flowType.steps : ['Carpentry', 'Polish'];

    // Initialize default processes with smart allocator suggestions if empty
    if (!this.wizardData.processes || this.wizardData.processes.length !== steps.length) {
      this.wizardData.processes = steps.map((dept, idx) => {
        const suggestion = window.Zoosh.Allocator.suggestEmployee(dept, this.wizardData.startDate, 1);
        return {
          sequence: idx + 1,
          department: dept,
          employeeId: suggestion.suggestedEmployee ? suggestion.suggestedEmployee.id : '',
          durationDays: dept === 'Polish' ? 1.5 : 2,
          notes: ''
        };
      });
    }

    return `
      <div style="padding: 10px 0;">
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
          Assign craftspeople to each production stage. Zoosh engine has preselected the best qualified and available artisan:
        </p>

        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${this.wizardData.processes.map((proc, idx) => {
            const qualifiedEmps = (state.employees || []).filter(e => 
              e.active && (e.department === proc.department || (e.secondaryDepartments || []).includes(proc.department))
            );

            return `
              <div class="card-panel" style="padding: 14px 16px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 800; font-size: 12px; color: var(--text-muted);">STEP ${idx + 1}</span>
                    <span class="badge badge-${proc.department.toLowerCase()}" style="font-size: 11px;">
                      ${proc.department}
                    </span>
                  </div>
                  <span style="font-size: 11px; color: var(--text-muted);">
                    ${qualifiedEmps.length} artisan(s) qualified
                  </span>
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <label class="form-label" style="font-size: 12px;">Assigned Craftsperson</label>
                  <select 
                    class="form-input" 
                    id="wizard-emp-step-${idx}" 
                    onchange="window.Zoosh.AddFurnitureWizard.wizardData.processes[${idx}].employeeId = this.value"
                  >
                    ${qualifiedEmps.map(emp => `
                      <option value="${emp.id}" ${emp.id === proc.employeeId ? 'selected' : ''}>
                        ${emp.name} (${emp.department}${emp.department !== proc.department ? ' - Secondary' : ''})
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  renderStep4() {
    const state = window.Zoosh.State.getState();
    const project = (state.projects || []).find(p => p.id === this.wizardData.projectId);
    const client = project ? (state.clients || []).find(c => c.id === project.clientId) : null;
    const employeesMap = new Map((state.employees || []).map(e => [e.id, e]));

    return `
      <div style="padding: 10px 0;">
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 14px;">
          Set working day durations for each stage (supports decimals, e.g. 1.5 days = 12 hours):
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
          ${this.wizardData.processes.map((proc, idx) => {
            const emp = employeesMap.get(proc.employeeId);
            return `
              <div class="card-panel" style="padding: 12px 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge badge-${proc.department.toLowerCase()}">${proc.department}</span>
                    <span style="font-size: 12.5px; font-weight: 600; color: var(--text-main);">${emp ? emp.name : 'Unassigned'}</span>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 140px 1fr; gap: 12px; align-items: center;">
                  <div>
                    <label class="form-label" style="font-size: 11px;">Duration (Working Days)</label>
                    <input 
                      type="number" 
                      step="0.25" 
                      min="0.25" 
                      id="wizard-duration-step-${idx}"
                      class="form-input" 
                      value="${proc.durationDays}" 
                      onchange="window.Zoosh.AddFurnitureWizard.wizardData.processes[${idx}].durationDays = parseFloat(this.value) || 1"
                    />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 11px;">Task Notes / Specifications</label>
                    <input 
                      type="text" 
                      id="wizard-notes-step-${idx}"
                      class="form-input" 
                      placeholder="e.g. Mortise &amp; tenon joinery" 
                      value="${proc.notes || ''}" 
                      onchange="window.Zoosh.AddFurnitureWizard.wizardData.processes[${idx}].notes = this.value"
                    />
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Final Hierarchy Verification Box -->
        <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 14px; font-size: 12.5px;">
          <div style="font-weight: 700; color: var(--text-main); margin-bottom: 8px;">
            Production Intake Summary
          </div>
          <div style="display: grid; grid-template-columns: 100px 1fr; gap: 6px; margin-bottom: 4px;">
            <span style="color: var(--text-muted);">Client / SRL:</span>
            <strong>${client ? `${client.name} (SRL ${client.srl})` : (project ? `${project.clientName} (SRL ${project.clientSrl})` : '—')}</strong>
          </div>
          <div style="display: grid; grid-template-columns: 100px 1fr; gap: 6px; margin-bottom: 4px;">
            <span style="color: var(--text-muted);">Project:</span>
            <span>${project ? project.name : '—'}</span>
          </div>
          <div style="display: grid; grid-template-columns: 100px 1fr; gap: 6px;">
            <span style="color: var(--text-muted);">Furniture Item:</span>
            <strong style="color: var(--primary-color);">${this.wizardData.furnitureName}</strong>
          </div>
        </div>
      </div>
    `;
  },

  goToStep(stepNumber) {
    if (this.currentStep === 1) {
      this.saveStep1Inputs();
      if (!this.wizardData.furnitureName) {
        alert('Please enter a furniture item name.');
        return;
      }
    } else if (this.currentStep === 3) {
      // Sync craftsperson dropdowns
      (this.wizardData.processes || []).forEach((p, idx) => {
        const select = document.getElementById(`wizard-emp-step-${idx}`);
        if (select) p.employeeId = select.value;
      });
    } else if (this.currentStep === 4) {
      (this.wizardData.processes || []).forEach((p, idx) => {
        const durInput = document.getElementById(`wizard-duration-step-${idx}`);
        const notesInput = document.getElementById(`wizard-notes-step-${idx}`);
        if (durInput) p.durationDays = parseFloat(durInput.value) || 1;
        if (notesInput) p.notes = notesInput.value;
      });
    }

    this.currentStep = stepNumber;
    this.render();
  },

  submit() {
    this.goToStep(4); // sync step 4 fields

    try {
      const newFurniture = window.Zoosh.State.addFurniture(
        {
          projectId: this.wizardData.projectId,
          name: this.wizardData.furnitureName,
          flowTypeId: this.wizardData.flowTypeId,
          startDate: this.wizardData.startDate
        },
        this.wizardData.processes
      );

      window.Zoosh.Modal.close();

      // Navigate to project detail view
      if (window.Zoosh.Views.Projects) {
        window.Zoosh.Views.Projects.openDetail(this.wizardData.projectId);
      }
    } catch (err) {
      alert(err.message);
    }
  }
};

/**
 * Dedicated Modal for Creating a New Client / SRL
 */
window.Zoosh.AddClientModal = {
  open() {
    if (window.Zoosh.Auth && !window.Zoosh.Auth.canCreate()) {
      alert('Permission Denied: Your role is Visitor (read-only) and cannot add clients.');
      return;
    }

    const nextSrl = window.Zoosh.State.getNextClientSrl();
    const modalContent = `
      <div id="add-client-error" style="display: none; padding: 8px 12px; border-radius: 6px; background: #fef2f2; color: #991b1b; font-size: 12.5px; margin-bottom: 12px;"></div>
      
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; font-size: 12.5px; color: #166534;">
        <strong>SRL belongs to the Client:</strong> SRL is the short-form customer identifier (e.g. SRL 101 for Sreelal). Furniture items produced for this client will be organized under projects associated with this SRL.
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Client SRL Number</label>
        <input type="number" id="new-client-srl" class="form-input" value="${nextSrl}" required />
        <div class="form-help-text">Unique short-form identifier for this customer.</div>
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Client / Customer Name</label>
        <input type="text" id="new-client-name" class="form-input" placeholder="e.g. Sreelal, Wayanad Hospitality" required autofocus />
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Location / City</label>
        <input type="text" id="new-client-location" class="form-input" placeholder="e.g. Calicut, Kochi, Bangalore" />
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Phone Number</label>
        <input type="tel" id="new-client-phone" class="form-input" placeholder="e.g. +91 98470 12345" />
      </div>

      <div class="form-group" style="margin-bottom: 12px;">
        <label class="form-label">Notes</label>
        <textarea id="new-client-notes" class="form-input" rows="2" placeholder="Luxury villa, custom teak specifications, etc."></textarea>
      </div>
    `;

    const modalFooter = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.AddClientModal.submit()">Save Client &amp; SRL</button>
    `;

    window.Zoosh.Modal.open('+ New Client / SRL', modalContent, modalFooter, '480px');
  },

  submit() {
    const srlInput = document.getElementById('new-client-srl');
    const nameInput = document.getElementById('new-client-name');
    const locInput = document.getElementById('new-client-location');
    const phoneInput = document.getElementById('new-client-phone');
    const notesInput = document.getElementById('new-client-notes');
    const errEl = document.getElementById('add-client-error');

    const srl = srlInput ? srlInput.value : '';
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Client name is required.'; }
      return;
    }

    try {
      window.Zoosh.State.addClient({
        srl: Number(srl),
        name: name,
        location: locInput ? locInput.value : '',
        phone: phoneInput ? phoneInput.value : '',
        notes: notesInput ? notesInput.value : ''
      });

      window.Zoosh.Modal.close();
      if (window.Zoosh.Views.Projects) {
        window.Zoosh.Views.Projects.render(document.getElementById('view-container'));
      }
    } catch (err) {
      if (errEl) { errEl.style.display = 'block'; errEl.textContent = err.message; }
    }
  }
};

// Aliases for backward compatibility
window.Zoosh.AddSrlWizard = window.Zoosh.AddFurnitureWizard;
