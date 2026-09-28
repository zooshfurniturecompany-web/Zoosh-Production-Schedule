/**
 * Guided 4-Step Add Item Wizard Modal
 * Step 1: Furniture Info
 * Step 2: Production Process Flow selection
 * Step 3: Employee suggestion & assignment
 * Step 4: Duration (supports decimals) & Preview
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.AddSrlWizard = {
  currentStep: 1,
  wizardData: {
    projectId: '',
    furnitureName: '',
    flowTypeId: '',
    startDate: '',
    processes: [] // array of { department, employeeId, durationDays, notes }
  },

  open(preselectedProjectId = '') {
    const state = window.Zoosh.State.getState();
    const config = window.Zoosh.Config;

    if (!state.projects || state.projects.length === 0) {
      alert('Please create at least one Project first before adding furniture.');
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
    const nextSrlNum = window.Zoosh.State.getNextSrlNumber();
    const title = `Add Furniture Item — Auto SRL ${nextSrlNum}`;
    
    const stepsHeader = `
      <div class="wizard-steps">
        <div class="wizard-step-node ${this.currentStep === 1 ? 'active' : ''} ${this.currentStep > 1 ? 'completed' : ''}">
          <div class="wizard-step-circle">1</div>
          <span class="wizard-step-label">Furniture</span>
        </div>
        <div class="wizard-step-node ${this.currentStep === 2 ? 'active' : ''} ${this.currentStep > 2 ? 'completed' : ''}">
          <div class="wizard-step-circle">2</div>
          <span class="wizard-step-label">Process Flow</span>
        </div>
        <div class="wizard-step-node ${this.currentStep === 3 ? 'active' : ''} ${this.currentStep > 3 ? 'completed' : ''}">
          <div class="wizard-step-circle">3</div>
          <span class="wizard-step-label">Employees</span>
        </div>
        <div class="wizard-step-node ${this.currentStep === 4 ? 'active' : ''}">
          <div class="wizard-step-circle">4</div>
          <span class="wizard-step-label">Duration</span>
        </div>
      </div>
    `;

    let bodyHtml = stepsHeader;
    let footerHtml = '';

    if (this.currentStep === 1) {
      bodyHtml += this.renderStep1();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
        <button class="btn btn-primary" onclick="window.Zoosh.AddSrlWizard.goToStep(2)">Continue to Process Flow &rarr;</button>
      `;
    } else if (this.currentStep === 2) {
      bodyHtml += this.renderStep2();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.AddSrlWizard.goToStep(1)">&larr; Back</button>
        <button class="btn btn-primary" onclick="window.Zoosh.AddSrlWizard.goToStep(3)">Continue to Employees &rarr;</button>
      `;
    } else if (this.currentStep === 3) {
      bodyHtml += this.renderStep3();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.AddSrlWizard.goToStep(2)">&larr; Back</button>
        <button class="btn btn-primary" onclick="window.Zoosh.AddSrlWizard.goToStep(4)">Continue to Durations &rarr;</button>
      `;
    } else if (this.currentStep === 4) {
      bodyHtml += this.renderStep4();
      footerHtml = `
        <button class="btn btn-secondary" onclick="window.Zoosh.AddSrlWizard.goToStep(3)">&larr; Back</button>
        <button class="btn btn-accent" onclick="window.Zoosh.AddSrlWizard.submit()">Confirm &amp; Schedule SRL ${nextSrlNum}</button>
      `;
    }

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '650px');
  },

  renderStep1() {
    const state = window.Zoosh.State.getState();
    const nextSrlNum = window.Zoosh.State.getNextSrlNumber();

    return `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="background: var(--bg-hover); padding: 12px 16px; border-radius: var(--radius-sm); border-left: 4px solid #0f172a;">
          <div style="font-weight: 700; font-size: 13px;">SRL NUMBER: <span style="color: #2563eb;">SRL ${nextSrlNum}</span></div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">Assigned automatically by the system. User never manually enters the SRL.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Project</label>
          <select id="wizard-project-id" class="form-select" onchange="window.Zoosh.AddSrlWizard.wizardData.projectId = this.value">
            ${state.projects.map(p => `
              <option value="${p.id}" ${p.id === this.wizardData.projectId ? 'selected' : ''}>
                ${p.name} (Client: ${p.clientName} | Deadline: ${p.deliveryDeadline})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">What are you producing? (Furniture Name)</label>
          <input type="text" id="wizard-furniture-name" class="form-input" 
            placeholder="e.g. Dining Table (8 Seater), L-Shape Sofa, Teak Bed"
            value="${this.wizardData.furnitureName}"
            oninput="window.Zoosh.AddSrlWizard.wizardData.furnitureName = this.value" />
        </div>

        <div class="form-group">
          <label class="form-label">Production Start Date</label>
          <input type="date" id="wizard-start-date" class="form-input" 
            value="${this.wizardData.startDate}"
            onchange="window.Zoosh.AddSrlWizard.wizardData.startDate = this.value" />
        </div>
      </div>
    `;
  },

  renderStep2() {
    const state = window.Zoosh.State.getState();

    return `
      <div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
          Select the standard manufacturing sequence for <strong>${this.wizardData.furnitureName || 'this item'}</strong>:
        </p>

        <div class="flow-card-list">
          ${(state.flowTypes || []).map(flow => {
            const isSelected = flow.id === this.wizardData.flowTypeId;
            return `
              <div class="flow-card ${isSelected ? 'selected' : ''}" onclick="window.Zoosh.AddSrlWizard.selectFlowType('${flow.id}')">
                <div class="flow-card-header">
                  <span class="flow-card-code">${flow.code}</span>
                  <span style="font-size: 11.5px; color: var(--text-muted);">${flow.description || ''}</span>
                </div>
                <div class="flow-breadcrumbs">
                  ${(flow.steps || []).map((step, idx) => `
                    <span class="badge badge-${step.toLowerCase()}">${step}</span>
                    ${idx < flow.steps.length - 1 ? '<span class="flow-crumb-arrow">&rarr;</span>' : ''}
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  selectFlowType(flowId) {
    this.wizardData.flowTypeId = flowId;
    this.render();
  },

  renderStep3() {
    const state = window.Zoosh.State.getState();
    const flow = (state.flowTypes || []).find(f => f.id === this.wizardData.flowTypeId) || state.flowTypes[0];
    const steps = flow ? flow.steps : ['Carpentry'];

    // Auto-populate processes if not yet populated or if step count changed
    if (this.wizardData.processes.length !== steps.length) {
      this.wizardData.processes = steps.map((dept, idx) => {
        // Suggest best employee for this department
        const suggestion = window.Zoosh.Allocator.suggestEmployee(dept, this.wizardData.startDate);
        return {
          department: dept,
          employeeId: suggestion.suggestedEmployee ? suggestion.suggestedEmployee.id : '',
          durationDays: 2, // default 2 days
          notes: ''
        };
      });
    }

    return `
      <div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
          Assign craftspeople to each process stage. The system automatically recommends the best candidate based on active workload and availability:
        </p>

        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${this.wizardData.processes.map((proc, idx) => {
            const suggestion = window.Zoosh.Allocator.suggestEmployee(proc.department, this.wizardData.startDate);
            const suggestedId = suggestion.suggestedEmployee ? suggestion.suggestedEmployee.id : '';

            // Filter employees by department
            const eligibleEmployees = state.employees.filter(e => 
              e.active && (e.department === proc.department || (e.secondaryDepartments || []).includes(proc.department))
            );

            return `
              <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px 16px; background: #ffffff;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 700; font-size: 12px; color: var(--text-muted);">STEP ${idx + 1}</span>
                    <span class="badge badge-${proc.department.toLowerCase()}">${proc.department}</span>
                  </div>
                  ${proc.employeeId === suggestedId ? `
                    <span class="recommended-badge">&#10003; Recommended (Optimal Availability)</span>
                  ` : ''}
                </div>

                <div class="form-group" style="margin-bottom: 0;">
                  <select class="form-select" onchange="window.Zoosh.AddSrlWizard.updateProcessEmployee(${idx}, this.value)">
                    ${eligibleEmployees.map(emp => `
                      <option value="${emp.id}" ${emp.id === proc.employeeId ? 'selected' : ''}>
                        ${emp.name} (${emp.department}${emp.id === suggestedId ? ' - Recommended' : ''})
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

  updateProcessEmployee(index, empId) {
    if (this.wizardData.processes[index]) {
      this.wizardData.processes[index].employeeId = empId;
      this.render();
    }
  },

  renderStep4() {
    return `
      <div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
          Specify production duration for each stage. <strong>Decimal days are fully supported</strong> (e.g., 1, 1.25, 1.5, 2, 2.5, 4 days).
        </p>

        <div style="display: flex; flex-direction: column; gap: 14px;">
          ${this.wizardData.processes.map((proc, idx) => {
            const state = window.Zoosh.State.getState();
            const emp = state.employees.find(e => e.id === proc.employeeId);
            return `
              <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 12px 16px; background: #ffffff;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="badge badge-${proc.department.toLowerCase()}">${proc.department}</span>
                    <span style="font-size: 12.5px; color: var(--text-secondary); font-weight: 500;">
                      Assigned: <strong>${emp ? emp.name : 'Unassigned'}</strong>
                    </span>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="flex: 1;">
                    <input type="number" step="0.25" min="0.25" max="30" class="form-input" 
                      value="${proc.durationDays}" 
                      onchange="window.Zoosh.AddSrlWizard.updateProcessDuration(${idx}, this.value)" />
                  </div>
                  <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">days</span>
                  <div style="font-size: 11.5px; color: var(--text-muted); min-width: 140px;">
                    = ${(parseFloat(proc.durationDays) || 1) * 8} working hours
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  updateProcessDuration(index, value) {
    if (this.wizardData.processes[index]) {
      this.wizardData.processes[index].durationDays = parseFloat(value) || 1;
    }
  },

  goToStep(stepNumber) {
    if (stepNumber === 2 && !this.wizardData.furnitureName.trim()) {
      alert('Please enter the Furniture Name (e.g. Dining Table).');
      return;
    }
    this.currentStep = stepNumber;
    this.render();
  },

  submit() {
    if (!this.wizardData.furnitureName.trim()) {
      alert('Please provide a Furniture Name.');
      this.goToStep(1);
      return;
    }

    const newSrl = window.Zoosh.State.addSrl({
      projectId: this.wizardData.projectId,
      furnitureName: this.wizardData.furnitureName.trim(),
      flowTypeId: this.wizardData.flowTypeId,
      startDate: this.wizardData.startDate
    }, this.wizardData.processes);

    window.Zoosh.Modal.close();

    // Show confirmation feedback
    if (window.Zoosh.App) {
      window.Zoosh.App.showToast(`SRL ${newSrl.srlNumber} created and scheduled successfully!`);
    }
  }
};
