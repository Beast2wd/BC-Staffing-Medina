# Medina County BC Staffing - Product Requirements Document

## Original Problem Statement
Create a fire department staffing website called "Medina County BC Staffing" that tracks department personnel at each station, showing personnel assigned for each shift (A, B, C) at Fire Stations 10, 11, 12, 14, 15, 20, 40, and 60. Professional design with dark/light mode toggle.

## User Personas
1. **Admin** - Full access to all features
2. **Battalion Chief** - Staffing management, overtime assignment
3. **Captain/Lieutenant** - Edit access to staffing records
4. **Firefighter** - View-only access EXCEPT Overtime tab (can submit availability)

## Shift Rotation
- 48 hours on, 96 hours off (2 days on, 4 days off per shift)
- Reference: C shift on March 24-25, 2026
- Pattern: C,C,A,A,B,B,C,C,A,A,B,B...

## Personnel Ranks
Fire Chief, Asst. Chief, Deputy Chief, Battalion Chief, Captain, Lieutenant, Driver Operator, Paramedic, Firefighter

## Staffing Categories
- Minimum Staffing
- Personnel Assigned (+)
- Overtime (+)
- Hold Over* (+)
- Out of Battalion Fill In (+/-)
- HOLIDAY (-)
- FMLA (-)
- VACATION (-)
- SICK (-)
- Injured On Duty (-)
- Scheduled Other (-)
- UnScheduled Other (-)
- SAP Adjusted Personnel (+/-)
- In Battalion Fill In (+/-)

## Remarks & Notes Tabs
Overtime, HOLIDAY, VACATION, SICK, Remarks, District Fill-In, SAP Adjust

## Deployment Types
TIFMAS, TX-TF1, Mutual Aid, Strike Team, Task Force, Training, Special Assignment, Administrative, Other

## Implemented Features (March 25, 2026)

### Core Features
- ✅ Role-based authentication (Admin, BC, Captain, Lieutenant, Firefighter)
- ✅ Daily Worksheet with editable staffing grid
- ✅ Shift calendar (48 on/96 off rotation)
- ✅ Dark/Light mode toggle

### Personnel Management
- ✅ Add/Edit/Deactivate personnel
- ✅ Fields: Payroll, Name, Rank, Station, Shift, Phone, Certifications
- ✅ Updated ranks list
- ✅ Certification management with predefined options
- ✅ **Edit Payroll Number** - Payroll field now editable in Edit Personnel dialog (March 26, 2026)
- ✅ **Set Temporary Password** - Admin can assign temp password to personnel, creating user account (March 26, 2026)
- ✅ **Forced Password Change** - Users with temp password must change it on first login (ChangePasswordModal blocks access)
- ✅ **Password Strength Indicator** - Visual feedback (Weak/Fair/Good/Strong) with tips as users type new password (March 26, 2026)

### Overtime System
- ✅ **Overtime tab** - All users can submit availability
- ✅ **Battalion Chief Overtime** - Assign/manage overtime
- ✅ Phone number tracking for OT personnel
- ✅ Date navigation arrows
- ✅ Status tracking (Available, Assigned, Declined)
- ✅ Sync with daily worksheet Overtime (+) cell
- ✅ **Delete function** - BC can delete overtime records from list (March 26, 2026)
- ✅ **Hours worked tracking** - Running total of OT hours per personnel, updates on assign/decline (March 26, 2026)
- ✅ **12/24 hour shift types** - Option to select shift duration when submitting availability (March 26, 2026)
- ✅ **144 hour limit** - Availability can only be submitted up to 3 tours (144 hours) in advance (March 26, 2026)
- ✅ **Updated notice** - Decline responsibility includes "via department email and phone call" (March 26, 2026)
- ✅ **Removed station selection** - Uses personnel's home station automatically (March 26, 2026)
- ✅ **Self-remove from list** - Personnel can remove themselves via "Remove" option before being assigned (March 26, 2026)
- ✅ **OT Station dropdown** - Admin/BC/Captain/Lieutenant can select overtime station; syncs to daily worksheet (March 26, 2026)

### Station Management
- ✅ Add/Edit stations
- ✅ Configure apparatus per station
- ✅ Set minimum staffing

### User Management
- ✅ Add/Edit/Deactivate users
- ✅ Role assignment
- ✅ **Edit User** - Update name, rank, role, station, shift, status (March 27, 2026)
- ✅ **Reset Password** - Admin can reset any user's password (March 27, 2026)

### Reports
- ✅ Daily Staffing Summary
- ✅ Overtime Summary
- ✅ Print functionality

## Test Credentials
- Admin: 100001 / admin123
- Battalion Chief: 100002 / bc123

## Access Matrix
| Role | Daily Worksheet | BC Menu | DC Menu | Tools | Overtime Tab | Reports |
|------|-----------------|---------|---------|-------|--------------|---------|
| Admin | Edit | Full | Full | Full | Submit | Full |
| BC | Edit | Full | Full | - | Submit | Full |
| Captain | Edit | View | View | - | Submit | View |
| Lieutenant | Edit | View | View | - | Submit | View |
| Firefighter | View | - | - | - | Submit | - |

## Next Tasks (Backlog)
1. Shift notification alerts when below minimum staffing (P2)
2. Export reports to PDF/Excel (P2)
3. Real-time WebSocket updates (P3)

## API Endpoints Added (March 26, 2026)
- `POST /api/auth/set-temporary-password` - Admin sets temp password for personnel (creates user account)
- `POST /api/auth/change-password` - User changes password (clears must_change_password flag)
- `PUT /api/personnel/{id}` - Now accepts payroll_number updates
- `DELETE /api/overtime/{id}` - Delete overtime record (deducts hours if was assigned)
- `PUT /api/overtime/{id}` - Now tracks personnel overtime_hours_worked (add on assign, deduct on decline)
