/**
 * Production Processes & Flow Types View
 * Visual Flow Builder defining WHAT processes are required and IN WHAT ORDER they happen.
 */
window.Zoosh = window.Zoosh || {};
window.Zoosh.Views = window.Zoosh.Views || {};

window.Zoosh.Views.Processes = {
  render(container) {
    const state = window.Zoosh.State.getState();
    const flowTypes = state.flowTypes || [];

    container.innerHTML = `
      <div class="view-header">
        <div>
          <h2 class="view-header-title">Production Processes &amp; Flow Types</h2>
          <div class="view-header-subtitle">Standard manufacturing sequences &amp; process dependency rules</div>
        </div>
        <button class="btn btn-primary" onclick="window.Zoosh.Views.Processes.openAddModal()">
          <span>+</span> Add Flow Type
        </button>
      </div>

      <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 16px 20px; margin-bottom: 24px; border-left: 4px solid #0f172a;">
        <div style="font-weight: 700; font-size: 13.5px; color: var(--text-main);">Process Dependency Principle</div>
        <div style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px;">
          Flow types define <strong>WHAT processes are required</strong> and <strong>IN WHAT ORDER they must happen</strong>. 
          When a stage is delayed, subsequent dependent stages automatically cascade forward. Duration and craftsperson assignments are customized per individual furniture item.
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 14px;">
        ${flowTypes.map(flow => `
          <div class="card-panel" style="margin-bottom: 0;">
            <div class="card-panel-header" style="background: #ffffff;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-weight: 800; font-size: 13px; color: #0f172a; background: var(--bg-hover); padding: 3px 8px; border-radius: 4px; font-family: var(--font-mono);">
                  ${flow.code}
                </span>
                <div>
                  <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">${flow.name}</div>
                  <div style="font-size: 12px; color: var(--text-muted); margin-top: 1px;">${flow.description || ''}</div>
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Processes.openEditModal('${flow.id}')">
                  Edit
                </button>
                <button class="btn btn-secondary btn-sm" style="color: #b91c1c;" onclick="window.Zoosh.Views.Processes.deleteFlow('${flow.id}')">
                  Delete
                </button>
              </div>
            </div>
            <div class="card-panel-body" style="padding: 16px 20px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-muted); margin-bottom: 10px;">
                Mandatory Execution Order:
              </div>
              <div class="flow-breadcrumbs" style="align-items: center;">
                ${(flow.steps || []).map((step, idx) => `
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 11px; font-weight: 700; color: var(--text-muted);">${idx + 1}.</span>
                    <span class="badge badge-${step.toLowerCase()}" style="font-size: 12px; padding: 4px 10px;">${step}</span>
                  </div>
                  ${idx < flow.steps.length - 1 ? '<span class="flow-crumb-arrow" style="font-size: 18px; font-weight: bold;">&rarr;</span>' : ''}
                `).join('')}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  openAddModal() {
    this._editingSteps = ['Carpentry', 'Polish'];
    this._renderFlowBuilderModal('Add New Process Flow Type');
  },

  openEditModal(flowId) {
    const state = window.Zoosh.State.getState();
    const flow = (state.flowTypes || []).find(f => f.id === flowId);
    if (!flow) return;

    this._editingFlowId = flowId;
    this._editingSteps = [...(flow.steps || [])];
    this._renderFlowBuilderModal(`Edit Flow Type — ${flow.code}`, flow);
  },

  _renderFlowBuilderModal(title, flow = null) {
    const config = window.Zoosh.Config;
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Flow Code</label>
            <input type="text" id="flow-code" class="form-input" value="${flow ? flow.code : 'TYPE ' + (window.Zoosh.State.getState().flowTypes.length + 1)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Flow Name / Description</label>
            <input type="text" id="flow-name" class="form-input" placeholder="e.g. Carpentry &rarr; Polish &rarr; Upholstery" value="${flow ? flow.name : ''}" />
          </div>
        </div>

        <div>
          <label class="form-label">Visual Process Sequence (In Exact Order)</label>
          <div id="flow-steps-preview" style="min-height: 52px; background: var(--bg-hover); border: 2px dashed var(--border-light); border-radius: var(--radius-sm); padding: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px;">
            ${this._renderStepsChips()}
          </div>

          <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px;">
            Click department to append next step:
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Object.keys(config.DEPARTMENTS).map(d => `
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.Zoosh.Views.Processes.appendStep('${d}')">
                + ${d}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.Zoosh.Modal.close()">Cancel</button>
      <button class="btn btn-primary" onclick="window.Zoosh.Views.Processes.saveFlow()">Save Flow Type</button>
    `;

    window.Zoosh.Modal.open(title, bodyHtml, footerHtml, '580px');
  },

  _renderStepsChips() {
    if (!this._editingSteps || this._editingSteps.length === 0) {
      return '<span style="color: var(--text-muted); font-size: 12px;">No steps added yet. Click departments below to build sequence.</span>';
    }

    return this._editingSteps.map((step, idx) => `
      <span class="badge badge-${step.toLowerCase()}" style="font-size: 12px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px;">
        ${idx + 1}. ${step}
        <span style="cursor: pointer; font-weight: 800; font-size: 14px; margin-left: 2px;" onclick="window.Zoosh.Views.Processes.removeStep(${idx})">&times;</span>
      </span>
      ${idx < this._editingSteps.length - 1 ? '<span style="color: #94a3b8; font-weight: bold;">&rarr;</span>' : ''}
    `).join('');
  },

  appendStep(dept) {
    this._editingSteps.push(dept);
    const container = document.getElementById('flow-steps-preview');
    if (container) container.innerHTML = this._renderStepsChips();
  },

  removeStep(idx) {
    this._editingSteps.splice(idx, 1);
    const container = document.getElementById('flow-steps-preview');
    if (container) container.innerHTML = this._renderStepsChips();
  },

  saveFlow() {
    const code = document.getElementById('flow-code').value.trim();
    let name = document.getElementById('flow-name').value.trim();

    if (!code) {
      alert('Please provide a flow code.');
      return;
    }
    if (this._editingSteps.length === 0) {
      alert('Please add at least one production step.');
      return;
    }
    if (!name) {
      name = this._editingSteps.join(' → ');
    }

    if (this._editingFlowId) {
      const state = window.Zoosh.State.getState();
      const flow = state.flowTypes.find(f => f.id === this._editingFlowId);
      if (flow) {
        flow.code = code;
        flow.name = name;
        flow.steps = [...this._editingSteps];
        window.Zoosh.State.persist();
        window.Zoosh.State.notify();
      }
      this._editingFlowId = null;
    } else {
      window.Zoosh.State.addFlowType({
        code,
        name,
        steps: [...this._editingSteps]
      });
    }

    window.Zoosh.Modal.close();
  },

  deleteFlow(flowId) {
    if (confirm('Delete this flow type? Existing furniture already created with this flow will retain their sequence.')) {
      window.Zoosh.State.deleteFlowType(flowId);
    }
  }
};
