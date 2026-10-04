/**
 * Realistic Demo Data for Zoosh Furniture Manufacturing
 * Date baseline: 28 September 2026
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
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.DemoData = {
  getInitialState() {
    // 1. Employees (14 Active Craftspeople: 8 Carpenter, 2 Upholstery, 4 Polishing)
    const employees = [
      // 8 Carpenters
      {
        id: 'emp_rajan',
        name: 'Rajan',
        department: 'Carpentry',
        secondaryDepartments: [],
        joiningDate: '2021-03-15',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#10b981'
      },
      {
        id: 'emp_satheesh',
        name: 'Satheesh',
        department: 'Carpentry',
        secondaryDepartments: [],
        joiningDate: '2019-06-10',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: false,
        avatarColor: '#059669'
      },
      {
        id: 'emp_santhosh',
        name: 'Santhosh',
        department: 'Carpentry',
        secondaryDepartments: ['Turning'],
        joiningDate: '2022-01-20',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#34d399'
      },
      {
        id: 'emp_sasi',
        name: 'Sasi',
        department: 'Carpentry',
        secondaryDepartments: ['Turning', 'Metal'],
        joiningDate: '2020-11-05',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#6ee7b7'
      },
      {
        id: 'emp_manikandan',
        name: 'Manikandan',
        department: 'Carpentry',
        secondaryDepartments: [],
        joiningDate: '2023-08-01',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: false,
        avatarColor: '#10b981'
      },
      {
        id: 'emp_vijayan',
        name: 'Vijayan',
        department: 'Carpentry',
        secondaryDepartments: [],
        joiningDate: '2021-11-12',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#059669'
      },
      {
        id: 'emp_babu',
        name: 'Babu',
        department: 'Carpentry',
        secondaryDepartments: [],
        joiningDate: '2022-05-18',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: false,
        avatarColor: '#34d399'
      },
      {
        id: 'emp_anand',
        name: 'Anand',
        department: 'Carpentry',
        secondaryDepartments: [],
        joiningDate: '2023-02-01',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#10b981'
      },

      // 2 Upholstery
      {
        id: 'emp_saddique',
        name: 'Saddique',
        department: 'Upholstery',
        secondaryDepartments: [],
        joiningDate: '2021-09-01',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#3b82f6'
      },
      {
        id: 'emp_faizal',
        name: 'Faizal',
        department: 'Upholstery',
        secondaryDepartments: [],
        joiningDate: '2022-04-10',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#2563eb'
      },

      // 4 Polishing
      {
        id: 'emp_rajesh',
        name: 'Rajesh',
        department: 'Polish',
        secondaryDepartments: [],
        joiningDate: '2020-02-14',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#f59e0b'
      },
      {
        id: 'emp_shaji',
        name: 'Shaji',
        department: 'Polish',
        secondaryDepartments: [],
        joiningDate: '2021-07-22',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#d97706'
      },
      {
        id: 'emp_pradeep',
        name: 'Pradeep',
        department: 'Polish',
        secondaryDepartments: [],
        joiningDate: '2022-08-15',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: false,
        avatarColor: '#b45309'
      },
      {
        id: 'emp_murali',
        name: 'Murali',
        department: 'Polish',
        secondaryDepartments: [],
        joiningDate: '2023-01-10',
        active: true,
        standardHoursPerDay: 8,
        overtimeAvailable: true,
        avatarColor: '#f59e0b'
      }
    ];

    // 2. Process Flow Types
    const flowTypes = [
      {
        id: 'flow_type_1',
        code: 'TYPE 1',
        name: 'Carpentry → Polish → Carpentry',
        description: 'Standard wooden furniture with final hardware fittings',
        steps: ['Carpentry', 'Polish', 'Carpentry']
      },
      {
        id: 'flow_type_2',
        code: 'TYPE 2',
        name: 'Carpentry → Polish → Upholstery',
        description: 'Sofas, cushioned dining chairs, and upholstered headboards',
        steps: ['Carpentry', 'Polish', 'Upholstery']
      },
      {
        id: 'flow_type_3',
        code: 'TYPE 3',
        name: 'Metal → Carpentry → Polish',
        description: 'Industrial style furniture with steel subframes and wood tops',
        steps: ['Metal', 'Carpentry', 'Polish']
      },
      {
        id: 'flow_type_4',
        code: 'TYPE 4',
        name: 'Carpentry → Upholstery → Polish',
        description: 'Deep padded lounge chairs with exposed polished legs',
        steps: ['Carpentry', 'Upholstery', 'Polish']
      },
      {
        id: 'flow_type_5',
        code: 'TYPE 5',
        name: 'Turning → Carpentry → Polish',
        description: 'Classical round turned leg tables and four-poster beds',
        steps: ['Turning', 'Carpentry', 'Polish']
      }
    ];

    // 3. Clients (SRL belongs to Client)
    const clients = [
      {
        id: 'client_sreelal',
        srl: 101,
        name: 'Sreelal',
        location: 'Calicut',
        phone: '+91 98470 12345',
        notes: 'Luxury villa interior client'
      },
      {
        id: 'client_rajeev',
        srl: 102,
        name: 'Rajeev Babu',
        location: 'Bangalore',
        phone: '+91 98471 23456',
        notes: 'Penthouse custom furnishing project'
      },
      {
        id: 'client_swalih',
        srl: 103,
        name: 'Swalih',
        location: 'Pattambi',
        phone: '+91 98472 34567',
        notes: 'Traditional teak residence'
      },
      {
        id: 'client_pranav',
        srl: 104,
        name: 'Pranav',
        location: 'Kunnamkulam',
        phone: '+91 98473 45678',
        notes: 'Commercial corporate office suites'
      }
    ];

    // 4. Projects (Belongs to Client / SRL)
    const projects = [
      {
        id: 'proj_sreelal',
        clientId: 'client_sreelal',
        clientSrl: 101,
        clientName: 'Sreelal',
        name: 'Sreelal',
        location: 'Calicut',
        confirmedDate: '2026-09-12',
        deliveryDeadline: '2026-10-06',
        notes: 'High priority luxury villa interior project. Strict delivery deadline before housewarming.',
        furnitureIds: ['furn_101'],
        srlIds: ['furn_101'],
        isDelivered: false
      },
      {
        id: 'proj_rajeev',
        clientId: 'client_rajeev',
        clientSrl: 102,
        clientName: 'Rajeev Babu',
        name: 'Rajeev Babu',
        location: 'Bangalore',
        confirmedDate: '2026-09-15',
        deliveryDeadline: '2026-10-20',
        notes: 'Living room custom sofa set with premium Italian velvet upholstery.',
        furnitureIds: ['furn_102'],
        srlIds: ['furn_102'],
        isDelivered: false
      },
      {
        id: 'proj_swalih',
        clientId: 'client_swalih',
        clientSrl: 103,
        clientName: 'Swalih',
        name: 'Swalih',
        location: 'Pattambi',
        confirmedDate: '2026-09-18',
        deliveryDeadline: '2026-10-25',
        notes: 'Master suite teak wardrobe & classical four-poster bed.',
        furnitureIds: ['furn_103'],
        srlIds: ['furn_103'],
        isDelivered: false
      },
      {
        id: 'proj_pranav',
        clientId: 'client_pranav',
        clientSrl: 104,
        clientName: 'Pranav',
        name: 'Pranav',
        location: 'Kunnamkulam',
        confirmedDate: '2026-09-05',
        deliveryDeadline: '2026-09-27',
        notes: 'Executive cabin walnut desk, conference credenza & storage cabinet.',
        furnitureIds: ['furn_104'],
        srlIds: ['furn_104'],
        isDelivered: false
      }
    ];

    // 5. Furniture Items (Belong to Project. NO SRL number property!)
    const furniture = [
      {
        id: 'furn_101',
        projectId: 'proj_sreelal',
        name: 'Dining Table & Chairs Suite',
        furnitureName: 'Dining Table & Chairs Suite',
        flowTypeId: 'flow_type_2',
        startDate: '2026-09-26',
        status: 'IN_PROGRESS',
        processIds: ['proc_101_1', 'proc_101_2', 'proc_101_3']
      },
      {
        id: 'furn_102',
        projectId: 'proj_rajeev',
        name: 'L-Shape Sectional Sofa',
        furnitureName: 'L-Shape Sectional Sofa',
        flowTypeId: 'flow_type_2',
        startDate: '2026-09-26',
        status: 'IN_PROGRESS',
        processIds: ['proc_102_1', 'proc_102_2', 'proc_102_3']
      },
      {
        id: 'furn_103',
        projectId: 'proj_swalih',
        name: 'Master Suite Teak Wardrobe',
        furnitureName: 'Master Suite Teak Wardrobe',
        flowTypeId: 'flow_type_1',
        startDate: '2026-10-01',
        status: 'IN_PROGRESS',
        processIds: ['proc_103_1', 'proc_103_2', 'proc_103_3']
      },
      {
        id: 'furn_104',
        projectId: 'proj_pranav',
        name: 'Executive Walnut Desk',
        furnitureName: 'Executive Walnut Desk',
        flowTypeId: 'flow_type_1',
        startDate: '2026-09-20',
        status: 'COMPLETED',
        processIds: ['proc_104_1', 'proc_104_2', 'proc_104_3']
      }
    ];

    // 6. Processes (Production sub-tasks belonging to Furniture)
    // Manpower-weighted progress calculation:
    // Sreelal: Carpentry (5, done) + Polish (2, done) + Upholstery (3, active today) = 10 units, 7 completed = 70%
    // Rajeev Babu: Carpentry (4, 50% done = 2 units, active today) + Polish (3) + Upholstery (3) = 10 units, 2 completed = 20%
    // Swalih: Carpentry (7, done) + Polish (7, starts 1 Oct) + Carpentry (6) = 20 units, 7 completed = 35% (Non Active today)
    // Pranav: Carpentry (4, done) + Polish (4, done) + Carpentry (2, done) = 10 units, 10 completed = 100% (Completed)
    const processes = [
      // Sreelal - Dining Table Suite (Total manpower: 10, completed: 7 -> 70%)
      {
        id: 'proc_101_1',
        furnitureId: 'furn_101',
        srlId: 'furn_101',
        projectId: 'proj_sreelal',
        sequence: 1,
        department: 'Carpentry',
        employeeId: 'emp_rajan',
        manpower: 5,
        durationDays: 3,
        status: 'COMPLETED',
        progressPercent: 100,
        notes: 'Solid teak table top joinery & apron'
      },
      {
        id: 'proc_101_2',
        furnitureId: 'furn_101',
        srlId: 'furn_101',
        projectId: 'proj_sreelal',
        sequence: 2,
        department: 'Polish',
        employeeId: 'emp_rajesh',
        manpower: 2,
        durationDays: 2,
        status: 'COMPLETED',
        progressPercent: 100,
        notes: 'Natural PU matt lacquer finish'
      },
      {
        id: 'proc_101_3',
        furnitureId: 'furn_101',
        srlId: 'furn_101',
        projectId: 'proj_sreelal',
        sequence: 3,
        department: 'Upholstery',
        employeeId: 'emp_saddique',
        manpower: 3,
        durationDays: 2,
        status: 'IN_PROGRESS',
        progressPercent: 0,
        notes: 'High density foam & leatherette seats'
      },

      // Rajeev Babu - Sectional Sofa (Total manpower: 10, completed: 2 -> 20%)
      {
        id: 'proc_102_1',
        furnitureId: 'furn_102',
        srlId: 'furn_102',
        projectId: 'proj_rajeev',
        sequence: 1,
        department: 'Carpentry',
        employeeId: 'emp_satheesh',
        manpower: 4,
        durationDays: 3,
        status: 'IN_PROGRESS',
        progressPercent: 50, // 50% of 4 = 2 completed units
        notes: 'Hardwood frame & webbed spring base'
      },
      {
        id: 'proc_102_2',
        furnitureId: 'furn_102',
        srlId: 'furn_102',
        projectId: 'proj_rajeev',
        sequence: 2,
        department: 'Polish',
        employeeId: 'emp_shaji',
        manpower: 3,
        durationDays: 2,
        status: 'PENDING',
        progressPercent: 0,
        notes: 'Exposed teak base frame buffing'
      },
      {
        id: 'proc_102_3',
        furnitureId: 'furn_102',
        srlId: 'furn_102',
        projectId: 'proj_rajeev',
        sequence: 3,
        department: 'Upholstery',
        employeeId: 'emp_faizal',
        manpower: 3,
        durationDays: 2,
        status: 'PENDING',
        progressPercent: 0,
        notes: 'Deep tufted cushions and arm padding'
      },

      // Swalih - Teak Wardrobe (Total manpower: 20, completed: 7 -> 35%)
      {
        id: 'proc_103_1',
        furnitureId: 'furn_103',
        srlId: 'furn_103',
        projectId: 'proj_swalih',
        sequence: 1,
        department: 'Carpentry',
        employeeId: 'emp_santhosh',
        manpower: 7,
        durationDays: 3,
        status: 'COMPLETED',
        progressPercent: 100,
        notes: 'Carcass joinery and shutter mortising'
      },
      {
        id: 'proc_103_2',
        furnitureId: 'furn_103',
        srlId: 'furn_103',
        projectId: 'proj_swalih',
        sequence: 2,
        department: 'Polish',
        employeeId: 'emp_pradeep',
        manpower: 7,
        durationDays: 3,
        status: 'PENDING',
        progressPercent: 0,
        notes: 'Hand rubbed walnut stain & sealer'
      },
      {
        id: 'proc_103_3',
        furnitureId: 'furn_103',
        srlId: 'furn_103',
        projectId: 'proj_swalih',
        sequence: 3,
        department: 'Carpentry',
        employeeId: 'emp_manikandan',
        manpower: 6,
        durationDays: 2,
        status: 'PENDING',
        progressPercent: 0,
        notes: 'Internal soft-close hardware & handles'
      },

      // Pranav - Executive Desk (Total manpower: 10, completed: 10 -> 100%)
      {
        id: 'proc_104_1',
        furnitureId: 'furn_104',
        srlId: 'furn_104',
        projectId: 'proj_pranav',
        sequence: 1,
        department: 'Carpentry',
        employeeId: 'emp_sasi',
        manpower: 4,
        durationDays: 2,
        status: 'COMPLETED',
        progressPercent: 100,
        notes: 'Solid walnut executive desk frame'
      },
      {
        id: 'proc_104_2',
        furnitureId: 'furn_104',
        srlId: 'furn_104',
        projectId: 'proj_pranav',
        sequence: 2,
        department: 'Polish',
        employeeId: 'emp_murali',
        manpower: 4,
        durationDays: 2,
        status: 'COMPLETED',
        progressPercent: 100,
        notes: 'Clear satin polyurethane coat'
      },
      {
        id: 'proc_104_3',
        furnitureId: 'furn_104',
        srlId: 'furn_104',
        projectId: 'proj_pranav',
        sequence: 3,
        department: 'Carpentry',
        employeeId: 'emp_vijayan',
        manpower: 2,
        durationDays: 1,
        status: 'COMPLETED',
        progressPercent: 100,
        notes: 'Cable grommets & brass drawer pulls'
      }
    ];

    // 7. Manpower Records (Leaves, Overtime, Capacity)
    const manpowerRecords = [
      {
        id: 'leave_rajan_1',
        employeeId: 'emp_rajan',
        action: 'LEAVE',
        fromDate: '2026-09-29',
        tillDate: '2026-09-30',
        status: 'APPROVED',
        notes: 'Family function in hometown (2 days approved leave)'
      },
      {
        id: 'overtime_rajesh_1',
        employeeId: 'emp_rajesh',
        action: 'OVERTIME',
        fromDate: '2026-10-01',
        tillDate: '2026-10-03',
        status: 'APPROVED',
        notes: 'Authorized +2 hours daily overtime to clear Polish backlog'
      }
    ];

    // 8. Operational Reminders (Based on Production Schedule)
    const reminders = [
      {
        id: 'rem_1',
        title: 'Issue PO for German Soft-Close Drawer Channels',
        type: 'Purchase Order Follow-up',
        date: '2026-09-28',
        projectId: 'proj_sreelal',
        projectName: 'Sreelal - Calicut',
        status: 'PENDING',
        priority: 'HIGH',
        notes: 'Requires approval for Blum Tandembox runners'
      },
      {
        id: 'rem_2',
        title: 'Verify Fabric Dispatch with Bangalore Textile Mills',
        type: 'Purchase Order Follow-up',
        date: '2026-09-28',
        projectId: 'proj_rajeev',
        projectName: 'Rajeev Babu - Bangalore',
        status: 'PENDING',
        priority: 'MEDIUM',
        notes: 'Invoice #TM-8941 for Italian velvet'
      },
      {
        id: 'rem_3',
        title: 'Final inspection call with Architect before dispatch',
        type: 'Deadline Follow-up',
        date: '2026-09-28',
        projectId: 'proj_sreelal',
        projectName: 'Sreelal - Calicut',
        status: 'PENDING',
        priority: 'HIGH',
        notes: 'Verify polish sheen and hardware fit'
      },
      {
        id: 'rem_4',
        title: 'Send CNC carved panels to Perinthalmanna Job Work Unit',
        type: 'Job Work Sending',
        date: '2026-09-28',
        projectId: 'proj_swalih',
        projectName: 'Swalih - Pattambi',
        status: 'PENDING',
        priority: 'HIGH',
        notes: 'Intricate floral relief carving for wardrobe shutter inserts'
      }
    ];

    return {
      currentDate: '2026-09-28',
      lastDataUpdatedAt: '2026-09-02T19:45:00.000Z',
      employees,
      flowTypes,
      clients,
      projects,
      furniture,
      srls: furniture, // alias for zero-disruption backwards compatibility
      processes,
      manpowerRecords,
      reminders
    };
  }
};
