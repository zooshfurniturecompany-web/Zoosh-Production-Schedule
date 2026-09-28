/**
 * Realistic Demo Data for Zoosh Furniture Manufacturing
 * Date baseline: 28 September 2026
 */
window.Zoosh = window.Zoosh || {};

window.Zoosh.DemoData = {
  getInitialState() {
    return {
      currentDate: '2026-09-28',
      
      // Employees
      employees: [
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
          id: 'emp_saddique',
          name: 'Saddique',
          department: 'Upholstery',
          secondaryDepartments: [],
          joiningDate: '2021-09-01',
          active: true,
          standardHoursPerDay: 8,
          overtimeAvailable: true,
          avatarColor: '#3b82f6'
        }
      ],

      // Process Flow Types
      flowTypes: [
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
      ],

      // Projects
      projects: [
        {
          id: 'proj_sreelal',
          name: 'Sreelal - Calicut',
          clientName: 'Sreelal',
          location: 'Calicut',
          confirmedDate: '2026-09-12',
          deliveryDeadline: '2026-10-06', // Tight deadline -> triggers AT RISK / alert
          notes: 'High priority luxury villa interior project. Strict delivery deadline before housewarming.',
          srlIds: ['srl_101', 'srl_102', 'srl_103']
        },
        {
          id: 'proj_hafeez',
          name: 'Villa Hafeez - Kochi',
          clientName: 'Hafeez',
          location: 'Kochi',
          confirmedDate: '2026-09-08',
          deliveryDeadline: '2026-10-20',
          notes: 'Living room and master suite custom walnut furniture.',
          srlIds: ['srl_104', 'srl_105']
        },
        {
          id: 'proj_resort',
          name: 'Wayanad Eco Resort',
          clientName: 'Wayanad Hospitality',
          location: 'Wayanad',
          confirmedDate: '2026-09-18',
          deliveryDeadline: '2026-10-28',
          notes: 'Cottage bedroom furniture & teak balconies.',
          srlIds: ['srl_106', 'srl_107']
        }
      ],

      // SRLs (Furniture Items)
      srls: [
        {
          id: 'srl_101',
          srlNumber: 101,
          projectId: 'proj_sreelal',
          furnitureName: 'Dining Table (8 Seater)',
          flowTypeId: 'flow_type_1',
          startDate: '2026-09-26',
          status: 'IN_PROGRESS',
          processIds: ['proc_101_1', 'proc_101_2', 'proc_101_3']
        },
        {
          id: 'srl_102',
          srlNumber: 102,
          projectId: 'proj_sreelal',
          furnitureName: 'Dining Chairs (Set of 6)',
          flowTypeId: 'flow_type_2',
          startDate: '2026-09-28',
          status: 'IN_PROGRESS',
          processIds: ['proc_102_1', 'proc_102_2', 'proc_102_3']
        },
        {
          id: 'srl_103',
          srlNumber: 103,
          projectId: 'proj_sreelal',
          furnitureName: 'Crockery Credenza',
          flowTypeId: 'flow_type_1',
          startDate: '2026-09-29',
          status: 'NOT_STARTED',
          processIds: ['proc_103_1', 'proc_103_2', 'proc_103_3']
        },
        {
          id: 'srl_104',
          srlNumber: 104,
          projectId: 'proj_hafeez',
          furnitureName: 'L-Shape Sectional Sofa',
          flowTypeId: 'flow_type_2',
          startDate: '2026-09-24',
          status: 'IN_PROGRESS',
          processIds: ['proc_104_1', 'proc_104_2', 'proc_104_3']
        },
        {
          id: 'srl_105',
          srlNumber: 105,
          projectId: 'proj_hafeez',
          furnitureName: 'Carved Teak King Bed',
          flowTypeId: 'flow_type_5',
          startDate: '2026-09-28',
          status: 'IN_PROGRESS',
          processIds: ['proc_105_1', 'proc_105_2', 'proc_105_3']
        },
        {
          id: 'srl_106',
          srlNumber: 106,
          projectId: 'proj_resort',
          furnitureName: 'Balcony Lounge Chairs (Pair)',
          flowTypeId: 'flow_type_3',
          startDate: '2026-09-28',
          status: 'IN_PROGRESS',
          processIds: ['proc_106_1', 'proc_106_2', 'proc_106_3']
        },
        {
          id: 'srl_107',
          srlNumber: 107,
          projectId: 'proj_resort',
          furnitureName: 'Teak Coffee Table',
          flowTypeId: 'flow_type_1',
          startDate: '2026-10-02',
          status: 'NOT_STARTED',
          processIds: ['proc_107_1', 'proc_107_2', 'proc_107_3']
        }
      ],

      // Processes (Sub-tasks)
      processes: [
        // SRL 101 - Dining Table
        {
          id: 'proc_101_1',
          srlId: 'srl_101',
          projectId: 'proj_sreelal',
          sequence: 1,
          department: 'Carpentry',
          employeeId: 'emp_rajan',
          durationDays: 3, // 26 Sep -> 29 Sep (includes leave conflict on 29 Sep!)
          status: 'IN_PROGRESS',
          progressPercent: 65,
          notes: 'Solid teak table top joinery & apron'
        },
        {
          id: 'proc_101_2',
          srlId: 'srl_101',
          projectId: 'proj_sreelal',
          sequence: 2,
          department: 'Polish',
          employeeId: 'emp_rajesh',
          durationDays: 2.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Natural PU matt lacquer finish'
        },
        {
          id: 'proc_101_3',
          srlId: 'srl_101',
          projectId: 'proj_sreelal',
          sequence: 3,
          department: 'Carpentry',
          employeeId: 'emp_santhosh',
          durationDays: 1,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Final leg leveling & anti-scratch felt'
        },

        // SRL 102 - Dining Chairs
        {
          id: 'proc_102_1',
          srlId: 'srl_102',
          projectId: 'proj_sreelal',
          sequence: 1,
          department: 'Carpentry',
          employeeId: 'emp_satheesh',
          durationDays: 3,
          status: 'IN_PROGRESS',
          progressPercent: 20,
          notes: '6 chair frames mortise and tenon joinery'
        },
        {
          id: 'proc_102_2',
          srlId: 'srl_102',
          projectId: 'proj_sreelal',
          sequence: 2,
          department: 'Polish',
          employeeId: 'emp_rajesh',
          durationDays: 2,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Dark walnut stain to match table'
        },
        {
          id: 'proc_102_3',
          srlId: 'srl_102',
          projectId: 'proj_sreelal',
          sequence: 3,
          department: 'Upholstery',
          employeeId: 'emp_saddique',
          durationDays: 1.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'High density foam with beige linen fabric'
        },

        // SRL 103 - Crockery Credenza
        {
          id: 'proc_103_1',
          srlId: 'srl_103',
          projectId: 'proj_sreelal',
          sequence: 1,
          department: 'Carpentry',
          employeeId: 'emp_manikandan',
          durationDays: 3.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Carcass assembly & soft-close drawers'
        },
        {
          id: 'proc_103_2',
          srlId: 'srl_103',
          projectId: 'proj_sreelal',
          sequence: 2,
          department: 'Polish',
          employeeId: 'emp_rajesh',
          durationDays: 2.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Fluted front staining'
        },
        {
          id: 'proc_103_3',
          srlId: 'srl_103',
          projectId: 'proj_sreelal',
          sequence: 3,
          department: 'Carpentry',
          employeeId: 'emp_manikandan',
          durationDays: 1,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Hardware mounting & glass shelf insertion'
        },

        // SRL 104 - L-Shape Sofa
        {
          id: 'proc_104_1',
          srlId: 'srl_104',
          projectId: 'proj_hafeez',
          sequence: 1,
          department: 'Carpentry',
          employeeId: 'emp_sasi',
          durationDays: 2.5,
          status: 'COMPLETED',
          progressPercent: 100,
          notes: 'Treated pine hardwood frame'
        },
        {
          id: 'proc_104_2',
          srlId: 'srl_104',
          projectId: 'proj_hafeez',
          sequence: 2,
          department: 'Polish',
          employeeId: 'emp_rajesh',
          durationDays: 1,
          status: 'IN_PROGRESS',
          progressPercent: 70,
          notes: 'Exposed teak base plinth'
        },
        {
          id: 'proc_104_3',
          srlId: 'srl_104',
          projectId: 'proj_hafeez',
          sequence: 3,
          department: 'Upholstery',
          employeeId: 'emp_saddique',
          durationDays: 4,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Pocket spring core + goose feather blend cushions'
        },

        // SRL 105 - Carved Teak King Bed
        {
          id: 'proc_105_1',
          srlId: 'srl_105',
          projectId: 'proj_hafeez',
          sequence: 1,
          department: 'Turning',
          employeeId: 'emp_santhosh',
          durationDays: 1.5,
          status: 'IN_PROGRESS',
          progressPercent: 40,
          notes: 'Turning bedposts on lathe'
        },
        {
          id: 'proc_105_2',
          srlId: 'srl_105',
          projectId: 'proj_hafeez',
          sequence: 2,
          department: 'Carpentry',
          employeeId: 'emp_sasi',
          durationDays: 3,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Headboard fretwork & frame assembly'
        },
        {
          id: 'proc_105_3',
          srlId: 'srl_105',
          projectId: 'proj_hafeez',
          sequence: 3,
          department: 'Polish',
          employeeId: 'emp_rajesh',
          durationDays: 2.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Hand rubbed teak oil finish'
        },

        // SRL 106 - Balcony Lounge Chairs
        {
          id: 'proc_106_1',
          srlId: 'srl_106',
          projectId: 'proj_resort',
          sequence: 1,
          department: 'Metal',
          employeeId: 'emp_sasi',
          durationDays: 2,
          status: 'IN_PROGRESS',
          progressPercent: 50,
          notes: 'Powder-coated aluminum chassis'
        },
        {
          id: 'proc_106_2',
          srlId: 'srl_106',
          projectId: 'proj_resort',
          sequence: 2,
          department: 'Carpentry',
          employeeId: 'emp_satheesh',
          durationDays: 2,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Teak slat armrests & backrest weave'
        },
        {
          id: 'proc_106_3',
          srlId: 'srl_106',
          projectId: 'proj_resort',
          sequence: 3,
          department: 'Polish',
          employeeId: 'emp_rajesh',
          durationDays: 1.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Exterior weather-proof polyurethane'
        },

        // SRL 107 - Coffee Table
        {
          id: 'proc_107_1',
          srlId: 'srl_107',
          projectId: 'proj_resort',
          sequence: 1,
          department: 'Carpentry',
          employeeId: 'emp_manikandan',
          durationDays: 2,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Organic live edge teak slab fabrication'
        },
        {
          id: 'proc_107_2',
          srlId: 'srl_107',
          projectId: 'proj_resort',
          sequence: 2,
          department: 'Polish',
          employeeId: 'emp_rajesh',
          durationDays: 1.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Clear epoxy river fill & satin buff'
        },
        {
          id: 'proc_107_3',
          srlId: 'srl_107',
          projectId: 'proj_resort',
          sequence: 3,
          department: 'Carpentry',
          employeeId: 'emp_manikandan',
          durationDays: 0.5,
          status: 'PENDING',
          progressPercent: 0,
          notes: 'Hairpin leg fastening and packing'
        }
      ],

      // Manpower Records (Leaves, Overtime, Join/Exit)
      manpowerRecords: [
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
      ]
    };
  }
};
