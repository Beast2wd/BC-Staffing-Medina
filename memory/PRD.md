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

## Weather Widget (July 29, 2026)
- ✅ **Daily Worksheet Weather Display** - Real-time weather widget on Daily Worksheet page
- ✅ **Open-Meteo Integration** - Free API, no key required
- ✅ **Current Conditions** - Temperature, humidity, wind speed, weather description with icon
- ✅ **4-Day Forecast** - Today + 3 days with high/low temps, humidity, precipitation chance
- ✅ **Tenant-Configurable Location** - Each department can set their own weather location
- ✅ **Browser Geolocation** - Auto-detect location option for admins
- ✅ **Manual Location Entry** - Search by city name, ZIP code, or address
- ✅ **Weather Icons** - Sun, cloud, rain, snow, lightning, fog icons
- ✅ **Files Created**:
  - `/app/backend/routes/weather_routes.py` - Weather API endpoints
  - `/app/frontend/src/components/dashboard/WeatherWidget.js` - Weather display component
- ✅ **API Endpoints**:
  - `GET /api/weather/forecast` - Get current weather and 4-day forecast
  - `GET /api/weather/location` - Get tenant's configured location
  - `PUT /api/weather/location` - Update tenant's weather location (Admin only)

## Next Tasks (Backlog)
1. **Minimum Staffing Alerts** - Shift notification alerts when stations fall below minimum staffing (P2)
2. **Decline Notifications** - Email and text notifications to on-duty BC when user declines assigned part-time shift (P2)

## Deployment Tracker Enhancements (August 2026)
- ✅ **Certification Expiration Tracking** - Track expiration dates for all certifications
  - TIFMAS: FF1, FF2, Crew Boss, Engine Boss, WPU, ASTL, Pack Test
  - EMTF: MIST, MedL, Tech-Spec, EMS Certification
  - Additional: HazMat, Rope Rescue, Swift Water, Driver/Operator
- ✅ **Certification Alerts Dashboard** - View expiring/expired certs with alert levels
  - Expired (red), Critical <30 days (dark red), Warning <90 days (amber), Upcoming (gray)
- ✅ **Fair Rotation Scheduler** - Auto-suggest next personnel based on:
  - Days since last deployment (more days = higher priority)
  - Deployments in last 12 months (fewer = higher priority)
  - Declined offers count (penalty for declines)
- ✅ **Decline Tracking** - Record when personnel decline deployment offers
- ✅ **Deployment History Log** - Complete history with filtering
  - Filter by type (TIFMAS/EMTF), status, date range, personnel name
  - Stats dashboard with yearly totals
  - Top deployers leaderboard
  - CSV export functionality
- ✅ **Files Created**:
  - `/app/frontend/src/components/deployment/CertificationManager.js` - Certification alerts and editor
  - `/app/frontend/src/components/deployment/RotationScheduler.js` - Fair rotation UI
  - `/app/frontend/src/pages/deployment-tracker/DeploymentHistoryPage.js` - History log page
- ✅ **API Endpoints**:
  - `GET /api/certifications/expiring?days=90` - Get expiring certifications
  - `PUT /api/deployment-roster/{id}/certifications` - Update certification details
  - `GET /api/deployment-roster/next-rotation/{type}` - Get rotation suggestions
  - `POST /api/deployment-roster/{id}/decline` - Record deployment decline
  - `GET /api/deployment-history` - List deployment history with filters
  - `POST /api/deployment-history` - Create new deployment record
  - `GET /api/deployment-history/stats` - Get deployment statistics

## Separate TIFMAS & EMTF Deployment Logs (December 2025)
- ✅ **TIFMAS Deployment Log** - Dedicated page for tracking TIFMAS (Texas Intrastate Fire Mutual Aid System) deployments
  - Route: `/personnel/deployment-tracker/tifmas-log`
  - Orange theme with flame icon
  - Shows 24 eligible TIFMAS-certified personnel
  - Fair rotation ordering: personnel who haven't deployed recently appear at top
  - Columns: Order, Name, Rank, EMS Level, Last TIFMAS Deploy, 12mo Deployments
  - Select personnel via checkboxes and deploy with incident details
- ✅ **EMTF Deployment Log** - Dedicated page for tracking EMTF (Emergency Medical Task Force) deployments
  - Route: `/personnel/deployment-tracker/emtf-log`
  - Blue theme with ambulance icon
  - Shows 26 eligible EMTF-certified personnel
  - Fair rotation ordering: separate from TIFMAS rotation
  - Columns: Order, Name, Rank, EMS Level, Last EMTF Deploy, 12mo Deployments
  - Select personnel via checkboxes and deploy with incident details
- ✅ **Fair Rotation Algorithm** - Personnel sorted by:
  1. Days since last deployment (more days = higher priority)
  2. Deployment count in last 12 months (fewer = higher priority)
  3. Declined offers count (penalty for declines)
- ✅ **Type-Specific Tracking** - TIFMAS and EMTF deployments tracked separately
  - Deploying on TIFMAS only affects TIFMAS rotation position
  - Deploying on EMTF only affects EMTF rotation position
- ✅ **Deployment Creation Flow**:
  - Select personnel via checkboxes
  - Click "Deploy Selected" to open deployment dialog
  - Enter incident name, location, start/end dates, notes
  - Confirm to create deployment record
  - Personnel automatically move down in rotation after deployment
- ✅ **Files Created**:
  - `/app/frontend/src/pages/deployment-tracker/TIFMASDeploymentLog.js` - TIFMAS log page
  - `/app/frontend/src/pages/deployment-tracker/EMTFDeploymentLog.js` - EMTF log page
- ✅ **Navigation**: Deployment Tracker submenu under Personnel includes TIFMAS Log and EMTF Log links

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

## Multi-Tenant SaaS Architecture (July 4, 2026)

### Phase 1: Database Foundation ✅
- ✅ Created `tenants` collection with id, name, subdomain, status, settings
- ✅ Added `tenant_id` field to ALL existing collections via migration script
- ✅ Migrated existing Medina County data to `tenant-medina-county` tenant
- ✅ Created database indexes for tenant_id on all collections
- ✅ Compound indexes for unique constraints within tenant (payroll_number, etc.)

### Phase 2: Backend Middleware & Auth ✅
- ✅ Updated `create_token()` to include tenant_id in JWT payload
- ✅ Added `get_tenant_id()` dependency for tenant-scoped queries
- ✅ Added `get_current_user_with_tenant()` for tenant context enforcement
- ✅ Added `require_super_admin()` dependency for super admin routes
- ✅ Super admin (100001) can manage all tenants
- ✅ `is_super_admin` flag in users collection

### Phase 3: Route Updates ✅ (Completed July 4, 2026)
- ✅ Updated ALL routes to filter by tenant_id
- ✅ Routes updated: `user_notifications_routes.py`, `volunteer_routes.py`, `parttime_routes.py`, `deployments_routes.py`, `notifications_routes.py`, `reports_routes.py`
- ✅ All database queries (find, update, insert, delete) now include tenant_id filtering
- ✅ Backfilled missing tenant_id in: deployment_roster, deployment_log, volunteer_records, part_time_availability, remarks
- ⏳ WebSocket connections scoped to tenant (pending)

### Phase 4: Platform Branding & Super Admin Enhancements ✅ (Completed July 4, 2026)
- ✅ Platform name: "BC Staffing" (main business name)
- ✅ Tenant naming convention: "[Fire Dept Name] BC Staffing"
- ✅ Updated existing tenant to "Medina County BC Staffing"
- ✅ Super Admin Tenant Viewer with:
  - View-Only Mode (read-only access to tenant data)
  - Full Impersonation Mode (full admin access for testing)
  - Data Preview dialog with tabs for Users, Personnel, Stations, Staffing, Overtime
  - Impersonation Banner shows when viewing/impersonating a tenant
  - Exit button to return to Super Admin

### Phase 4: Super Admin Dashboard ✅
- ✅ Super Admin Dashboard page (`/super-admin`)
- ✅ List all tenants with stats (users, stations)
- ✅ Create new tenant (with initial admin user)
- ✅ Activate/Deactivate tenants
- ✅ View tenant statistics (detailed counts)
- ✅ Access via Tools dropdown (purple link, only visible to super admins)

### Phase 4.5: Tenant Onboarding Wizard ✅ (Completed July 4, 2026)
- ✅ **Starter Templates** - 4 pre-configured templates:
  - Blank (Start from Scratch) - 0 battalions, 0 stations
  - Small Department - 1 battalion, 3 stations (10, 11, 12)
  - Medium Department - 2 battalions, 7 stations
  - Large Department - 3 battalions, 15 stations
- ✅ **Copy from Existing Tenant** - Clone structure from another fire department
- ✅ **Multi-Step Wizard UI** - 4 steps: Basic Info → Template Selection → Structure Customization → Review
- ✅ **Customizable Structure** - Add/edit/remove battalions and stations before creation
- ✅ **Apparatus Configuration** - Each template pre-populates appropriate apparatus per station
- ✅ **Admin Credentials** - Initial admin with temp password `changeme123` (must change on first login)
- ✅ **Success Screen** - Shows summary stats, admin credentials, and subdomain after creation
- ✅ **Preview as Admin Button** - Super Admins can immediately impersonate the new tenant's admin to verify setup before handing off credentials (July 13, 2026)
- ✅ **E2E Tested** - All 4 templates verified to correctly seed database (battalions, stations, apparatus, admin user)
- ✅ **Files Created**:
  - `/app/backend/tenant_templates.py` - Template definitions and configuration
  - `/app/frontend/src/components/admin/TenantOnboardingWizard.js` - 4-step wizard component with success screen

### New API Endpoints (Phase 4.5)
- `GET /api/tenants/templates` - List all available onboarding templates
- `GET /api/tenants/templates/{template_id}` - Get detailed template configuration
- `POST /api/tenants/onboard` - Create tenant with full onboarding configuration
- `GET /api/tenants/copy-source/{tenant_id}` - Get tenant config for copying

### Phase 5: WebSocket Tenant Scoping ✅ (Completed July 13, 2026)
- ✅ **Tenant-aware Connection Tracking** - WebSocket connections now store tenant_id from JWT
- ✅ **Scoped Broadcasts** - All broadcast methods (staffing, overtime, apparatus, volunteer, parttime, deployment) now accept and filter by tenant_id
- ✅ **Data Isolation** - Users in one tenant cannot receive real-time updates from other tenants
- ✅ **Anonymous Connections** - Unauthenticated WebSocket connections don't receive tenant-scoped broadcasts
- ✅ **Connection Status** - `get_status` action returns tenant-specific connection count
- ✅ **Files Updated**:
  - `/app/backend/websocket_manager.py` - Added tenant_id tracking to ConnectionManager
  - `/app/backend/routes/websocket_routes.py` - Extract tenant_id from JWT on connection
  - `/app/backend/routes/staffing_routes.py` - Pass tenant_id to all broadcast calls
  - `/app/backend/routes/overtime_routes.py` - Pass tenant_id to all broadcast calls
  - `/app/backend/routes/volunteer_routes.py` - Pass tenant_id to all broadcast calls

### Phase 6: Subdomain-Based Routing ✅ (Completed July 13, 2026)
- ✅ **Subdomain Detection** - `tenantUtils.js` extracts subdomain from URL automatically
- ✅ **Tenant Lookup API** - `GET /api/auth/tenant-by-subdomain/{subdomain}` returns tenant info
- ✅ **Scoped Login** - Login accepts optional `subdomain` parameter for strict tenant isolation
- ✅ **Dynamic Login Page** - Shows tenant name when in subdomain context
- ✅ **Dev Testing Tool** - `TenantSwitcher` component for testing subdomain routing in dev/preview
- ✅ **Production Nginx Config** - `nginx.conf.example` with wildcard subdomain routing
- ✅ **Tenant Status Check** - Suspended/inactive tenants blocked at login
- ✅ **Files Created/Updated**:
  - `/app/frontend/src/utils/tenantUtils.js` - Subdomain detection utilities
  - `/app/frontend/src/components/dev/TenantSwitcher.js` - Dev testing component
  - `/app/frontend/src/context/AuthContext.js` - Added tenant state and subdomain login
  - `/app/frontend/src/pages/LoginPage.js` - Dynamic tenant display
  - `/app/backend/routes/auth_routes.py` - Subdomain lookup and scoped login
  - `/app/backend/models.py` - Added subdomain to UserLogin model
  - `/app/nginx.conf.example` - Production nginx config template

### Production Deployment Notes (Phase 6)
1. Configure wildcard DNS: `*.bcstaffing.com` → Server IP
2. Obtain wildcard SSL certificate (Let's Encrypt with DNS-01 challenge recommended)
3. Deploy `/app/nginx.conf.example` to production nginx
4. Each tenant accesses via: `{subdomain}.bcstaffing.com`

### Phase 7: Future Enhancements - PENDING
- ⏳ Custom branding per tenant (logos, colors)
- ⏳ Tenant billing/subscription management
- ⏳ Tenant data export/backup

### Files Created
- `/app/backend/tenant_models.py` - Tenant Pydantic models
- `/app/backend/migrate_to_multitenant.py` - Migration script
- `/app/backend/routes/tenant_routes.py` - Tenant management API
- `/app/frontend/src/pages/admin/SuperAdminDashboard.js` - Super Admin UI

### New API Endpoints
- `GET /api/tenants` - List all tenants (Super Admin)
- `GET /api/tenants/{id}` - Get tenant details (Super Admin)
- `POST /api/tenants` - Create new tenant (Super Admin)
- `PUT /api/tenants/{id}` - Update tenant (Super Admin)
- `DELETE /api/tenants/{id}` - Deactivate tenant (Super Admin)
- `POST /api/tenants/{id}/activate` - Reactivate tenant (Super Admin)
- `GET /api/tenants/{id}/stats` - Get tenant statistics (Super Admin)

### Remaining Work for Full Multi-Tenancy
1. ~~Update ALL route handlers to filter queries by tenant_id~~ ✅ DONE
2. ~~Add tenant_id to new record creation~~ ✅ DONE
3. ~~Tenant Onboarding Wizard with templates~~ ✅ DONE
4. ~~Scope WebSocket connections by tenant~~ ✅ DONE (Phase 5)
5. ~~Add subdomain routing in production nginx config~~ ✅ DONE (Phase 6)
6. Test data isolation between tenants ✅ DONE (verified via API tests)

### User & Personnel Management Enhancements (July 15, 2026)
- ✅ **Rank-Based Sorting** - Users and personnel are now sorted by rank hierarchy first (Fire Chief → Captain → Lieutenant → Firefighter), then alphabetically by last name within each rank
- ✅ **First/Last Name Fields** - User creation form now has separate "First Name" and "Last Name" fields instead of a single "Full Name" field
- ✅ **User Selection in Personnel Management** - When adding personnel, users can select from a dropdown of existing user accounts to auto-populate demographics
- ✅ **Unified Rank Order** - Both User Management and Personnel Management use the same rank hierarchy including all variants (Chief, Part-Time, Volunteer)

### P3: Custom Tenant Branding ✅ (Completed July 18, 2026)
- ✅ **Branding Settings Page** - New page at `/tools/branding` accessible from Tools menu
- ✅ **Department Logo Upload** - Upload PNG, JPG, SVG, or WebP logos (max 2MB, stored as base64)
- ✅ **Color Customization** - Primary, Secondary, and Accent color pickers with hex input
- ✅ **Quick Presets** - 6 pre-designed color schemes:
  - Fire Red (default): #dc2626 / #1e3a5f / #f59e0b
  - Navy Blue: #1e40af / #0f172a / #3b82f6
  - Forest Green: #166534 / #14532d / #22c55e
  - Royal Purple: #7c3aed / #4c1d95 / #a78bfa
  - Slate Gray: #475569 / #1e293b / #94a3b8
  - Sunset Orange: #ea580c / #7c2d12 / #fb923c
- ✅ **Live Preview** - Real-time preview of how branding will look
- ✅ **Reset to Defaults** - One-click reset all branding to defaults
- ✅ **Backend Endpoints**:
  - `GET /api/tenants/branding` - Get current tenant branding
  - `PUT /api/tenants/branding` - Update branding settings
  - `POST /api/tenants/branding/reset` - Reset to defaults
- ✅ **Files Created**:
  - `/app/frontend/src/pages/tools/BrandingSettingsPage.js` - Full branding UI
  - Updated `/app/backend/routes/tenant_routes.py` - Branding endpoints
  - Updated `/app/backend/tenant_models.py` - TenantBrandingUpdate schema

### P1: Global Branding Application ✅ (Completed July 24, 2026)
- ✅ **BrandingContext** - New React context provides branding globally across the app
- ✅ **Login Page Background** - Tenant-specific background image on login page
- ✅ **Login Page Logo** - Tenant-specific transparent logo on login page
- ✅ **Login Button Colors** - Uses tenant's primary color
- ✅ **Navbar Branding** - Shows tenant logo and name in navbar
- ✅ **Navigation Active State** - Active nav links use tenant's primary color
- ✅ **CSS Variables** - `--brand-primary`, `--brand-secondary`, `--brand-accent` for consistent theming
- ✅ **Login Background Upload** - New field in Branding Settings to upload custom login background
- ✅ **Files Created/Updated**:
  - `/app/frontend/src/context/BrandingContext.js` - Global branding provider
  - Updated `/app/frontend/src/pages/LoginPage.js` - Dynamic background and logo
  - Updated `/app/frontend/src/components/layout/Navbar.js` - Tenant branding
  - Updated `/app/frontend/src/pages/tools/BrandingSettingsPage.js` - Login background upload
  - Updated `/app/backend/tenant_models.py` - Added login_background_url field
  - Updated `/app/backend/routes/tenant_routes.py` - Login background in branding endpoints

### Client Portal Login ✅ (Completed July 24, 2026)
- ✅ **Unified Client Login Page** - New `/client-login` route for tenant users accessing from landing page
- ✅ **Department Selector** - Step 1 shows searchable list of active departments with logos
- ✅ **Dynamic Branding** - Step 2 transforms to show selected tenant's branding (logo, background, colors)
- ✅ **Seamless Flow** - Single-page experience from department selection to login
- ✅ **Landing Page Integration** - "Client Portal" buttons added to header and hero section
- ✅ **Public Tenant List API** - `GET /api/tenants/public/list` returns active tenants for dropdown
- ✅ **Files Created/Updated**:
  - `/app/frontend/src/pages/ClientLoginPage.js` - Unified client login component
  - Updated `/app/frontend/src/pages/LandingPage.js` - Added Client Portal buttons
  - Updated `/app/frontend/src/App.js` - Added /client-login route
  - Updated `/app/backend/routes/tenant_routes.py` - Public tenant list endpoint


### Public Landing Page ✅ (Completed July 20, 2026)
- ✅ **Landing Page Component** - New page at `/` for unauthenticated visitors
- ✅ **BC Staffing Branding** - Displays company logo with white background removed using CSS `mix-blend-mode`
- ✅ **Service Description** - Data-driven solutions for Fire Departments, EMS, and Government Agencies
- ✅ **Feature Showcase** - 6 feature cards: Staffing Management, Overtime Tracking, Deployment Accountability, Reporting & Analytics, Role-Based Access, Real-Time Notifications
- ✅ **Login Navigation** - Multiple "Login" buttons (header, hero, CTA section) navigate to `/login`
- ✅ **Responsive Design** - Mobile-friendly layout with dark slate theme
- ✅ **Route Protection** - Authenticated users automatically redirected to `/dashboard`
- ✅ **Hero Background Slideshow** - Cycling/fading background images (5 fire department photos) with 6-second intervals and smooth 1-second transitions (July 22, 2026)
- ✅ **Files Created**:
  - `/app/frontend/src/pages/LandingPage.js` - Full landing page component
  - Updated `/app/frontend/src/App.js` - Added root route for landing page

### Platform Settings (Super Admin Visual Config) ✅ (Completed December 2025)
- ✅ **Platform Settings Page** - New page at `/platform-settings` for Super Admins
- ✅ **Global Logo Upload** - Upload platform-wide logo for main BC Staffing pages
- ✅ **Login Background Upload** - Custom background for main `/login` page
- ✅ **Hero Backgrounds** - Manage slideshow images for landing page hero section
- ✅ **Color Customization** - Primary, secondary, accent colors for main platform
- ✅ **Hero Text Settings** - Customize hero title, subtitle, description
- ✅ **Public Settings API** - `GET /api/platform/settings/public` serves settings to unauthenticated pages
- ✅ **Bug Fix: Settings Not Reflecting** - LoginPage.js and LandingPage.js now fetch from public API when not in tenant context (December 2025)
- ✅ **Files Created/Updated**:
  - `/app/frontend/src/pages/PlatformSettingsPage.js` - Platform settings UI
  - `/app/backend/routes/platform_routes.py` - Platform settings API endpoints
  - Updated `/app/frontend/src/pages/LoginPage.js` - Fetch platform settings for main login
  - Updated `/app/frontend/src/pages/LandingPage.js` - Fetch platform settings for landing page

### Landing Page Intro Video ✅ (Completed August 2026)
- ✅ **Video Upload** - Super Admin can upload intro video (MP4, WebM, OGG, MOV, max 50MB) via Platform Settings Intro Video tab
- ✅ **Direct Video Hosting** - Videos stored locally and served via `/api/platform/video/{filename}` endpoint
- ✅ **VideoIntro Component** - Full-screen video intro with:
  - Auto-play muted (required for browser autoplay policy)
  - Skip Intro button (appears after 1 second)
  - Progress bar indicator
  - Auto-transition to landing page after video ends
  - Graceful error handling (skips to landing page if video fails)
- ✅ **Replay on Refresh** - Video plays every time user visits/refreshes the landing page
- ✅ **No YouTube Branding** - Replaced YouTube embed with direct HTML5 video for clean, brandless experience
- ✅ **Streaming Support** - Backend serves video with proper streaming headers (Accept-Ranges, chunked transfer)
- ✅ **Files Created/Updated**:
  - `/app/frontend/src/components/VideoIntro.js` - Video intro component
  - Updated `/app/frontend/src/pages/LandingPage.js` - Integrates VideoIntro
  - Updated `/app/frontend/src/pages/PlatformSettingsPage.js` - Intro Video tab
  - Updated `/app/backend/routes/platform_routes.py` - Video upload/serve/delete endpoints


## Vacation Staffing Integration Fix (December 2025)
- ✅ **Shift-Filtered Vacation Counts** - Vacation leave records now only count against staffing for personnel on the current shift
  - B Shift vacation only affects B Shift staffing grid
  - A Shift vacation only affects A Shift staffing grid
  - Cross-shift filtering prevents incorrect staffing calculations
- ✅ **Vacation Notes in Remarks Panel** - Notes entered in Vacation Management now display in the Daily Worksheet's Remarks & Notes panel under the VACATION tab
  - Shows personnel name, rank, station, shift
  - Shows vacation date range
  - Shows the vacation notes text
  - Supports multiple vacation records per date
- ✅ **Proper Staffing Deduction** - Vacation now correctly deducts from:
  - Station VACATION (-) cell
  - Total Personnel On Duty calculation
  - Stations Even/Over/Under variance summary
- ✅ **Files Updated**:
  - `/app/frontend/src/components/dashboard/StaffingGrid.js` - Added currentShift filter to leaveCounts calculation
  - `/app/frontend/src/components/dashboard/RemarksPanel.js` - Added vacation notes display from leave records

## Leave Calendar View (December 2025)
- ✅ **Visual Calendar Overview** - New Leave Calendar page at `/battalion-chief/leave-calendar`
  - Monthly calendar grid showing all leave types across all personnel
  - Color-coded leave entries: Blue (vacation), Red (sick), Green (holiday)
  - Shift indicators (A/B/C) displayed on each calendar day
  - **24-Hour Shift Support**: Leave records show on shift START date only (not end date)
    - Example: Vacation Aug 17-18 (one 24hr shift) shows only on Aug 17
- ✅ **Filters** - Filter leave by:
  - Leave type (vacation, sick, holiday, or all)
  - Shift (A, B, C, or all)
  - Station assignment
- ✅ **Stats Dashboard** - Cards showing:
  - Vacation days count
  - Sick days count
  - Holiday days count
  - Total leave days
- ✅ **Day Detail Dialog** - Click any day to see:
  - All leave records for that date
  - Personnel name, rank, station, shift
  - Leave type and date range
  - Leave notes
- ✅ **Navigation** - Previous/Next month buttons and Today shortcut
- ✅ **Files Added/Updated**:
  - `/app/frontend/src/pages/battalion-chief/LeaveCalendarPage.js` - New calendar component
  - `/app/frontend/src/App.js` - Added route
  - `/app/frontend/src/components/layout/Navbar.js` - Added navigation link under Battalion Chief menu




## Leave Management Shift-Based Entry (December 2025)
- ✅ **On-Duty Shift Indicator** - Shows the working shift next to the date at the top of Vacation/Sick/Holiday Management pages
  - Color-coded badge: Red (A Shift), Green (B Shift), Blue (C Shift)
  - Updates dynamically when navigating dates
- ✅ **Shift-Filtered Personnel Entry** - Prevents mis-entry by filtering personnel dropdown:
  - User must select start date FIRST
  - Shows on-duty shift indicator with message "(Only X Shift personnel shown below)"
  - Personnel dropdown only shows members assigned to the on-duty shift
  - Changing start date clears personnel selection and updates available personnel
- ✅ **Applies to all leave types**: Vacation, Sick Leave, and Holiday Management
- ✅ **Files Updated**:
  - `/app/frontend/src/pages/battalion-chief/LeaveManagementPage.js` - Added shift indicator and filtered personnel logic


## Leave Deletion Sync Fix & Leave Balance Tracking (December 2025)
- ✅ **Bug Fix: Leave Deletion Now Syncs to Daily Worksheet**
  - Previously, deleting a leave record didn't update the Daily Worksheet - the vacation/sick/holiday count still showed
  - Fixed by calling `refreshGlobalLeaveRecords()` from StaffingContext after create/edit/delete operations
  - Daily Worksheet now immediately reflects leave record changes
- ✅ **Leave Balance Tracking** - New feature showing remaining leave days per employee:
  - "Show Balances" / "Hide Balances" toggle button on Vacation, Sick, and Holiday Management pages
  - Displays collapsible panel with personnel leave balances for the current year
  - Shows for each employee: Annual allocation, Days used, Days remaining
  - Progress bar visualizes usage percentage
  - Cards turn red when employee has used more than their allocation (negative balance)
  - Filters by on-duty shift for the selected date
- ✅ **Default Annual Allocations** (configurable per employee):
  - Vacation: 15 days/year
  - Sick: 12 days/year
  - Holiday: 11 days/year
- ✅ **24-Hour Shift Calculation**: Leave days counted as shift START dates only (end_date - start_date in days)
- ✅ **Files Updated**:
  - `/app/frontend/src/pages/battalion-chief/LeaveManagementPage.js` - Added balance tracking UI and global state sync
  - `/app/backend/routes/overtime_routes.py` - Added /leave-balances endpoint
  - `/app/backend/models.py` - Added annual allocation fields to PersonnelBase/Create/Update



## Leave Allocation Editor (December 2025)
- ✅ **Personnel Table Leave Column** - New "Leave Alloc." column in Personnel Management table
  - Shows compact V:X S:X H:X format (Vacation/Sick/Holiday days)
  - Color-coded badges: Blue (Vacation), Red (Sick), Green (Holiday)
- ✅ **Add/Edit Personnel Dialog** - "Annual Leave Allocation" section at bottom of form
  - Three number inputs for Vacation, Sick, Holiday days per year
  - Default values: 15 vacation, 12 sick, 11 holiday
  - Persists correctly on both Add and Edit operations
- ✅ **Integration with Leave Balances** - Custom allocations reflect in Leave Balances panel
  - When admin changes an employee's allocation, their balance updates accordingly
- ✅ **Files Updated**:
  - `/app/frontend/src/pages/tools/PersonnelManagementPage.js` - Added leave allocation state, form fields, table column, and fixed handleEditPersonnel to include allocation fields



## Leave Year Configuration (December 2025)
- ✅ **Fiscal Year Settings** - New Leave Year Configuration section on Branding Settings page
  - Configure custom fiscal year start date for leave tracking
  - Month and Day selectors for precise configuration
- ✅ **Quick Presets** - One-click buttons for common fiscal year patterns:
  - Calendar Year (January 1) - default
  - Federal FY (October 1)
  - Texas FY (July 1)
  - UK FY (April 1)
- ✅ **Dynamic Leave Year Calculation** - Backend calculates correct fiscal year period:
  - Properly handles fiscal years spanning two calendar years
  - Returns year label (e.g., "2025-2026" for Oct FY), year_start, year_end
  - Leave balances count records within the correct fiscal year period
- ✅ **Updated Leave Balances Display** - Shows fiscal year info:
  - Header displays fiscal year label (e.g., "2025-2026 Leave Balances")
  - Badge shows date range (e.g., "2025-10-01 to 2026-09-30")
- ✅ **Files Added/Updated**:
  - `/app/frontend/src/components/settings/LeaveYearSettings.js` - New component
  - `/app/frontend/src/pages/tools/BrandingSettingsPage.js` - Added LeaveYearSettings section
  - `/app/frontend/src/pages/battalion-chief/LeaveManagementPage.js` - Updated to show fiscal year info
  - `/app/backend/routes/tenant_routes.py` - Added /tenants/me and PUT /tenants/settings endpoints
  - `/app/backend/routes/overtime_routes.py` - Updated /leave-balances to use tenant fiscal year
  - `/app/backend/tenant_models.py` - Added leave_year_start_month, leave_year_start_day fields



## Leave Records Shift Filtering & 24-Hour Shift Logic Fix (December 2025)
- ✅ **On-Duty Shift Filtering** - Leave records now only show for personnel on the ON-DUTY shift:
  - Aug 17 (A Shift day) → Only shows A Shift personnel's leave
  - Aug 19 (B Shift day) → Only shows B Shift personnel's leave
  - No carryover when navigating between dates
- ✅ **24-Hour Shift Date Logic** - Consistent with Leave Calendar:
  - Leave record Aug 17-18 (single 24hr shift ending at 0600 Aug 18) → Shows ONLY on Aug 17
  - Leave record Aug 17-19 (two 24hr shifts) → Shows on Aug 17 AND Aug 18
  - End date is excluded because it represents shift end time (0600), not a full leave day
- ✅ **Applied to All Leave Types** - Vacation, Sick Leave, and Holiday Management all use same logic
- ✅ **Improved Empty State Message** - Shows "No {leave_type} records for {shift} Shift on {date}"
- ✅ **Fixed Data Loading Race Condition** - Leave records now wait for personnel to load before filtering
- ✅ **Files Updated**:
  - `/app/frontend/src/pages/battalion-chief/LeaveManagementPage.js` - Updated filteredRecords useMemo with shift filtering and 24hr logic



## Leave Hours Selection & Single-Day Display (December 2025)
- ✅ **Hours Dropdown** - Add/Edit dialogs now include hours selection:
  - Preset options: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24 hours (Full Shift)
  - Custom Hours option for any value (0.5-240 hours)
  - Default: 24 hours (full shift)
- ✅ **Single-Day Display** - 24 hours or less leave shows on ONE day only:
  - No rollover to the following calendar day
  - Even though shift is 0600-0600, displays as single calendar day
  - End Date field hidden for ≤24 hour leave (auto-set to start date)
- ✅ **Multi-Day Leave** - Hours > 24:
  - End Date field appears for selecting date range
  - Calculates display days based on hours (e.g., 48hrs = 2 days)
- ✅ **Table Updates**:
  - New "Hours" column with badge showing hours value
  - Date column shows single date for ≤24hr, date range for >24hr
- ✅ **Applied to All Leave Types** - Vacation, Sick, and Holiday Management
- ✅ **Files Updated**:
  - `/app/backend/models.py` - Added hours field to LeaveRecord (default 24.0)
  - `/app/frontend/src/pages/battalion-chief/LeaveManagementPage.js` - Added hours dropdown, custom hours input, single-day display logic



## Sick & Holiday Notes in Remarks Panel (December 2025)
- ✅ **SICK Tab Notes** - Sick leave notes now appear in SICK tab of Remarks & Notes panel
  - Header: "Sick Leave Notes from Leave Management"
  - Shows personnel name, station, shift badge, date, hours, and note text
- ✅ **HOLIDAY Tab Notes** - Holiday notes now appear in HOLIDAY tab of Remarks & Notes panel
  - Header: "Holiday Notes from Leave Management"
  - Shows personnel name, station, shift badge, date, hours, and note text
- ✅ **Consistent with VACATION** - All three tabs now work identically:
  - Vacation → "Vacation Notes from Leave Management"
  - Sick → "Sick Leave Notes from Leave Management"  
  - Holiday → "Holiday Notes from Leave Management"
- ✅ **Hours-Based Date Logic** - Notes only show on correct date using single-day display logic
- ✅ **Files Updated**:
  - `/app/frontend/src/components/dashboard/RemarksPanel.js` - Updated leaveNotes with hours-based logic, type-specific headers


