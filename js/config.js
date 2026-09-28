/**
 * Zoosh Production Scheduling System Configuration
 * Modern Factory Control Room
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.Config = {
  APP_NAME: 'ZOOSH PRODUCTION',
  SUBTITLE: 'Factory Control Room',
  VERSION: '1.0.0',
  STORAGE_KEY: 'ZOOSH_PRODUCTION_V1_STORE',
  
  // Base factory calendar settings
  CURRENT_DATE: '2026-09-28', // Monday, 28 September 2026
  STANDARD_WORK_HOURS_PER_DAY: 8,
  WORK_DAY_START_HOUR: 9,   // 09:00 AM
  WORK_DAY_END_HOUR: 17,    // 05:00 PM
  NON_WORKING_DAYS: [0],     // 0 = Sunday (skipped during schedule calculation)

  // Deadline threshold margins (in calendar days)
  DEADLINE_AT_RISK_MARGIN_DAYS: 2,

  // Department metadata and consistent color tokens
  DEPARTMENTS: {
    Carpentry: {
      name: 'Carpentry',
      color: '#10b981',       // Emerald Green
      bg: '#ecfdf5',
      border: '#a7f3d0',
      text: '#065f46',
      badgeClass: 'badge-carpentry',
      barClass: 'gantt-bar-carpentry'
    },
    Polish: {
      name: 'Polish',
      color: '#f59e0b',       // Amber Orange
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#92400e',
      badgeClass: 'badge-polish',
      barClass: 'gantt-bar-polish'
    },
    Upholstery: {
      name: 'Upholstery',
      color: '#3b82f6',       // Royal Blue
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      badgeClass: 'badge-upholstery',
      barClass: 'gantt-bar-upholstery'
    },
    Metal: {
      name: 'Metal',
      color: '#64748b',       // Steel Grey
      bg: '#f8fafc',
      border: '#cbd5e1',
      text: '#334155',
      badgeClass: 'badge-metal',
      barClass: 'gantt-bar-metal'
    },
    Turning: {
      name: 'Turning',
      color: '#8b5cf6',       // Purple
      bg: '#f5f3ff',
      border: '#ddd6fe',
      text: '#5b21b6',
      badgeClass: 'badge-turning',
      barClass: 'gantt-bar-turning'
    }
  }
};
