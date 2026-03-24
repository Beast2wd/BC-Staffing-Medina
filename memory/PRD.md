# Medina County BC Staffing - Product Requirements Document

## Original Problem Statement
Create a fire department staffing website called "Medina County BC Staffing" that tracks department personnel at each station, showing personnel assigned for each shift (A, B, C) at Fire Stations 10, 11, 12, 14, 15, 20, 40, and 60. Professional design with dark/light mode toggle.

## User Personas
1. **Admin** - Full access to all features including personnel management and system configuration
2. **Battalion Chief** - Access to staffing worksheets, leave management, overtime, deployments
3. **Captain/Lieutenant** - Edit access to staffing records
4. **Firefighter** - View-only access to staffing information

## Core Requirements
- Role-based authentication (Admin, Battalion Chief, Captain, Lieutenant, Firefighter)
- Daily Worksheet showing staffing grid for all stations
- Calendar with color-coded shifts (A=Red, B=Green, C=Blue)
- Battalion selector (8110, 8114)
- Navigation tabs: Daily Worksheet, Battalion Chief, Deputy Chief, Tools (admin), Reports, Logout

## What's Been Implemented (March 24, 2026)

### Backend (FastAPI + MongoDB)
- ✅ User authentication with JWT tokens
- ✅ Role-based access control
- ✅ Personnel CRUD operations
- ✅ Station management (8 stations: 10, 11, 12, 14, 15, 20, 40, 60)
- ✅ Battalion management (8110, 8114)
- ✅ Staffing records API
- ✅ Leave records (Sick, Vacation, Holiday)
- ✅ Overtime tracking
- ✅ Deployment records
- ✅ Apparatus assignments
- ✅ Remarks/notes system
- ✅ Shift calendar calculation (A/B/C rotation)
- ✅ Reports API (Daily Summary, Overtime Summary)
- ✅ Database seeding with sample data (120 personnel, 2 battalions, 8 stations)

### Frontend (React + Tailwind + Shadcn)
- ✅ Login page with logo and form
- ✅ Dark/Light mode toggle
- ✅ Dashboard with Daily Work Sheet
- ✅ Staffing grid showing all stations and categories
- ✅ Calendar with shift-colored days
- ✅ Battalion selector dropdown
- ✅ Navigation with dropdown menus
- ✅ Battalion Chief pages (Apparatus, Sick, Vacation, Holiday, Deployment, Overtime)
- ✅ Deputy Chief Day of Staffing page
- ✅ Reports page with generate and preview
- ✅ Personnel Management (Admin only)
- ✅ Role-based menu visibility (Tools hidden for non-admin)
- ✅ Responsive design
- ✅ Toast notifications

## Test Credentials
- Admin: 100001 / admin123
- Battalion Chief: 100002 / bc123

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Core authentication system
- [x] Daily staffing worksheet
- [x] Station and personnel display
- [x] Shift calendar with colors

### P1 (High Priority) - Partially Done
- [x] Leave management (Sick, Vacation, Holiday)
- [x] Overtime tracking
- [x] Basic reports
- [ ] Editable staffing grid cells
- [ ] Real-time staffing record updates

### P2 (Medium Priority)
- [ ] Station/User management pages (full CRUD UI)
- [ ] Personnel transfer between stations
- [ ] Batch operations for leave entry
- [ ] Print-friendly report views
- [ ] Email notifications for staffing changes

### P3 (Future Enhancements)
- [ ] Mobile app version
- [ ] Push notifications
- [ ] Integration with scheduling systems
- [ ] Historical data analytics dashboard
- [ ] Audit logging

## Next Tasks
1. Implement editable staffing grid cells (click to add/update values)
2. Complete User Management page UI
3. Add print functionality to reports
4. Implement real-time WebSocket updates for staffing changes
