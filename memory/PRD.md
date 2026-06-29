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
Fire Chief, Asst. Chief, Deputy Chief, Battalion Chief, Captain, Lieutenant, Driver Operator, Paramedic, Firefighter, Volunteer Firefighter

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
- In Battalion Fill In (+/-)

## Remarks & Notes Tabs
Overtime, HOLIDAY, VACATION, SICK, Remarks, District Fill-In

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
- ✅ **Contact Info Fields** - Email and phone_number fields in Add/Edit dialogs, Contact column in table (May 15, 2026)
- ✅ **Force Password Change** - Reset Password dialog has checkbox to force password change on first login (May 15, 2026)
- ✅ **Password Visibility Toggle** - Eye icon to show/hide password in Add User dialog (May 19, 2026)

### Part-Time Management (April 20, 2026)
- ✅ Add/Edit/Delete part-time employees
- ✅ Employee number, name, rank, certifications fields
- ✅ Alphabetically sorted by name
- ✅ Search and filter by rank
- ✅ Located under Tools dropdown below User Management
- ✅ **Contact Info Fields** - Phone and Email fields in Add/Edit dialogs, Contact column in table
- ✅ **Auto User Account Creation** - User account is auto-created with `parttime123` password and forced password change on first login (May 15, 2026)
- ✅ **Login Info Notice** - Add dialog shows login instructions with initial password `parttime123` (May 15, 2026)
- ✅ **User Management Sync** - Part-time employees automatically appear in User Management for role assignment; deletion deactivates their user account (May 19, 2026)

### Part-Time Availability (April 20, 2026)
- ✅ Part-Time Availability page under Personnel dropdown (between Overtime and Volunteer)
- ✅ Submit availability for part-time employees (NOT auto-assigned like volunteers)
- ✅ No station selection required
- ✅ 24-hour fixed shift duration
- ✅ Color-coded calendar with shift badges (A=Red, B=Green, C=Blue)
- ✅ Notes section for additional information
- ✅ Status dropdown shows only "Available" and "Declined" (removed "Assigned")
- ✅ "Decline Shift" button for assigned shifts with confirmation
- ✅ Important warning notice about declining assigned shifts

### Part-Time BC Management (April 20, 2026)
- ✅ Battalion Chief > Part-Time Available page (between Overtime Available and Volunteer Scheduled)
- ✅ Approve/Decline pending part-time availability requests
- ✅ **Station selection dropdown** in pending approvals table (required before approval)
- ✅ Only BC+ and Admin can approve
- ✅ Shows hours scheduled, monthly hours, and YTD hours per employee
- ✅ Recent approved scheduled days displayed with station badge
- ✅ Work history tracking ordered by date with station column
- ✅ Once approved with station, status updates to "assigned" on employee's view
- ✅ **Station badges in Employee Details** - Recent Approved Scheduled Days and Days Worked sections now show assigned station (April 20, 2026)

### Daily Worksheet Part-Time Integration (April 20, 2026)
- ✅ **Part-Time (+)** row added above Volunteer (+) in Daily Worksheet
- ✅ Shows count of assigned part-time employees per station
- ✅ Automatically reflects in Total Personnel On Duty calculations
- ✅ Included in Stations Even/Over/Under variance

### On Duty Part-Time Display (April 20, 2026)
- ✅ Station cards show "+X PT" badge when part-time employees assigned
- ✅ **Part-Time (+X)** section with purple styling per station
- ✅ Shows employee name, number, and hours

### Day of Staffing Part-Time Display (April 20, 2026)
- ✅ Station headers show "+X PT" badge when part-time employees assigned
- ✅ **Part-Time (+X):** section per station
- ✅ Shows employee names with hours
- ✅ Included in assigned count

### Reports
- ✅ Daily Staffing Summary
- ✅ Overtime Summary
- ✅ Print functionality
- ✅ **Export to Excel** - Download staffing report as .xlsx with change history (March 31, 2026)
- ✅ **Export to PDF** - Download staffing report as .pdf (March 31, 2026)
- ✅ **Personnel On Duty Display** - Shows personnel names in Daily Staffing Summary station breakdown (April 1, 2026)
- ✅ **Generator Info** - Reports show "Generated by: Name (Payroll: XXXXXX) on Date/Time" (April 1, 2026)
- ✅ **Overtime Work History** - Overtime Summary now shows detailed work history for each employee with date, shift, station, hours, and status (April 19, 2026)

### Volunteer System (March 31, 2026)
- ✅ **Volunteer Available** - Battalion Chief management page for volunteer firefighters
- ✅ **Volunteer** - Renamed from "Vol. FF Availability" (April 1, 2026)
- ✅ **Important notice** - Decline responsibility includes "via department email and phone call"
- ✅ **Volunteer Firefighter rank** - Added to Personnel Management
- ✅ **User Management Sync** - Volunteers automatically appear in User Management for role assignment; deletion deactivates their user account (May 19, 2026)
- ✅ **Rescind Shift Cleanup** - When a volunteer rescinds their shift, they are automatically removed from apparatus assignments, the On Duty section, and the staffing record volunteer count is decremented (June 25, 2026)

### On Duty Page (March 31, 2026)
- ✅ Shows all personnel on duty at each station
- ✅ Calendar navigation with shift color coding
- ✅ View-only for all users including volunteer firefighters

### Audit & Tracking (March 31, 2026)
- ✅ **Last Modified By** - Tracks payroll number of who made staffing changes
- ✅ **Change History** - Maintains audit log of all staffing modifications
- ✅ **Export with History** - Excel export includes change history sheet

### Apparatus Assignments (March 31, 2026)
- ✅ **Edit Functionality** - Fixed edit button to assign personnel to apparatus
- ✅ **Delete Functionality** - Remove assignments
- ✅ **Riding Positions (A, B, C, D)** - Assign personnel to specific riding positions on apparatus (April 1, 2026)
- ✅ **Position Display** - Riding positions shown in assignments table, reports, and exports
- ✅ **Selective Personnel Removal** - When removing from assignment with multiple personnel, dialog asks which riding position to remove (April 19, 2026)
- ✅ **Part-Time Personnel Integration** - Assigned part-time employees now appear in Apparatus Assignments for their station/shift (April 20, 2026)
  - Part-time employees show with purple styling (PT prefix)
  - Can be assigned to riding positions (A, B, C, D)
  - Displayed alongside regular personnel and volunteers

### UI/UX Improvements (April 1, 2026)
- ✅ **Navbar Spacing** - Properly spaced header links with consistent padding
- ✅ **Tab Names Single Line** - "Daily Worksheet", "On Duty" etc. now on single lines with whitespace-nowrap
- ✅ **Renamed Volunteer Tab** - Changed from "Vol. FF Availability" to "Volunteer"

### UI/UX Improvements (April 19, 2026)
- ✅ **Custom Increment/Decrement Buttons** - Daily worksheet cells now have custom chevron up/down buttons instead of native number spinners for reliable value changes
- ✅ **Selective Personnel Removal** - When removing apparatus assignment with multiple personnel, dialog asks which riding position to remove

### Overtime Notification Broadcast (May 19, 2026)
- ✅ **Send Notification Button** - Added to Battalion Chief > Overtime Available page
- ✅ **Broadcast Modal** - Comprehensive UI for drafting SMS/Email notifications
- ✅ **Target Audience Filters** - All Personnel, By Rank, Paramedics Only, Specific Individuals
- ✅ **Rank Selection** - Checkboxes for Fire Chief, Asst. Chief, Deputy Chief, Battalion Chief, Captain, Lieutenant, Firefighter, Part-Time Firefighter, Volunteer
- ✅ **Individual Selection** - Scrollable list with search, shows PT/VOL badges
- ✅ **Notification Methods** - SMS Text and Email checkboxes
- ✅ **Message Composition** - Email subject and message body with auto-populated date context
- ✅ **Recipients Preview** - Shows count and list of recipients with phone/email icons
- ✅ **Backend API** - `/api/notifications/broadcast` endpoint stores notification records
- ✅ **Twilio SMS Integration** - Live SMS delivery to recipients (May 23, 2026)
- ✅ **SendGrid Email Integration** - Live email delivery with HTML formatting (May 23, 2026)

### Date Formatting (April 3, 2026)
- ✅ **Global MM/DD/YYYY format** - All dates across the site now display as MM/DD/YYYY (e.g., 04/03/2026)
- ✅ **dateUtils.js utility** - Created `/app/frontend/src/utils/dateUtils.js` with formatting functions
- ✅ **Updated components** - StaffingGrid, ShiftCalendar, DashboardPage, OnDutyPage, ReportsPage, LeaveManagementPage, OvertimePage, VolunteerPage, ApparatusPage, DeploymentPage, OvertimeAvailabilityPage, VolunteerAvailabilityPage

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

### Deployment Tracker (May 7, 2026)
- ✅ New submenu under Personnel > Deployment Tracker
- ✅ **Roster Page** - Full personnel deployment eligibility with certifications (FF1, Crew Boss, Engine Boss, MIST, WPU, ASTL, MedL, Tech-Spec)
- ✅ **Deployment Log** - Record of all TIFMAS and EMTF deployments with dates, incident names, personnel, positions
- ✅ **TIFMAS Rank** - Personnel list for TIFMAS deployments (orange theme)
- ✅ **EMTF Rank** - Personnel list for EMTF deployments (blue theme)
- ✅ Import Data functionality to load initial roster and log from Excel data
- ✅ Edit/Delete permissions for Lieutenant rank and above
- ✅ Pack Test levels (Arduous/Moderate/Light)
- ✅ EMS Level tracking (Paramedic, EMT-A, EMT-B)
- ✅ **Sync with BC Deployments page** - Deployment Log data shows in Battalion Chief > Deployments
- ✅ **Three view modes**: All, By Name, By Month
- ✅ **Days calculation** per personnel and total
- ✅ **Removed TIFMAS/EMTF Score columns** - Score columns hidden from Roster, TIFMAS Rank, and EMTF Rank pages (May 7, 2026)
- ✅ **Original Excel order preserved** - Personnel list order matches uploaded spreadsheet

### TIFMAS Deploy Personnel Feature (May 12, 2026)
- ✅ **Deploy checkbox column** - Added "Deploy" column with checkboxes next to Pack Test on TIFMAS Rank page
- ✅ **Deploy Personnel button** - Shows selected count, located below "Eligible Personnel" badge
- ✅ **Deploy confirmation dialog** includes:
  - Selected personnel list with name and rank
  - Start Date and End Date pickers
  - Location/Incident Name text field
  - Notes (optional) textarea
  - Notification Reminder about text/email setup
  - Yes/No confirmation buttons
- ✅ **Automatic updates on deployment**:
  - "Last Deploy" column updates to deployment start date
  - "Deploys (12mo)" count increments by 1
- ✅ **Syncs to BC Deployments page** - Deployed personnel appear in Battalion Chief > Deployments with:
  - Personnel name, Station, Shift
  - Type: TIFMAS (orange badge)
  - Location/Incident Name
  - Start/End dates
  - Active and All Deployments sections
- ⚠️ **Text/Email Notifications** - PENDING USER SETUP (reminder shown in UI)

### EMTF Deploy Personnel Feature (May 12, 2026)
- ✅ **Deploy checkbox column** - Added "Deploy" column with checkboxes next to Pack Test on EMTF Rank page
- ✅ **Deploy Personnel button** - Shows selected count with blue styling
- ✅ **Deploy confirmation dialog** (blue theme) includes:
  - Selected personnel list with name, rank, and EMS Level
  - Start Date and End Date pickers
  - Location/Incident Name text field
  - Notes (optional) textarea
  - Notification Reminder about text/email setup
  - Yes/No confirmation buttons
- ✅ **Automatic updates on deployment**:
  - "Last Deploy" column updates to deployment start date
  - "Deploys (12mo)" count increments by 1
- ✅ **Syncs to BC Deployments page** - Deployed personnel appear in Battalion Chief > Deployments with:
  - Type: EMTF (blue badge)
  - Location/Incident Name
  - Start/End dates
- ⚠️ **Text/Email Notifications** - PENDING USER SETUP (reminder shown in UI)

### TIFMAS/EMTF Edit Capability (May 13, 2026)
- ✅ **Edit button column** - Added pencil icon button for each personnel row
- ✅ **TIFMAS Edit Dialog** (orange theme) includes:
  - Name, Rank, EMS Level, Pack Test Level dropdowns
  - Last TIFMAS Deploy date picker
  - Deploys (12mo) counter
  - TIFMAS Certifications: FF1, Crew Boss, Engine Boss, ASTL, WPU, TIFMAS Eligible
  - Cancel/Save Changes buttons
- ✅ **EMTF Edit Dialog** (blue theme) includes:
  - Name, Rank, EMS Level, Pack Test Level dropdowns
  - Last EMTF Deploy date picker
  - Deploys (12mo) counter
  - EMTF Certifications: MIST, MedL, Tech-Spec, EMTF Eligible
  - Cancel/Save Changes buttons
- ✅ Changes sync to deployment_roster collection and update all views

### Time Off Summary Report (May 7, 2026)
- ✅ New report under Reports tab: "Time Off Summary"
- ✅ Shows YTD totals for Sick (red), Vacation (blue), and Holiday (green) days
- ✅ Monthly breakdown tables for each leave type
- ✅ Displays which personnel were off each month
- ✅ Year-based reporting (uses selected date's year)
- ✅ Print and Export functionality

## Backend Architecture Refactor (June 19, 2026)
- ✅ **Modular Route Structure** - `server.py` reduced from 4000+ lines to ~80 lines
- ✅ **12 Route Modules** - Created under `/app/backend/routes/`:
  - `auth_routes.py` - Authentication endpoints
  - `personnel_routes.py` - Personnel CRUD
  - `stations_routes.py` - Stations and battalions
  - `staffing_routes.py` - Staffing and apparatus assignments
  - `volunteer_routes.py` - Volunteer records and management
  - `parttime_routes.py` - Part-time employees and availability
  - `overtime_routes.py` - Overtime and leave records
  - `deployments_routes.py` - Deployment tracker (TIFMAS/EMTF)
  - `users_routes.py` - User management (admin)
  - `notifications_routes.py` - SMS/Email broadcast
  - `reports_routes.py` - All report endpoints
  - `misc_routes.py` - Health, seed, shift calendar
- ✅ **Shared Modules**:
  - `database.py` - MongoDB connection, JWT config, Twilio/SendGrid config
  - `models.py` - All Pydantic models
  - `auth.py` - Authentication helpers and utilities
- ✅ **All 25+ API endpoints validated** - No regressions from refactor

## Next Tasks (Backlog)
1. **Minimum Staffing Alerts** - Shift notification alerts when stations fall below minimum staffing (P2)
2. **Decline Notifications** - Email and text notifications to on-duty BC when user declines assigned part-time shift (P2)
3. **Multi-tenant SaaS architecture** - Convert platform to host multiple independent fire departments (Future)

## Real-time WebSocket Updates (June 19, 2026)
- ✅ **WebSocket Endpoint** - `/api/ws` accepts authenticated and anonymous connections
- ✅ **Channel-based Subscriptions** - Clients subscribe to specific channels (staffing, overtime, personnel, volunteer, parttime, deployments)
- ✅ **Live Connection Indicator** - Green "Live" badge on Dashboard showing WebSocket status
- ✅ **Auto-refresh on Updates** - Pages automatically refresh when relevant data changes
- ✅ **Backend Broadcasts**:
  - `staffing_update` - When staffing records or apparatus assignments change
  - `overtime_update` - When overtime records are created/updated/deleted
  - `apparatus_update` - When apparatus assignments change
- ✅ **Reconnection Logic** - Auto-reconnects with 3-second backoff if connection drops
- ✅ **Heartbeat** - Ping/pong every 30 seconds to keep connection alive
- ✅ **JWT Authentication** - Token passed via query parameter for authenticated sessions
- ✅ **Files Created**:
  - `/app/backend/websocket_manager.py` - Connection manager for broadcasts
  - `/app/backend/routes/websocket_routes.py` - WebSocket endpoint
  - `/app/frontend/src/contexts/WebSocketContext.js` - React provider and hooks

## Toast Notifications & Settings (June 23, 2026)
- ✅ **Settings Page** (`/settings`) - User preferences for notifications
  - Toggle to enable/disable real-time toast notifications
  - Duration selector (3/5/8/10 seconds)
  - **Sound Notifications toggle** (June 25, 2026) - Play audio alert when notifications arrive
  - Connection status indicator (reflects actual WebSocket state)
  - Reset to Defaults button
- ✅ **Settings Persistence** - Settings stored in localStorage (`userSettings` key)
- ✅ **Toast Notifications** - Shows who made changes (e.g., "Staffing updated by BC Smith")
- ✅ **Toasts for All Users on Page** (June 25, 2026) - Toast notifications now show for ALL users viewing the affected page, including the user who made the change
- ✅ **`modified_by` Field** - All backend broadcasts include the modifier's name for better audit trail
- ✅ **Volunteer Updates Hook** - Added `useVolunteerUpdates` hook for volunteer page real-time notifications
- ✅ **Deployment Updates Hook** - Added `useDeploymentUpdates` hook for deployment page real-time notifications
- ✅ **Files Created**:
  - `/app/frontend/src/contexts/SettingsContext.js` - Settings provider
  - `/app/frontend/src/pages/SettingsPage.js` - Settings page

## Notification Bell System (June 28, 2026)
- ✅ **Notification Bell Icon** - Located in navbar between theme toggle and user menu
- ✅ **Notification Dropdown** - Click bell to view notification history
- ✅ **Unread Badge** - Shows count of unread notifications (9+ for more than 9)
- ✅ **Time Ago Display** - Shows "Just now", "5m ago", "2h ago", "3d ago" etc.
- ✅ **Notification Types**:
  - Overtime Approved - When user's overtime is assigned
  - Profile Updated - When admin updates user's station, shift, rank, or role
  - Riding Assignment Updated - When added to apparatus assignment
- ✅ **Click to Navigate** - Clicking a notification takes user to relevant page
  - Firefighters are redirected to On Duty page
  - Other roles go to the specific page (e.g., /overtime)
- ✅ **Mark as Read** - Individual or mark all as read
- ✅ **Clear All** - Delete all notifications
- ✅ **Real-time Updates** - WebSocket integration for instant notification delivery
- ✅ **Sound Alert** - Plays notification sound when new notification arrives (if enabled in settings)
- ✅ **Show All Notifications Link** - Footer bar in dropdown links to full notifications page
- ✅ **Notifications Page** (`/notifications`) - Full page view of all notifications
  - Filter tabs: All, Unread, Read
  - Individual delete and mark as read buttons
  - Hover to see full date/time
- ✅ **Files Created**:
  - `/app/frontend/src/components/layout/NotificationBell.js` - Notification bell component
  - `/app/frontend/src/pages/NotificationsPage.js` - Full notifications page
  - `/app/backend/routes/user_notifications_routes.py` - Notification API endpoints

## Change Log (June 23, 2026)
- ✅ **Change Log Page** (`/change-log`) - Track all staffing changes
- ✅ **View Modes**: Live (real-time), Daily, Weekly, Monthly
- ✅ **Date Navigation** - Navigate between periods with arrows
- ✅ **Print Functionality** - Opens formatted print window
- ✅ **Export to CSV** - Downloads change log as CSV file (properly escaped)
- ✅ **Summary Stats** - Total changes, staffing changes, overtime changes, unique users
- ✅ **Table Columns**: Date/Time, Type, Modified By, Station, Details
- ✅ **Files Created**:
  - `/app/frontend/src/pages/ChangeLogPage.js` - Change Log page

### Calendar View (April 20, 2026)
- ✅ **New page under Deputy Chief** - Calendar View showing all scheduled overtime, part-time, and volunteer personnel
- ✅ **Color-coded personnel types**:
  - Overtime: Blue
  - Part-Time: Purple  
  - Volunteers: Green
- ✅ **Shift-colored calendar days** - A (red), B (green), C (blue) backgrounds
- ✅ **Station assignments displayed** - Each personnel shows their assigned station
- ✅ **Right-click context menu** - Remove personnel directly from calendar
- ✅ **Confirmation dialog** - Confirms removal before updating status to declined
- ✅ **Real-time sync** - Removed personnel are immediately removed from all related views
- ✅ **Summary statistics** - Shows count of OT, PT, and Volunteer shifts for the month
- ✅ **Month navigation** - Navigate between months with prev/next buttons

## API Endpoints Added (March 26, 2026)
- `POST /api/auth/set-temporary-password` - Admin sets temp password for personnel (creates user account)
- `POST /api/auth/change-password` - User changes password (clears must_change_password flag)
- `PUT /api/personnel/{id}` - Now accepts payroll_number updates
- `DELETE /api/overtime/{id}` - Delete overtime record (deducts hours if was assigned)
- `PUT /api/overtime/{id}` - Now tracks personnel overtime_hours_worked (add on assign, deduct on decline)

## API Endpoints Added (March 31, 2026)
- `GET /api/volunteer` - Get volunteer availability records
- `POST /api/volunteer` - Create volunteer availability
- `PUT /api/volunteer/{id}` - Update volunteer record
- `DELETE /api/volunteer/{id}` - Delete volunteer record
- `GET /api/reports/export/excel` - Export staffing report to Excel
- `GET /api/reports/export/pdf` - Export staffing report to PDF

## API Endpoints Added (April 12, 2026)
- `GET /api/volunteer/my-hours` - Get current volunteer's hours summary (YTD)
- `GET /api/reports/volunteer-hours` - Volunteer Hours Summary report by date range

## Volunteer System Updates (April 12, 2026)
- ✅ **Auto-Assignment** - Volunteers are automatically assigned when they submit availability (no approval needed)
- ✅ **Hours Tracking** - Track scheduled hours and hours worked for each volunteer
- ✅ **My Hours Summary** - Volunteers can see their own shifts and hours on the Volunteer Availability page
- ✅ **Renamed BC Tab** - "Volunteer Available" renamed to "Volunteer Availability"
- ✅ **Volunteer Hours Summary Report** - New report type under Reports showing all volunteer hours by date range
- ✅ **Auto-sync to Worksheet** - When volunteer submits availability, automatically increments the Volunteer (+) row on daily worksheet
