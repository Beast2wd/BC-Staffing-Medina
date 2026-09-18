# Invention Disclosure — Fire Department Staffing Platform

Prepared for patent application intake. All answers below correspond to the intake questionnaire prompts.

---

## Q1. Please provide a short description (15 words max) of your invention. This will be your invention's title.

**Recommended title:**

A multi-tenant system for real-time fire department staffing, overtime, and deployment management.

**Alternative titles considered:**

- A system that automatically allocates fire personnel to shifts, overtime, and deployments.
- A staffing platform that triggers automated personnel notifications upon overtime and deployment assignment.
- A method for rotating fire personnel across overtime and deployment opportunities using tracked history.
- A cloud platform coordinating fire department daily staffing, leave, overtime, and emergency deployments.

---

## Q2. What problem does your invention solve? (Discuss only the problem.)

Fire departments must maintain minimum staffing at every station on every shift, yet the personnel available to fill those positions change constantly due to leave, injury, training, and external emergency deployments. The information officers need to manage these gaps is scattered across paper worksheets, spreadsheets, phone calls, and text messages, so staffing decisions are often made with incomplete or outdated information, and changes made by one officer are not visible to others.

Filling vacancies with overtime is especially error-prone. Availability is communicated informally, submissions are duplicated or lost, and there is no reliable record of who has been offered or assigned overtime, resulting in unequal distribution, disputes, and unfilled positions discovered too late.

Regional emergency deployments compound the problem, as departments must quickly identify qualified, rested personnel, share the burden fairly, and backfill the positions left vacant at home. Personnel frequently do not learn of an overtime or deployment assignment until reached individually by phone, causing delays and missed shifts.

Finally, existing tools are built for a single department and cannot be shared across agencies without exposing one department's data to another. Together, these conditions create a persistent risk of understaffed apparatus, delayed emergency response, and excessive administrative burden on command staff.

---

## Q3. In a few sentences, please describe how your invention solves the problem described above.

The invention is a cloud-based, multi-tenant platform that consolidates daily staffing, leave, overtime, and emergency deployment management into a single real-time system, so every officer views and edits the same live worksheet and changes made by one are instantly visible to all others. Personnel submit overtime availability directly through the platform, which enforces a single submission per person per day, records every offer and assignment, and tracks accumulated hours so that overtime is distributed equitably and vacancies are identified before they become critical. For regional deployments, the system maintains certification, rest, and deployment history for each member and applies a rotation score to identify qualified personnel while automatically flagging the home positions that must be backfilled. Upon any overtime or deployment assignment, the platform generates a structured event that is transmitted to a configurable notification service, delivering immediate email or text confirmation to the affected personnel without manual phone calls. Each participating department operates within an isolated tenant, allowing multiple agencies to share the same platform while ensuring that no department's personnel or operational data is accessible to another.

---

## Q4. In a sentence or two, please describe how your invention is different from and better than anything that exists in its field.

Unlike existing fire department scheduling tools such as Chief 360, which are single-agency systems focused on shift scheduling, alerting, and responder status, the invention unifies daily minimum-staffing worksheets, leave accruals, equitable overtime distribution, and regional deployment rotation in one real-time, multi-tenant platform, and automatically generates structured assignment events that trigger configurable notifications to personnel.

**Fuller alternative:**

Existing products such as Chief 360 are single-department scheduling and alerting systems that track who is on duty and fill open shifts, but they do not enforce overtime submission rules, score personnel for regional deployment rotation based on certification and deployment history, or expose the downstream staffing impact of leave and deployments on a live, collaboratively edited worksheet. The invention performs all of these functions within isolated tenants on a shared cloud platform, and emits standardized assignment events to an external automation service so that notification channels can be changed without modifying the core system — capabilities not present in the current field.

---

## Q5. In a sentence or two, explain the problems with the other devices or systems in the field of your invention.

Existing fire department software is designed for a single agency and centers on shift scheduling, alerting, and responder status, leaving daily minimum-staffing worksheets, leave accruals, overtime distribution, and regional deployment tracking to be managed in separate tools or by hand. Because these systems do not record overtime offers and assignments against a per-person history, do not evaluate personnel for deployment rotation based on certification and prior deployments, and cannot be shared across departments without exposing one agency's data to another, officers continue to make staffing decisions with fragmented information and personnel are still notified of assignments manually.

---

## Q6. In a sentence or two, explain why these devices or systems don't work well.

These systems don't work well because they treat staffing as a fixed schedule rather than a continuously changing balance between minimum coverage requirements and personnel who are unavailable due to leave, injury, or deployment, so the moment a change occurs the schedule no longer reflects reality and officers must reconcile the difference manually. In addition, because overtime availability, deployment eligibility, and leave balances are kept outside the system, they cannot enforce fairness rules or prevent duplicate and conflicting entries, and any change to how personnel are notified requires modifying the software itself rather than adjusting a configuration.

---

## Q7. In a sentence or two, describe how your invention improves on them.

The invention treats staffing as a live, continuously reconciled state rather than a static schedule: leave, overtime, and deployment records are stored in the same system as the daily worksheet and synchronized to every user in real time, so coverage gaps are exposed the moment they arise and the effect of any approval is immediately visible. It further improves on existing systems by enforcing structural rules — one overtime submission per person per day, tracked overtime hours, and a certification- and history-based deployment rotation score — within isolated tenants that let multiple departments share one platform, and by emitting standardized assignment events to an external automation service so notification channels can be added or changed through configuration rather than code.

---

## Q8. Items or Steps that Make Up Your Invention

Numbering corresponds to Fig. 1 (system architecture) and Fig. 2 (process flow).

### A. Physical / Infrastructure Elements (Fig. 1)

1. Client computing devices (desktop computers, tablets, and mobile phones) operated by department personnel
2. Web browser executing on each client device
3. Public network connection (Internet) between client devices and the hosting environment
4. Cloud hosting environment containing the application servers
5. Reverse proxy / ingress controller that routes incoming requests to the frontend server or the API server
6. Frontend web application server
7. Backend application programming interface (API) server
8. Document-oriented database server
9. Persistent object storage for uploaded files (logos, intro video, feedback attachments)
10. Bidirectional WebSocket channel maintained between each client and the API server
11. External automation/webhook service (e.g., Make.com) reachable over the network
12. External e-mail delivery service connected to the automation service
13. External SMS delivery service connected to the automation service
14. External weather data service
15. External speech-to-text transcription service

### B. Data Store Collections (within Item 8)

16. Tenant records, each containing a tenant identifier, subdomain, branding settings, and notification webhook configuration
17. User account records, each containing a payroll number, hashed password, role designation, and tenant identifier
18. Personnel records (name, rank, station, shift, battalion, contact e-mail, contact phone, certifications, leave balances, accrued overtime hours)
19. Battalion records (battalion number, name, chief)
20. Station records (station number, name, battalion, minimum staffing level, apparatus list, address)
21. Daily staffing records keyed by date, station, and shift
22. Apparatus assignment records
23. Leave records (vacation, sick, holiday) with date ranges
24. Leave accrual and PTO policy settings
25. Overtime records (personnel, date, hours, station, shift type, status of available / assigned / declined, contact information, notes)
26. Deployment roster records (eligibility flags, certifications with expiration dates, deployment counts, last deployment dates, rotation score)
27. Deployment records (personnel, deployment type such as TIFMAS or EMTF, start date, end date, location, created by)
28. Deployment history and import/rollback records
29. Part-time employee records and part-time availability records
30. Volunteer records and volunteer availability records
31. In-application notification records addressed to individual users
32. Webhook delivery log records (event identifier, event type, tenant, payload, HTTP status, timestamp)
33. Voice-feedback records with transcript and attachment references
34. Change log records

### C. Backend Software Modules (within Item 7)

35. Authentication module issuing and validating signed session tokens
36. Role-based authorization module (Super Admin, Admin, Battalion Chief, Captain, Lieutenant, Firefighter, Part-Time, Volunteer, Engineer/Driver-Operator)
37. Tenant-isolation module that appends the requesting user's tenant identifier to every database query and write
38. Staffing worksheet module
39. Personnel management module
40. Station and battalion management module
41. Leave and PTO accrual module
42. Overtime module, including a duplicate-submission check comparing personnel identifier and calendar date
43. Overtime duplicate-cleanup routine with status priority (assigned, then available, then declined)
44. Deployment module, including rotation-score calculation and roster bulk import with duplicate-name skipping
45. Part-time and volunteer availability module
46. Reports and export module (CSV and PDF generation)
47. In-application notification module
48. Webhook notification service that composes a structured event payload (event identifier, event type, tenant identifier, timestamp, data object) and transmits it by HTTP POST with retry
49. Webhook test routine that transmits a sample payload containing every field of both event types
50. WebSocket broadcast manager that pushes staffing and overtime changes to connected clients of the same tenant
51. Weather proxy module
52. Voice-feedback module with transcription and attachment handling (10 MB per file, up to 5 files)
53. Platform administration module (tenant creation, branding, intro video, per-tenant webhook settings)

### D. Frontend User Interface Components (within Item 6)

54. Public landing page
55. Tenant-branded login page
56. Daily Worksheet page with battalion selector and live connection indicator
57. On-Duty roster page
58. Overtime Availability page (self-service submission by personnel)
59. Battalion Chief Overtime page with Add Available, Send Notification, and Remove Duplicates controls
60. Deployment Tracker pages (roster, TIFMAS/EMTF deploy dialogs, history, import)
61. Personnel management pages
62. Station Management page with battalion toggle strip (pill selectors, previous/next arrows, and mouse-wheel cycling) and Add Battalion dialog
63. Leave and PTO pages
64. Part-Time and Volunteer availability pages
65. Reports page
66. Notifications page
67. Settings page
68. Super Admin dashboard with per-tenant Notification Settings dialog (webhook URL field, optional API key field, enabled toggle, Save, Test Webhook, and Delivery History tab)
69. Voice Feedback dashboard with in-browser recorder and waveform display
70. Weather widget with radar link

### E. Method Steps — Overtime Assignment and Notification Flow (Fig. 2)

71. Receiving an overtime availability submission from a client device
72. Verifying the submitting user's session token and role
73. Resolving the user's tenant identifier
74. Determining whether the submitter is the personnel member named in the submission or holds an officer role
75. Querying the overtime records for an existing record matching the same personnel identifier, tenant identifier, and calendar date
76. Rejecting the submission with a descriptive error when a match exists; otherwise storing the record with status "available"
77. Broadcasting the new record over the WebSocket channel to all connected clients of the same tenant
78. Receiving an officer's status change on an overtime record
79. Detecting a transition from a non-assigned status to "assigned"
80. Incrementing the personnel member's accumulated overtime hours
81. Creating an in-application notification for the personnel member
82. Resolving the personnel member's contact e-mail and phone, falling back to the contact information entered on the overtime record
83. Resolving the station name from the station identifier
84. Retrieving the tenant's webhook configuration and confirming it is enabled
85. Composing the structured event payload with event type "overtime.assigned"
86. Transmitting the payload to the tenant's webhook URL in a background task so the officer's request completes regardless of delivery outcome
87. Recording the delivery attempt, HTTP status, and any error in the webhook delivery log
88. Decrementing accumulated overtime hours when an assigned record is later declined or returned to available

### F. Method Steps — Deployment Creation Flow (Fig. 2, continued)

89. Receiving a deployment request naming one or more personnel, a deployment type, dates, and location
90. Creating a deployment record for each named personnel member within the tenant
91. Updating the deployment roster's last-deployment date and deployment count for the relevant deployment type
92. Composing and transmitting an event payload with event type "deployment.created" for each personnel member, per steps 82–87

### G. Method Steps — Tenant Webhook Configuration (Fig. 2, continued)

93. Authenticating a Super Admin user
94. Receiving and validating a webhook URL (HTTPS required) and optional API key for a selected tenant
95. Storing the configuration within that tenant's record
96. Transmitting a test payload on request and returning the HTTP result to the administrator

**Notes for the drawings:** Fig. 1 should show items 1–15 as boxes with items 16–34 inside the database box, 35–53 inside the API server box, and 54–70 inside the frontend box. Fig. 2 should be a flowchart of steps 71–96, with decision diamonds at steps 74, 75, 79, and 84.

---

## Q9. How do the components, steps or elements of your invention work individually and together to cause the whole invention to perform its desired function?

### 1. Infrastructure Layer — How the System Is Reached and Runs

A user opens a web browser (2) on any client device (1) and navigates to the platform's address over the Internet (3). The request arrives at the cloud hosting environment (4), where the reverse proxy (5) inspects the path. Requests for pages are routed to the frontend web server (6), which returns the single-page application; requests whose path begins with `/api` are routed to the backend API server (7). Once the application loads, the browser opens a persistent WebSocket connection (10) to the API server, which remains open for the life of the session and is used to push changes to the client without the client having to ask for them.

The API server (7) is the only component that communicates with the database (8) and object storage (9). All external services — the automation service (11), weather service (14), and transcription service (15) — are also reached only from the API server, never directly from the browser. This means every request passes through the authentication, authorization, and tenant-isolation modules described below before any data is read or written.

### 2. Authentication, Authorization, and Tenant Isolation — How Access Is Controlled

When a user submits a payroll number and password on the login page (55), the authentication module (35) looks up the user record (17), verifies the password against the stored hash, and returns a signed token containing the user's identifier, role, and tenant identifier. The browser attaches this token to every subsequent API request.

On each request, the authorization module (36) reads the role from the token and compares it with the roles permitted for that endpoint. For example, only Admin and Battalion Chief roles may run the duplicate-cleanup routine (43); only the Super Admin role may modify a tenant's webhook configuration (53); Firefighter and volunteer roles receive read-only access to the worksheet.

The tenant-isolation module (37) reads the tenant identifier from the same token and appends it as a mandatory filter to every database query and as a mandatory field to every database write. Because this happens inside the API server rather than in the browser, a user cannot request another tenant's records by altering a URL or request body. Two departments can therefore store personnel (18), stations (20), overtime (25), and deployment records (27) in the same database (8) while each sees only its own.

### 3. Data Model — How the Records Relate

The tenant record (16) is the root. Battalion records (19) belong to a tenant; station records (20) belong to a battalion and carry a minimum staffing level; personnel records (18) reference a home station, shift, and battalion. Daily staffing records (21) are keyed by date, station, and shift and reference the personnel filling each position. Leave records (23), overtime records (25), deployment records (27), part-time and volunteer availability (29, 30) all reference a personnel record and a date, which is what allows the system to compute, for any date, who is scheduled, who is unavailable, and where the gaps are.

The deployment roster record (26) holds the fields needed to rank a person for external deployment: eligibility flags for each program (TIFMAS, EMTF), individual certifications with expiration dates, the count and most recent date of prior deployments, and a computed rotation score. The webhook delivery log (32) is written by the webhook service (48) and read by the Super Admin dashboard (68), closing the loop between an assignment action and confirmation that the outside world was told about it.

### 4. Daily Worksheet — How Live Staffing Is Maintained

An officer opens the Daily Worksheet (56) and chooses a battalion with the battalion selector. The frontend requests the staffing records (21), stations (20), personnel (18), and leave records (23) for that battalion and date. The staffing module (38) returns them, and the page renders a grid of each station's positions, the personnel assigned, and whether the station meets its minimum staffing level.

When the officer edits a cell — assigning a person, marking a leave, or adding a remark — the frontend sends the change to the staffing module, which writes it to the database with the tenant identifier and then hands the change to the WebSocket broadcast manager (50). The manager looks up every open WebSocket connection (10) belonging to the same tenant and pushes the change to each. Any other officer viewing the same date sees the update within a fraction of a second without refreshing. The connection indicator on the worksheet shows whether this channel is live, so an officer knows whether they are looking at current data.

### 5. Overtime — How Vacancies Are Filled Fairly (Steps 71–88)

A firefighter opens the Overtime Availability page (58), selects a date, hours, and shift type, and submits. The request reaches the overtime module (42), which performs the following in order:

- It verifies the token (72) and resolves the tenant (73).
- It confirms the submitter is either the named personnel member or holds an officer role (74); otherwise the request is refused, so no one can submit availability on another person's behalf without authority.
- It queries the overtime records (25) for any existing record with the same personnel identifier, tenant identifier, and calendar date (75). If one exists, the module returns a descriptive error naming the person and date, and nothing is written (76). This single rule prevents the duplicate and conflicting entries that occur when availability is gathered by phone or text.
- If no duplicate exists, the record is stored with status "available" and broadcast to the tenant's connected clients (77), so the Battalion Chief Overtime page (59) updates immediately for every officer.

A Battalion Chief reviewing the Overtime page sees each available person's phone, regular station, shift, hours, and accumulated overtime hours from the personnel record (18). The accumulated-hours figure is what allows the officer to distribute overtime equitably. When the officer changes a record's status (78), the module compares the previous and new status (79). On a transition to "assigned" it increments the personnel record's accumulated overtime hours (80); on a later change from "assigned" back to "available" or to "declined" it decrements them (88), so the running total always reflects hours actually assigned.

The assignment also triggers two notifications. First, an in-application notification record (31) is created for the personnel member (81), which appears on their Notifications page (66). Second, the module resolves the person's contact e-mail and phone (82), taking them from the personnel record and falling back to the contact fields entered on the overtime submission if the personnel record is blank. It resolves the station name from the station identifier (83) so the message is human-readable, then hands this data to the webhook service described in section 7.

The duplicate-cleanup routine (43) exists for departments migrating existing records into the system. When an Admin or Battalion Chief clicks Remove Duplicates on the Overtime page, the routine groups the tenant's overtime records by personnel and date, and within each group retains the record with the highest-priority status (assigned first, then available, then declined), deleting the rest, so no confirmed assignment is ever lost to the cleanup.

### 6. Deployments — How Personnel Are Selected and Tracked (Steps 89–92)

For a regional deployment, an officer opens the Deployment Tracker (60). The deployment module (44) returns the roster (26) with each member's eligibility flags, certification status (including whether any certification has expired), pack-test level, count of deployments in the past twelve months, and rotation score. The rotation score is derived from deployment history so that members who have deployed least recently rank highest, which is how the burden is shared and how the officer avoids selecting someone already fatigued from a recent deployment.

The officer selects one or more members, a deployment type, dates, and location, and submits (89). For each member, the module writes a deployment record (27) carrying the tenant identifier (90), updates that member's roster record with the new last-deployment date and increments the deployment count for that program type (91) — which in turn changes their rotation score for the next selection — and passes the member's details to the webhook service with event type `deployment.created` (92).

Because deployment records reference personnel and dates, the staffing module (38) can show on the Daily Worksheet that the deployed member is absent from their home station on those dates, exposing the backfill requirement to the officer without a separate lookup.

The roster import routine within module (44) accepts a CSV file, compares each row's name against existing roster records for the tenant, skips exact duplicates, records what was imported, and stores a rollback record (28) so the import can be reversed as a unit if it was made in error.

### 7. Webhook Notification Service — How Personnel Are Told (Steps 84–87, 93–96)

The webhook service (48) is the bridge between an assignment inside the platform and a message reaching a person's phone or inbox. It operates as follows.

When called by the overtime or deployment module, it first retrieves the calling tenant's webhook configuration from the tenant record (16) and checks that a URL is present and the enabled flag is set (84). If not, it records a skipped delivery and returns; the assignment has already been saved, so the officer's action is unaffected.

If enabled, it composes a structured payload (85) with a fixed outer shape — a unique event identifier, an event type string (`overtime.assigned` or `deployment.created`), the tenant identifier, a timestamp, and a `data` object containing the personnel name, e-mail, phone, and the event-specific fields (date, hours, station, and approving officer for overtime; deployment type, dates, location, and creating officer for deployments). The fixed outer shape is what lets a single external scenario receive both event types and branch on `event_type`.

The service writes a delivery-log record (32) with status "sending", then transmits the payload by HTTP POST to the tenant's URL (86), including the optional API key as a header if one is configured. It retries on failure and records the final HTTP status, or the error, in the delivery log (87). This entire sequence runs as a background task after the API server has already responded to the officer, so a slow or failing external service never blocks or fails an overtime or deployment action.

On the receiving side, the external automation service (11) holds a scenario with a custom-webhook trigger at that URL. The scenario reads `event_type`, routes the payload to the appropriate branch, and maps `data.personnel_email` and `data.personnel_phone` into e-mail (12) and SMS (13) modules that deliver the message. Because the routing and message content live in the automation service's configuration, a department can add SMS, change e-mail providers, or alter message wording without any change to the platform's code.

Configuration is performed from the Super Admin dashboard (68). The Super Admin selects a tenant, opens Notification Settings, and enters the webhook URL and optional API key (94). The platform administration module (53) requires the URL to use HTTPS, stores the values in that tenant's record (95), and — on Test Webhook — the test routine (49) sends a sample payload containing every field of both event types (96). This lets the external scenario learn the complete data structure from a single test rather than waiting for real events to occur. The Delivery History tab reads the delivery log (32) filtered to that tenant, so the administrator can confirm each real event's outcome.

### 8. Leave, Part-Time, and Volunteer Modules — How Availability Feeds Staffing

The leave module (41) stores leave records (23) and applies the tenant's accrual policy (24) to maintain each personnel record's vacation, sick, and holiday balances. Because leave records share the personnel-and-date keying used by staffing records, the worksheet reflects an approved leave on the affected dates as soon as it is saved, and the balance shown to the approving officer is the balance after the approval.

The part-time and volunteer module (45) stores availability submitted by those members (29, 30). The scheduled hours of a part-time member are treated as worked hours, so a single record serves both the staffing view and the hours report without reconciliation.

### 9. Station and Battalion Management — How the Organization Is Modeled

On the Station Management page (62), an Admin creates battalions (19) and stations (20), setting each station's minimum staffing level and apparatus list. The battalion toggle strip at the top of the page is bound to the same battalion selection state used by the Daily Worksheet; selecting a battalion by pill, arrow, or mouse-wheel filters the station cards and table to that battalion and carries the selection over to the worksheet. The Battalions overview card queries all stations for the tenant, independent of the current selection, so counts per battalion remain accurate. A battalion cannot be deleted while stations reference it, which protects the integrity of the staffing records that depend on those stations.

### 10. Reports, Feedback, and Supporting Services

The reports module (46) queries the same collections described above and produces CSV and PDF outputs (roster reports, import history, overtime summaries) on the Reports page (65). The voice-feedback module (52) receives audio recorded in the browser on the Voice Feedback dashboard (69), stores it and any attachments in object storage (9), submits the audio to the transcription service (15), and stores the transcript with the feedback record (33). The weather proxy (51) retrieves forecasts and alerts from the weather service (14) on behalf of the browser and supplies them to the weather widget (70) on the worksheet, so officers planning staffing see conditions that may affect call volume or deployment requests.

### 11. How the Whole Performs Its Function

Taken together: every user action enters through one API server, is bound to a single tenant, and is written to a shared data model in which staffing, leave, overtime, and deployment records are all keyed by personnel and date. Because they share that keying, the Daily Worksheet can always show the true state of coverage, and the WebSocket manager ensures every officer sees that state at the same moment. The overtime module's duplicate check and hours tracking, and the deployment module's rotation score, encode fairness rules directly in the write path so that they cannot be bypassed. Finally, every assignment emits a standardized event to an externally configured notification pipeline and logs the outcome, so the person affected is informed automatically and the administrator can verify that they were. The result is that a department — or many departments on the same installation — can maintain minimum staffing, fill vacancies equitably, staff regional deployments, and notify personnel from one continuously accurate system rather than from fragmented records and manual calls.

---

## Filing Notes

- Keep the brand name out of the patent title; file a separate trademark application for the brand.
- Emphasize specific technical improvements (real-time WebSocket synchronization, rotation-scoring algorithm, event-driven notification pipeline, tenant isolation) in the detailed description to address subject-matter eligibility for software.
- Avoid subjective characterizations of competitors (e.g., "outdated"); rely on objective functional distinctions.
- Consider a provisional application first to establish a priority date, with 12 months to file the non-provisional.
