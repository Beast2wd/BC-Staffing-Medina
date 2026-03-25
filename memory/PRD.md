# Medina County BC Staffing - Product Requirements Document

## Original Problem Statement
Create a fire department staffing website called "Medina County BC Staffing" that tracks department personnel at each station, showing personnel assigned for each shift (A, B, C) at Fire Stations 10, 11, 12, 14, 15, 20, 40, and 60. Professional design with dark/light mode toggle.

## User Personas
1. **Admin** - Full access to all features including personnel/user/station management
2. **Battalion Chief** - Access to staffing worksheets, leave management, overtime, deployments
3. **Captain/Lieutenant** - Edit access to staffing records
4. **Firefighter** - View-only access to staffing information

## Core Requirements
- Role-based authentication (Admin, Battalion Chief, Captain, Lieutenant, Firefighter)
- Daily Worksheet with editable staffing grid
- Calendar with 48 on/96 off shift rotation (C shift starts 3/24/2026)
- Shift colors: A=Red, B=Green, C=Blue
- Battalion selector (8110, 8114)

## Shift Rotation
- 48 hours on, 96 hours off (2 days on, 4 days off per shift)
- Reference: C shift on March 24-25, 2026
- Pattern: C,C,A,A,B,B,C,C,A,A,B,B...

## Staffing Categories (Updated March 25, 2026)
### Kept Categories:
- Minimum Staffing
- Personnel Assigned (+)
- Overtime (+)
- Hold Over* (+)
- Out of Battalion Fill In (+)
- Out of Battalion Fill In (-)
- HOLIDAY (-)
- FMLA (-)
- VACATION (-)
- SICK (-)
- Injured On Duty (-)
- Scheduled Other (-)
- UnScheduled Other (-)
- SAP Adjusted Personnel (+/-)
- In Battalion Fill In (-)
- In Battalion Fill In (+)

### Removed Categories:
- Debit Day (+)
- Guaranteed Holidays (-)
- Day of Holidays (-)
- Vac-Scheduled (-)
- Vac-Scheduled Debit (-)
- Sick-family (-)
- EMS Adjusted Personnel (-)

## What's Been Implemented (March 25, 2026)

### Backend (FastAPI + MongoDB)
- ✅ User authentication with JWT tokens (72hr expiration)
- ✅ Role-based access control
- ✅ Personnel/Station/User CRUD operations
- ✅ Staffing records with editable categories
- ✅ Leave records (Sick, Vacation, Holiday)
- ✅ Overtime tracking
- ✅ Deployment records
- ✅ Apparatus assignments
- ✅ Reports API (Daily Summary, Overtime Summary)
- ✅ 48/96 shift rotation calculation

### Frontend (React + Tailwind + Shadcn)
- ✅ Login page with logo
- ✅ Dark/Light mode toggle
- ✅ Dashboard with Daily Work Sheet
- ✅ **Editable staffing grid cells** (click to edit)
- ✅ Calendar with correct shift colors (48 on/96 off)
- ✅ Battalion Chief pages (Apparatus, Sick, Vacation, Holiday, Deployment, Overtime)
- ✅ Deputy Chief Day of Staffing page
- ✅ **Personnel Management page** (Admin only)
- ✅ **User Management page** (Admin only)
- ✅ **Station Management page** (Admin only)
- ✅ Reports page with **Print functionality**

## Test Credentials
- Admin: 100001 / admin123
- Battalion Chief: 100002 / bc123

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core authentication system
- [x] Daily staffing worksheet with editable cells
- [x] Correct shift rotation (48 on/96 off)
- [x] Updated category names

### P1 (High Priority) - DONE
- [x] User Management page
- [x] Station Management page
- [x] Print functionality for reports

### P2 (Medium Priority)
- [ ] Shift notification alerts when below minimum staffing
- [ ] Export reports to PDF/Excel
- [ ] Batch personnel operations
- [ ] Email notifications

### P3 (Future Enhancements)
- [ ] Mobile app version
- [ ] Real-time WebSocket updates
- [ ] Historical data analytics dashboard
- [ ] Audit logging

## Next Tasks
1. Implement shift notification alerts
2. Add export to PDF/Excel for reports
3. Implement bulk leave entry
