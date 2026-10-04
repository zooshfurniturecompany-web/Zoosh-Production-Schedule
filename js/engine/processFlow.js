/**
 * Zoosh Process Flow Engine
 * 
 * Manages production process flow models, dependency graphs,
 * parallel branches, critical path duration calculations,
 * validation, and visual two-lane flow rendering.
 * 
 * Architecture:
 * ITEM → PROCESS FLOW → PRODUCTION SCHEDULE → PRODUCTION MONITOR → ACTUAL COMPLETION → OVERVIEW
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.ProcessFlow = {
  // Allowed departments
  DEPARTMENTS: ['Carpentry', 'Upholstery', 'Polish', 'Metal', 'Turning'],

  // Department colors matching visual language and uploaded mockup
  DEPT_STYLES: {
    Carpentry: {
      name: 'Carpentry',
      bg: '#dcfce7',
      border: '#22c55e',
      text: '#166534',
      badgeClass: 'badge-carpentry'
    },
    Polish: {
      name: 'Polish',
      bg: '#fce7f3',
      border: '#ec4899',
      text: '#9d174d',
      badgeClass: 'badge-polish'
    },
    Upholstery: {
      name: 'Upholstery',
      bg: '#fef9c3',
      border: '#eab308',
      text: '#854d0e',
      badgeClass: 'badge-upholstery'
    },
    Metal: {
      name: 'Metal',
      bg: '#e2e8f0',
      border: '#64748b',
      text: '#334155',
      badgeClass: 'badge-metal'
    },
    Turning: {
      name: 'Turning',
      bg: '#ffedd5',
      border: '#f97316',
      text: '#9a3412',
      badgeClass: 'badge-turning'
    }
  },

  /**
   * The 12 Standard Factory Flow Presets (matching uploaded Quick Flow Order diagram)
   */
  PRESETS: [
    {
      id: 'preset_1',
      code: 'TYPE 1',
      name: 'Carpentry',
      description: 'Single-stage solid wood crafting',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 4, relationType: 'START', dependencyTempIds: [] }
      ]
    },
    {
      id: 'preset_2',
      code: 'TYPE 2',
      name: 'Upholstery',
      description: 'Cushions and direct soft-furnishing build',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Upholstery', lane: 1, durationDays: 3, relationType: 'START', dependencyTempIds: [] }
      ]
    },
    {
      id: 'preset_3',
      code: 'TYPE 3',
      name: 'Carpentry → Polish',
      description: 'Standard finished wooden casework and tables',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 4, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Polish', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n1'] }
      ]
    },
    {
      id: 'preset_4',
      code: 'TYPE 4',
      name: 'Carpentry → Upholstery',
      description: 'Unfinished wooden frame with full fabric upholstery',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 4, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Upholstery', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n1'] }
      ]
    },
    {
      id: 'preset_5',
      code: 'TYPE 5',
      name: 'Carpentry → Polish (Parallel Upholstery)',
      description: 'Carpentry with simultaneous polishing and upholstery operations',
      lanesCount: 2,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 4, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Polish', lane: 1, durationDays: 2.5, relationType: 'AFTER', dependencyTempIds: ['n1'] },
        { tempId: 'n3', department: 'Upholstery', lane: 2, durationDays: 1.25, relationType: 'PARALLEL', dependencyTempIds: ['n1'], parallelWithId: 'n2' }
      ]
    },
    {
      id: 'preset_6',
      code: 'TYPE 6',
      name: 'Carpentry → Polish → Upholstery',
      description: 'Polished wooden frames fitted with padded upholstery',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 4, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Polish', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n1'] },
        { tempId: 'n3', department: 'Upholstery', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n2'] }
      ]
    },
    {
      id: 'preset_7',
      code: 'TYPE 7',
      name: 'Carpentry → Upholstery → Carpentry',
      description: 'Carpentry framing followed by upholstery and final wood assembly',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 3, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Upholstery', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n1'] },
        { tempId: 'n3', department: 'Carpentry', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n2'] }
      ]
    },
    {
      id: 'preset_8',
      code: 'TYPE 8',
      name: 'Carpentry → Polish → Carpentry (Parallel Upholstery)',
      description: 'Full luxury suite: parallel Polish & Upholstery after Carpentry, followed by final joinery assembly',
      lanesCount: 2,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 4, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Polish', lane: 1, durationDays: 2.5, relationType: 'AFTER', dependencyTempIds: ['n1'] },
        { tempId: 'n3', department: 'Upholstery', lane: 2, durationDays: 1.25, relationType: 'PARALLEL', dependencyTempIds: ['n1'], parallelWithId: 'n2' },
        { tempId: 'n4', department: 'Carpentry', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n2', 'n3'] }
      ]
    },
    {
      id: 'preset_9',
      code: 'TYPE 9',
      name: 'Carpentry → Polish → Carpentry (Parallel Turning)',
      description: 'Carpentry and Turning legs prepared concurrently before polishing and assembly',
      lanesCount: 2,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 3, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Turning', lane: 2, durationDays: 1.5, relationType: 'PARALLEL', dependencyTempIds: [], parallelWithId: 'n1' },
        { tempId: 'n3', department: 'Polish', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n1', 'n2'] },
        { tempId: 'n4', department: 'Carpentry', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n3'] }
      ]
    },
    {
      id: 'preset_10',
      code: 'TYPE 10',
      name: 'Turning → Carpentry → Upholstery (Parallel Polish)',
      description: 'Turned elements into carpentry, with parallel upholstery & polishing finishing',
      lanesCount: 2,
      nodes: [
        { tempId: 'n1', department: 'Turning', lane: 1, durationDays: 2, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Carpentry', lane: 1, durationDays: 3, relationType: 'AFTER', dependencyTempIds: ['n1'] },
        { tempId: 'n3', department: 'Upholstery', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n2'] },
        { tempId: 'n4', department: 'Polish', lane: 2, durationDays: 1.5, relationType: 'PARALLEL', dependencyTempIds: ['n2'], parallelWithId: 'n3' }
      ]
    },
    {
      id: 'preset_11',
      code: 'TYPE 11',
      name: 'Carpentry → Metal → Polish',
      description: 'Wood framing integrated with fabricated metal structure and lacquer finish',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Carpentry', lane: 1, durationDays: 3, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Metal', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n1'] },
        { tempId: 'n3', department: 'Polish', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n2'] }
      ]
    },
    {
      id: 'preset_12',
      code: 'TYPE 12',
      name: 'Metal → Carpentry → Polish → Upholstery',
      description: 'Steel framework with wooden joinery, polished components and cushioned seating',
      lanesCount: 1,
      nodes: [
        { tempId: 'n1', department: 'Metal', lane: 1, durationDays: 2, relationType: 'START', dependencyTempIds: [] },
        { tempId: 'n2', department: 'Carpentry', lane: 1, durationDays: 3, relationType: 'AFTER', dependencyTempIds: ['n1'] },
        { tempId: 'n3', department: 'Polish', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n2'] },
        { tempId: 'n4', department: 'Upholstery', lane: 1, durationDays: 2, relationType: 'AFTER', dependencyTempIds: ['n3'] }
      ]
    }
  ],

  /**
   * Validate working day duration.
   * Allowed increments: 0.25 day (e.g. 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2 etc.)
   * Minimum: 0.25 day.
   */
  isValidDuration(dur) {
    const num = parseFloat(dur);
    if (isNaN(num) || num < 0.25) return false;
    // Check if remainder modulo 0.25 is zero (floating point safe)
    const remainder = Math.round((num % 0.25) * 1000) / 1000;
    return remainder === 0 || Math.abs(remainder - 0.25) < 0.001 || remainder < 0.001;
  },

  /**
   * Calculate Total Process Workload & Critical Flow Duration
   * - Total Process Workload = sum of all process durations
   * - Critical Flow Duration = max path through dependency DAG
   */
  calculateDurations(nodes) {
    if (!nodes || nodes.length === 0) {
      return { totalWorkload: 0, criticalDuration: 0, nodeOffsets: new Map() };
    }

    let totalWorkload = 0;
    nodes.forEach(n => {
      totalWorkload += parseFloat(n.durationDays) || 0;
    });

    const nodeOffsets = new Map(); // id -> { start: number, end: number }
    const nodeMap = new Map(nodes.map(n => [n.tempId || n.id, n]));

    // Topological order computation
    const inDegree = new Map();
    const adjList = new Map();
    nodes.forEach(n => {
      const id = n.tempId || n.id;
      inDegree.set(id, 0);
      adjList.set(id, []);
    });

    nodes.forEach(n => {
      const id = n.tempId || n.id;
      const deps = n.dependencyTempIds || n.dependencyIds || [];
      inDegree.set(id, deps.length);
      deps.forEach(depId => {
        if (adjList.has(depId)) {
          adjList.get(depId).push(id);
        }
      });
    });

    const queue = nodes.filter(n => (inDegree.get(n.tempId || n.id) || 0) === 0);
    const sorted = [];

    while (queue.length > 0) {
      const curr = queue.shift();
      const currId = curr.tempId || curr.id;
      sorted.push(curr);

      const neighbors = adjList.get(currId) || [];
      neighbors.forEach(nId => {
        inDegree.set(nId, inDegree.get(nId) - 1);
        if (inDegree.get(nId) === 0) {
          const nNode = nodeMap.get(nId);
          if (nNode) queue.push(nNode);
        }
      });
    }

    // Fallback: if cycle or unvisited, append remaining
    nodes.forEach(n => {
      if (!sorted.includes(n)) sorted.push(n);
    });

    // Compute start and end offsets
    sorted.forEach((n, idx) => {
      const id = n.tempId || n.id;
      const dur = parseFloat(n.durationDays) || 0;
      const deps = n.dependencyTempIds || n.dependencyIds || [];

      let maxPredEnd = 0;
      if (deps.length > 0) {
        deps.forEach(depId => {
          const pred = nodeOffsets.get(depId);
          if (pred && pred.end > maxPredEnd) {
            maxPredEnd = pred.end;
          }
        });
      } else if (idx > 0 && n.relationType !== 'PARALLEL' && n.relationType !== 'START' && n.lane !== 2) {
        // Sequential fallback
        const prev = sorted[idx - 1];
        const prevOffset = nodeOffsets.get(prev.tempId || prev.id);
        if (prevOffset) maxPredEnd = prevOffset.end;
      }

      nodeOffsets.set(id, {
        start: maxPredEnd,
        end: maxPredEnd + dur,
        duration: dur
      });
    });

    let criticalDuration = 0;
    nodeOffsets.forEach(val => {
      if (val.end > criticalDuration) criticalDuration = val.end;
    });

    return {
      totalWorkload: Math.round(totalWorkload * 100) / 100,
      criticalDuration: Math.round(criticalDuration * 100) / 100,
      nodeOffsets
    };
  },

  /**
   * Validate entire Process Flow before Apply / Save
   */
  validate(nodes) {
    if (!nodes || nodes.length === 0) {
      return { valid: false, error: 'Process flow must contain at least one production stage.' };
    }

    const nodeIds = new Set(nodes.map(n => n.tempId || n.id));

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const name = n.department || `Stage ${i + 1}`;

      if (!this.DEPARTMENTS.includes(n.department)) {
        return { valid: false, error: `Invalid department "${n.department}" for stage ${i + 1}.` };
      }

      if (!this.isValidDuration(n.durationDays)) {
        return {
          valid: false,
          error: `Duration for ${name} (${n.durationDays}d) is invalid. Must be in increments of 0.25 working days (e.g. 0.25, 0.5, 0.75, 1, 1.25, etc.) and at least 0.25.`
        };
      }

      // Check self-dependency
      const deps = n.dependencyTempIds || n.dependencyIds || [];
      const id = n.tempId || n.id;
      if (deps.includes(id)) {
        return { valid: false, error: `${name} cannot depend on itself.` };
      }

      // Check dependency existence
      for (const d of deps) {
        if (!nodeIds.has(d)) {
          return { valid: false, error: `${name} has an invalid dependency reference.` };
        }
      }
    }

    // Check for circular dependencies via Kahn's algorithm
    const inDegree = new Map();
    const adjList = new Map();
    nodes.forEach(n => {
      const id = n.tempId || n.id;
      inDegree.set(id, 0);
      adjList.set(id, []);
    });

    nodes.forEach(n => {
      const id = n.tempId || n.id;
      const deps = n.dependencyTempIds || n.dependencyIds || [];
      inDegree.set(id, deps.length);
      deps.forEach(depId => {
        if (adjList.has(depId)) {
          adjList.get(depId).push(id);
        }
      });
    });

    let visitedCount = 0;
    const queue = nodes.filter(n => (inDegree.get(n.tempId || n.id) || 0) === 0);

    while (queue.length > 0) {
      const curr = queue.shift();
      visitedCount++;
      const neighbors = adjList.get(curr.tempId || curr.id) || [];
      neighbors.forEach(nId => {
        inDegree.set(nId, inDegree.get(nId) - 1);
        if (inDegree.get(nId) === 0) {
          const nNode = nodes.find(n => (n.tempId || n.id) === nId);
          if (nNode) queue.push(nNode);
        }
      });
    }

    if (visitedCount < nodes.length) {
      return { valid: false, error: 'Circular dependency detected in the process flow order.' };
    }

    return { valid: true, error: null };
  },

  /**
   * Render Two-Lane Visual Flow Chart
   * Supports both compact table mode and full detail card mode.
   * 
   * @param {Array<Object>} nodes Array of process nodes
   * @param {Object} [options] { compact: boolean, showLabels: boolean, showEmployees: boolean }
   * @returns {string} HTML markup
   */
  renderTwoLaneFlowHtml(nodes, options = {}) {
    if (!nodes || nodes.length === 0) {
      return `<div style="font-size: 11.5px; color: var(--text-muted); font-style: italic;">No process flow defined</div>`;
    }

    const { compact = false, showLabels = true, showEmployees = false } = options;
    const { criticalDuration, nodeOffsets } = this.calculateDurations(nodes);
    const totalSpan = Math.max(criticalDuration, 0.5);

    // Group nodes into Lane 1 (Sequential) and Lane 2 (Parallel)
    const lane1Nodes = nodes.filter(n => (n.lane || 1) === 1);
    const lane2Nodes = nodes.filter(n => n.lane === 2);

    const hasLane2 = lane2Nodes.length > 0;
    const rowHeight = compact ? 24 : 32;

    const renderBlock = (n) => {
      const id = n.tempId || n.id;
      const offset = nodeOffsets.get(id) || { start: 0, end: n.durationDays, duration: n.durationDays };
      const leftPct = (offset.start / totalSpan) * 100;
      const widthPct = Math.max((offset.duration / totalSpan) * 100, 4); // min 4% for visibility

      const deptStyle = this.DEPT_STYLES[n.department] || {
        bg: '#f1f5f9',
        border: '#94a3b8',
        text: '#1e293b'
      };

      const durationStr = `${n.durationDays}D`;
      const empName = n.employeeName ? ` &bull; ${n.employeeName}` : '';
      const label = showEmployees && n.employeeName ? `${n.department} (${durationStr})${empName}` : `${n.department} (${durationStr})`;

      return `
        <div 
          class="flow-two-lane-block"
          style="
            position: absolute;
            left: ${leftPct}%;
            width: ${widthPct}%;
            top: 0;
            bottom: 0;
            background: ${deptStyle.bg};
            border: 1.5px solid ${deptStyle.border};
            color: ${deptStyle.text};
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 4px;
            font-size: ${compact ? '10px' : '11.5px'};
            font-weight: 700;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: 0 1px 2px rgba(0,0,0,0.04);
            box-sizing: border-box;
            z-index: 2;
          "
          title="${n.department}: ${n.durationDays} working days${n.employeeName ? ' (' + n.employeeName + ')' : ''}"
        >
          ${showLabels ? label : n.department}
        </div>
      `;
    };

    return `
      <div 
        class="flow-two-lane-container ${compact ? 'flow-compact' : ''}" 
        style="
          position: relative;
          width: 100%;
          min-width: ${compact ? '220px' : '300px'};
          background: #ffffff;
          border: 1px solid var(--border-light, #e2e8f0);
          border-radius: 6px;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-sizing: border-box;
        "
      >
        <!-- Lane 1: Primary Flow -->
        <div 
          class="flow-two-lane-row lane-1" 
          style="
            position: relative;
            height: ${rowHeight}px;
            width: 100%;
            background: #f8fafc;
            border-radius: 4px;
            border: 1px dashed #e2e8f0;
          "
        >
          ${lane1Nodes.map(renderBlock).join('')}
        </div>

        <!-- Lane 2: Parallel Flow (rendered if present or placeholder) -->
        ${hasLane2 ? `
          <div 
            class="flow-two-lane-row lane-2" 
            style="
              position: relative;
              height: ${rowHeight}px;
              width: 100%;
              background: #fdfefe;
              border-radius: 4px;
              border: 1px dashed #e2e8f0;
            "
          >
            ${lane2Nodes.map(renderBlock).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Clone a preset with freshly suggested employees from Allocator
   */
  instantiatePreset(presetId, startDateStr) {
    const preset = this.PRESETS.find(p => p.id === presetId) || this.PRESETS[0];
    const startDate = startDateStr || (window.Zoosh.Config && window.Zoosh.Config.CURRENT_DATE);

    const nodes = preset.nodes.map((n, idx) => {
      let suggestedEmp = null;
      if (window.Zoosh.Allocator) {
        const suggestion = window.Zoosh.Allocator.suggestEmployee(n.department, startDate, n.durationDays);
        suggestedEmp = suggestion ? suggestion.suggestedEmployee : null;
      }

      return {
        tempId: n.tempId || `node_${idx + 1}`,
        sequence: idx + 1,
        department: n.department,
        lane: n.lane || 1,
        durationDays: n.durationDays,
        employeeId: suggestedEmp ? suggestedEmp.id : '',
        employeeName: suggestedEmp ? suggestedEmp.name : '',
        relationType: n.relationType || (idx === 0 ? 'START' : 'AFTER'),
        dependencyTempIds: [...(n.dependencyTempIds || [])],
        parallelWithId: n.parallelWithId || null,
        notes: ''
      };
    });

    return {
      presetId: preset.id,
      presetName: preset.name,
      source: 'PRESET',
      nodes: nodes
    };
  }
};
