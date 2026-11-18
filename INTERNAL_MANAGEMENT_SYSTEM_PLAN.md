# Reworkzone Stalls — Internal Operations Management System (V1 Architecture & Implementation Specification)

> **Document Type:** System Architecture & Implementation Blueprint for Autonomous AI Builder  
> **Target Scope:** Version 1 (MVP) Internal Operations Workspace  
> **Client / Business:** Reworkzone (`stalls.reworkzone.in`)  
> **Audience:** Development AI / Engineering Team  
> **Status:** Approved for Implementation (No coding in this spec turn; implementation to follow this exact schema)

---

## 1. Executive Summary & Objective

Reworkzone designs, fabricates, and installs bespoke exhibition stalls and pavilions across trade shows in India and internationally. Currently, stall project information—3D renders, working artwork, print-ready files, structural fabrication drawings, furniture orders, electrical requirements, and on-site handovers—is scattered across WhatsApp chats, email threads, and spreadsheets.

### The Objective
Build a lightweight, centralized, internal operations workspace where the Reworkzone event management team can track every exhibition from preparation through installation:
- **Hierarchy:** `Event / Exhibition` &rarr; `Stall / Booth` &rarr; `Detailed Modules` (Design, Print, Production, Furniture, Electrical, Checklist, Expenses, Files).
- **Core Principle:** This is an **operations workspace**, not a complicated enterprise ERP/CRM. No complex role hierarchies, no payment gateways, no accounting engines, and no SMS/Email integrations.
- **Access Model (6-Digit PIN Authentication):**
  - **Phase 1 (Current):** Single shared account protected by a **6-Digit Security PIN** (e.g. `840106`).
  - **Phase 2 (Future-Ready):** Structured for **two accounts / PINs**:
    - **Master / Admin PIN:** Full access to all events, booths, files, checklists, and costing/financials.
    - **Operations / Staff PIN:** Restricted access (can view booths, upload files, update checklist tasks and furniture/electrical items, but cannot view costing/expenses or delete events).

---

## 2. Technical Architecture & Database

### Current Website Architecture & Database Context
The existing portfolio website (`stalls.reworkzone.in`) does **NOT** use PostgreSQL, MySQL, or any external database server:
- Enquiries are saved in a persistent CSV file (`enquiries.csv` in `../reworkzone_leads/`).
- Settings are saved in JSON (`smtp_config.json`).
- Admin access at `/admin` is protected by a simple PIN.

### The Management System Architecture: SQLite
To maintain zero maintenance, zero database hosting fees, and seamless compatibility with Hostinger:
- **Database:** **SQLite 3** (`reworkzone_stalls.sqlite` stored securely outside `public_html` in `../reworkzone_data/`).
  - Native in PHP (`pdo_sqlite`) and Node.js (`better-sqlite3` or `sqlite3`).
  - Single file database with full relational SQL capabilities, transactions, and foreign keys.
  - Zero daemon configuration, zero connection timeouts, instant backups by copying the single `.sqlite` file.
- **Backend Options:**
  - **Option 1 (PHP REST API / Native Hostinger):** Zero extra server or VPS required. Runs directly on the current Hostinger shared hosting using lightweight PHP endpoints (`/api/events.php`, `/api/booths.php`, etc.).
  - **Option 2 (Node.js / Express or NestJS on VPS):** Runs on Node.js using SQLite.
- **Frontend:** React 18 + Vite + Tailwind CSS mounted at `/manage/*`.
- **File Storage:** Private folder on disk (e.g. `../reworkzone_data/booth_files/`) served through authenticated streaming scripts. No public URLs.

```
                         [ Team Member Browser ]
                     (React + Tailwind UI at /manage/*)
                                     │
                             [ 6-Digit PIN Gate ]
                                     │
                            [ Lightweight API ]
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
         [ SQLite Database File ]            [ Private Storage ]
      (../reworkzone_data/stalls.sqlite)     (../reworkzone_data/files/)
```

| Component | Selected Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite + Tailwind CSS + Lucide Icons | Matches existing site aesthetics; fast, responsive mobile & desktop. |
| **Database** | SQLite 3 (`reworkzone_stalls.sqlite`) | **No PostgreSQL needed.** Single file, ACID compliant, native on Hostinger. |
| **Authentication** | 6-Digit PIN Session | Simple, frictionless team access. Expandable to 2 accounts later. |
| **File Storage** | Private Disk Storage | Stored outside public root, accessed via auth session. |
| **Notifications** | None | No email or SMS overhead. Pure internal dashboard. |

---

## 3. Database Schema (PostgreSQL)

Every entity uses UUIDv4 primary keys and standard audit timestamps (`created_at`, `updated_at`).

```mermaid
erDiagram
    USERS ||--o{ ACTIVITY_LOGS : performs
    USERS ||--o{ EVENTS : coordinates
    USERS ||--o{ BOOTH_FILES : uploads
    EVENTS ||--o{ BOOTHS : contains
    BOOTHS ||--o{ BOOTH_FILES : stores
    BOOTHS ||--o{ BOOTH_ITEMS : requires
    BOOTHS ||--o{ BOOTH_TASKS : tracks
    BOOTHS ||--o{ BOOTH_EXPENSES : incurs
    BOOTHS ||--o{ ACTIVITY_LOGS : records

    USERS {
        uuid id PK
        string full_name
        string email UK
        string password_hash
        string phone
        string avatar_url
        boolean is_active
        timestamp created_at
        timestamp updated_at
    }

    EVENTS {
        uuid id PK
        string name
        string venue
        string city
        date start_date
        date end_date
        date setup_date
        date dismantling_date
        uuid coordinator_id FK
        text notes
        string status
        timestamp created_at
        timestamp updated_at
    }

    BOOTHS {
        uuid id PK
        uuid event_id FK
        string booth_number
        string client_name
        string client_contact_person
        string client_phone
        string client_email
        string dimensions
        numeric area_sqm
        string structure_type
        date installation_date
        date handover_date
        string status
        text special_instructions
        uuid created_by FK
        uuid last_edited_by FK
        timestamp created_at
        timestamp updated_at
    }

    BOOTH_FILES {
        uuid id PK
        uuid booth_id FK
        string category
        string file_name
        string file_path
        integer file_size_bytes
        string mime_type
        integer version
        boolean is_final
        text notes
        uuid uploaded_by FK
        timestamp created_at
    }

    BOOTH_ITEMS {
        uuid id PK
        uuid booth_id FK
        string category
        string item_name
        numeric quantity
        string unit
        string status
        string vendor_name
        text notes
        timestamp updated_at
    }

    BOOTH_TASKS {
        uuid id PK
        uuid booth_id FK
        string task_name
        integer display_order
        boolean is_completed
        timestamp completed_at
        uuid completed_by FK
        timestamp updated_at
    }

    BOOTH_EXPENSES {
        uuid id PK
        uuid booth_id FK
        string category
        string description
        numeric estimated_cost
        numeric actual_cost
        string vendor_name
        boolean is_paid
        text notes
        timestamp updated_at
    }

    ACTIVITY_LOGS {
        uuid id PK
        uuid user_id FK
        uuid booth_id FK
        string action_type
        text description
        jsonb metadata
        timestamp created_at
    }
```

### Table Definitions (SQLite Schema)

#### 1. `auth_accounts` (Simple 6-Digit PIN Accounts)
- `id` (INTEGER PRIMARY KEY)
- `account_name` (TEXT NOT NULL) — e.g. "Primary Admin", "Operations Team"
- `pin_hash` (TEXT NOT NULL) — SHA256 / bcrypt hash of the 6-digit PIN
- `role` (TEXT NOT NULL DEFAULT 'master') — `'master'` (full access) or `'operations'` (restricted: cannot view expenses or delete records)
- `is_active` (INTEGER DEFAULT 1)
- `last_login_at` (TEXT)

*Initial Seed:*
- Account 1: Role `'master'`, 6-digit PIN (e.g. `840106`).
- Account 2 (Ready for future activation): Role `'operations'`, 6-digit PIN (e.g. `898000`).

#### 2. `events`
- `id` (TEXT PRIMARY KEY) — UUIDv4 or nanoId
- `name` (TEXT NOT NULL) — e.g. "Tech Expo 2026"
- `venue` (TEXT NOT NULL) — e.g. "Exhibition Centre, Ahmedabad"
- `city` (TEXT NOT NULL)
- `start_date` (TEXT NOT NULL) — ISO format YYYY-MM-DD
- `end_date` (TEXT NOT NULL)
- `setup_date` (TEXT NOT NULL)
- `dismantling_date` (TEXT NOT NULL)
- `coordinator_name` (TEXT) — e.g. "Chintan", "Rahul"
- `notes` (TEXT)
- `status` (TEXT DEFAULT 'upcoming') — `upcoming`, `in_progress`, `completed`, `archived`
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

#### 3. `booths`
- `id` (UUID, PK)
- `event_id` (UUID, FK &rarr; `events.id`, ON DELETE CASCADE, NOT NULL)
- `booth_number` (VARCHAR(50), NOT NULL) — e.g. "A01", "Hall 3 - E26"
- `client_name` (VARCHAR(200), NOT NULL) — e.g. "MagnusMinds"
- `client_contact_person` (VARCHAR(150))
- `client_phone` (VARCHAR(30))
- `client_email` (VARCHAR(255))
- `dimensions` (VARCHAR(100)) — e.g. "20 × 10 ft (6m × 3m)"
- `area_sqm` (DECIMAL(8,2))
- `structure_type` (VARCHAR(100)) — e.g. "3 sides open", "Corner", "Island Stand", "Double Decker"
- `installation_date` (DATE)
- `handover_date` (DATE)
- `status` (VARCHAR(50), Default: `'not_started'`)
  - Permitted Statuses: `not_started`, `design_pending`, `in_production`, `installed`, `closed`
- `special_instructions` (TEXT)
- `created_by` (UUID, FK &rarr; `users.id`)
- `last_edited_by` (UUID, FK &rarr; `users.id`)
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### 4. `booth_files`
- `id` (UUID, PK)
- `booth_id` (UUID, FK &rarr; `booths.id`, ON DELETE CASCADE, NOT NULL)
- `category` (VARCHAR(50), NOT NULL)
  - Categories: `client_assets`, `3d_design`, `artwork`, `print_ready`, `production`, `references`, `installation`
- `file_name` (VARCHAR(255), NOT NULL) — Original filename
- `file_path` (TEXT, NOT NULL) — Internal storage path (e.g. `storage/events/{event_id}/{booth_id}/{category}/{uuid}.pdf`)
- `file_size_bytes` (BIGINT, NOT NULL)
- `mime_type` (VARCHAR(100), NOT NULL)
- `version` (INT, Default: 1)
- `is_final` (BOOLEAN, Default: `false`) — **Crucial:** separates draft artwork from final approved printer files
- `notes` (TEXT)
- `uploaded_by` (UUID, FK &rarr; `users.id`)
- `created_at` (TIMESTAMPTZ)

#### 5. `booth_items`
- `id` (UUID, PK)
- `booth_id` (UUID, FK &rarr; `booths.id`, ON DELETE CASCADE, NOT NULL)
- `category` (VARCHAR(50), NOT NULL)
  - Categories: `furniture`, `electrical`, `printing`, `structure`, `production`, `misc`
- `item_name` (VARCHAR(200), NOT NULL) — e.g. "High Bar Stools", "Spotlights 50W", "Reception Counter", "Vinyl Banner 3x8ft"
- `quantity` (DECIMAL(8,2), NOT NULL, Default: 1)
- `unit` (VARCHAR(30), Default: `'pcs'`) — `pcs`, `sq ft`, `meters`, `sets`
- `status` (VARCHAR(30), Default: `'pending'`) — `pending`, `ordered`, `ready`, `dispatched`, `installed`
- `vendor_name` (VARCHAR(150), NULLABLE)
- `notes` (TEXT)
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### 6. `booth_tasks` (Checklist)
- `id` (UUID, PK)
- `booth_id` (UUID, FK &rarr; `booths.id`, ON DELETE CASCADE, NOT NULL)
- `task_name` (VARCHAR(255), NOT NULL)
- `display_order` (INT, Default: 0)
- `is_completed` (BOOLEAN, Default: `false`)
- `completed_at` (TIMESTAMPTZ, NULLABLE)
- `completed_by` (UUID, FK &rarr; `users.id`, NULLABLE)
- `updated_at` (TIMESTAMPTZ)

*Standard 10-Step Default Seed for Every New Booth:*
1. Client details confirmed
2. Design approved
3. Print files finalized
4. Printing completed
5. Structure fabricated
6. Furniture arranged
7. Electrical items ready
8. Material dispatched
9. Stall installation completed
10. Final handover completed

#### 7. `booth_expenses` (Costing)
- `id` (UUID, PK)
- `booth_id` (UUID, FK &rarr; `booths.id`, ON DELETE CASCADE, NOT NULL)
- `category` (VARCHAR(50), NOT NULL) — `printing`, `structure`, `furniture`, `electrical`, `transport`, `labor`, `other`
- `description` (VARCHAR(255), NOT NULL)
- `estimated_cost` (DECIMAL(12,2), Default: 0.00)
- `actual_cost` (DECIMAL(12,2), Default: 0.00)
- `vendor_name` (VARCHAR(150))
- `is_paid` (BOOLEAN, Default: `false`)
- `notes` (TEXT)
- `created_at` / `updated_at` (TIMESTAMPTZ)

#### 8. `activity_logs`
- `id` (UUID, PK)
- `user_id` (UUID, FK &rarr; `users.id`, NULLABLE)
- `booth_id` (UUID, FK &rarr; `booths.id`, ON DELETE CASCADE, NULLABLE)
- `action_type` (VARCHAR(50)) — e.g. `booth_created`, `file_uploaded`, `status_changed`, `item_updated`
- `description` (TEXT) — Human-readable text (e.g. "Rahul Sharma marked Print files finalized as completed")
- `metadata` (JSONB)
- `created_at` (TIMESTAMPTZ, Default: `NOW()`)

---

## 4. RESTful API Endpoint Specifications

Base Path: `/api/v1`  
Authentication: Bearer JWT in `Authorization` header or secure HttpOnly cookie.

### Authentication & Team
- `POST /api/v1/auth/login` — `{ email, password }` &rarr; `{ token, user }`
- `GET /api/v1/auth/me` — Return current logged-in user profile
- `POST /api/v1/auth/logout` — Invalidate session
- `GET /api/v1/team` — List all team members
- `POST /api/v1/team` — Invite / add a team member

### Events
- `GET /api/v1/events` — Query: `?status=upcoming|in_progress&search=tech`
- `POST /api/v1/events` — Create exhibition record
- `GET /api/v1/events/:id` — Event details + summary stats (total stalls, progress %)
- `PUT /api/v1/events/:id` — Update event dates, venue, notes
- `DELETE /api/v1/events/:id` — Archive / soft-delete event

### Booths (The Core Entity)
- `GET /api/v1/booths` — Query: `?eventId=uuid&status=in_production&search=query`
- `POST /api/v1/booths` — Create stall under an event (auto-seeds 10 default checklist tasks)
- `GET /api/v1/booths/:id` — Full booth bundle: client details, tabs data, checklist %
- `PUT /api/v1/booths/:id` — Update booth information or main status
- `POST /api/v1/booths/:id/duplicate` — Duplicate booth structure/item lists for a sister stall

### Booth Files (Private File Storage)
- `GET /api/v1/booths/:id/files` — List files grouped by category (`client_assets`, `3d_design`, `artwork`, `print_ready`, etc.)
- `POST /api/v1/booths/:id/files` — Multipart form upload (`file`, `category`, `version`, `is_final`, `notes`)
- `GET /api/v1/files/:fileId/download` — Stream file with proper MIME type & content disposition (authentication required)
- `PATCH /api/v1/files/:fileId/set-final` — Toggle `is_final` flag (automatically unmarks previous final files in the same category)
- `DELETE /api/v1/files/:fileId` — Remove file

### Items (Furniture, Electrical, Print, Production)
- `GET /api/v1/booths/:id/items` — Query: `?category=furniture|electrical|printing`
- `POST /api/v1/booths/:id/items` — Add item (`category`, `item_name`, `quantity`, `unit`, `status`, `vendor_name`)
- `PATCH /api/v1/items/:itemId` — Inline update status (`pending`, `ready`, etc.) or quantity
- `DELETE /api/v1/items/:itemId` — Remove item

### Checklist & Tasks
- `GET /api/v1/booths/:id/tasks` — List checklist tasks ordered by `display_order`
- `PATCH /api/v1/tasks/:taskId/toggle` — Toggle completion (updates `is_completed`, `completed_at`, `completed_by`)
- `POST /api/v1/booths/:id/tasks` — Add custom task to booth
- `PUT /api/v1/booths/:id/tasks/reorder` — Update task sequence

### Costing & Expenses
- `GET /api/v1/booths/:id/expenses` — Returns list + computed totals:
  $$\text{Total Estimated}, \quad \text{Total Actual}, \quad \text{Difference} = \text{Actual} - \text{Estimated}$$
- `POST /api/v1/booths/:id/expenses` — Add expense line item
- `PATCH /api/v1/expenses/:expenseId` — Update expense item
- `DELETE /api/v1/expenses/:expenseId` — Delete expense

### Activity & Dashboard Summary
- `GET /api/v1/dashboard/stats` — Quick counts: Active Events, Total Booths, In Production, Pending Tasks
- `GET /api/v1/activity-logs` — Recent operations audit feed

---

## 5. Frontend UI & Routing Specifications

Route Prefix: `/manage/*`  
Theme: Clean, high-contrast, professional admin aesthetic matching Reworkzone brand (#111827 dark, #E53935 accent red, #FAF9F5 background).

```
/manage/login                 --> Clean team authentication screen
/manage                       --> Operations Dashboard (KPI counters, active stalls, urgent tasks)
/manage/events                --> Events Directory (cards with dates, booth counts, status badges)
/manage/events/:id            --> Single Event Hub (overview + list of stalls in this event)
/manage/booths                --> Master Stalls Directory (searchable, filterable by event & status)
/manage/booths/:id            --> Stall Detail Command Center (8 interactive tabs)
  ├── Tab 1: Overview         (Client info, stall size, dates, completion progress circle)
  ├── Tab 2: Design           (3D renders, reference images, revision logs)
  ├── Tab 3: Print            (Working AI/CDR/PSD vs Approved Print-Ready PDFs)
  ├── Tab 4: Production       (Fabrication specs, dimensions, structural drawings)
  ├── Tab 5: Furniture        (Editable table: item, pcs, status, vendor)
  ├── Tab 6: Electrical       (Lights, power sockets, load specs, status)
  ├── Tab 7: Files            (Complete file library with drag-and-drop upload)
  └── Tab 8: Checklist & Cost (10-step progress checklist + Estimated vs Actual expenses)
/manage/settings              --> Team member accounts & profile
```

### UI Components & Wireframe Guidelines
1. **Completion Bar & Circular Metric:**
   - Automatically derived from checklist:
     $$\text{Progress \%} = \left(\frac{\text{Completed Tasks}}{\text{Total Tasks}}\right) \times 100$$
2. **File Versioning & Safety Badges:**
   - Any file with `is_final: true` is highlighted with an emerald badge: **"APPROVED FOR PRINT"**.
   - Working artwork files display an amber badge: **"WORKING DRAFT"**.
   - Prevents accidental dispatch of old or unfinished artwork to print vendors.
3. **Editable Items Table:**
   - Single-click status pill change (e.g. clicking `Pending` turns it to `Ready` with immediate visual feedback).
4. **Mobile Responsive:**
   - On-site team members at the exhibition venue can check off tasks and upload installation photos directly from mobile browsers.

---

## 6. Security, Reliability & Hosting Inspection

### Existing Hosting & Runtime Inspection Results
1. **Hosting Environment**: Hostinger Shared / Cloud Hosting running Apache 2.4 + PHP 8.x.
2. **Web Routing**: `.htaccess` handles SPA routing (`RewriteRule . /index.html [L]`) and routes `/admin` to `admin.php`.
3. **Git Deployment Behavior**: Hostinger Git integration runs `git reset --hard origin/main` on push. Any untracked files inside `public_html` are wiped on deploy.
4. **Persistent Storage Pattern**: All persistent files (SQLite DB, uploaded client assets, enquiry CSV) MUST reside outside the deploy root in `../reworkzone_data/` (or `../reworkzone_leads/`), with automatic directory creation and permission checks (`0755`).

### Security Hardening Guidelines
1. **SQLite Database Protection**:
   - Location: `../reworkzone_data/reworkzone_stalls.sqlite` (physically inaccessible from the web).
   - `.htaccess` rule added to block any `.sqlite`, `.db`, or `.bak` files if placed locally:
     ```apache
     <FilesMatch "\.(sqlite|db|csv|log|bak|env)$">
       Require all denied
     </FilesMatch>
     ```
2. **6-Digit PIN Authentication Security**:
   - PINs are hashed using PHP `password_hash()` or SHA-256 with server-side salt.
   - Rate limiting / lock: After 5 incorrect attempts, lock out submissions for 15 minutes to prevent brute-force attacks.
   - Session tokens stored in secure, `HttpOnly`, `SameSite=Lax` cookies.
3. **Private File Storage & Streaming**:
   - Uploaded working design files (`.ai`, `.cdr`, `.psd`) and high-res print PDFs are stored with obfuscated unique names in `../reworkzone_data/booth_files/{event_id}/{booth_id}/`.
   - File downloads are served via an authenticated streaming script with proper `Content-Type` and `Content-Disposition: attachment; filename="original_name.pdf"`. No direct public URLs.
4. **Automated SQLite Backups**:
   - A lightweight daily snapshot rotates the last 7 daily copies in `../reworkzone_data/backups/`.
5. **Zero Disruption Guarantee**:
   - The public website (`/`, `/#portfolio`, `/#builder`, `/send-enquiry.php`) and existing lead intake remain 100% untouched.

---

## 7. Version 1 (MVP) vs Version 2 Boundaries

| Feature | Version 1 (Build First) | Version 2 (Future / Out of Scope) |
| :--- | :---: | :---: |
| 6-Digit PIN Authentication (1 Account) | ✅ Yes | — |
| Multi-Account Access (2 Accounts: Master vs Ops) | Ready in DB | ✅ Role distinction activated |
| Event Creation & Scheduling | ✅ Yes | — |
| Booth Creation with 8 Tab Views | ✅ Yes | — |
| Categorized File Uploads & Versions | ✅ Yes | — |
| Approved "Final" File Flagging | ✅ Yes | — |
| Furniture & Material Items Checklist | ✅ Yes | — |
| 10-Step Default Checklist with Auto % | ✅ Yes | — |
| Basic Costing (Estimated vs Actual) | ✅ Yes | — |
| Search & Multi-Filter by Event/Status | ✅ Yes | — |
| Responsive Mobile & Desktop Layout | ✅ Yes | — |
| Automated SQLite Daily Backups | ✅ Yes | — |
| Excel / CSV Export of Stall Summaries | ❌ Post-MVP | ✅ V2 |
| PDF Stall Handover Sheet Generation | ❌ Post-MVP | ✅ V2 |
| Reusable Stall Blueprint Templates | ❌ Post-MVP | ✅ V2 |
| Centralized Inventory Stock Accounting | ❌ Out of Scope | Not needed |
| Automated WhatsApp / SMS Notifications | ❌ Out of Scope | Not needed |

---

## 8. Recommended Implementation Order for Builder AI

The autonomous builder AI should execute the build following these **7 sequential steps**:

### Step 1: Inspect existing website, hosting setup, PHP version & admin auth
- Inspect the existing website structure, Hostinger Apache `.htaccess` rules, and PHP runtime.
- Verify that persistent storage path `../reworkzone_data/` is writable.
- Confirm zero modifications to the public portfolio landing page and `/send-enquiry.php`.

### Step 2: Create the SQLite database and secure PIN authentication
- Create SQLite database `reworkzone_stalls.sqlite` with the 8 relational tables.
- Seed the initial Master 6-Digit PIN account (and configure the schema for the 2nd Operations PIN).
- Build the PIN verification API endpoint and session management with brute-force rate limiting.

### Step 3: Build dashboard, event management, and booth management pages
- Build the `/manage` PIN gate UI (clean numeric keypad + keyboard support).
- Build the Dashboard overview with KPI tiles (Active Events, Total Booths, In Production, Pending Tasks).
- Build the Event management interface (create, list, edit event dates and venues).
- Build the Booth listing with event filtering, status badges, and search.

### Step 4: Add design uploads, print files, production, furniture, and electrical management
- Implement the Booth Details screen with the 8 interactive tabs.
- Implement file upload with category tagging (`client_assets`, `3d_design`, `artwork`, `print_ready`, etc.).
- Add the version tracker and the **"Mark as Approved Print File"** (`is_final`) toggle.
- Build editable item tables for Furniture, Electrical, and Fabrication materials.

### Step 5: Implement checklists, costing, search, and activity logging
- Implement the 10-step progress checklist with auto-calculated percentage completion.
- Build the Costing module (Estimated vs. Actual table with auto-calculated difference).
- Implement activity logging (`activity_logs`) to track updates and changes.

### Step 6: Test permissions, file security, mobile layout, backups, and complete workflow
- Test that unauthenticated users cannot access any `/manage` views or `/api/manage/*` endpoints.
- Test that uploaded files cannot be accessed via direct browser URL.
- Verify mobile responsiveness on venue/mobile screens for on-site checklist updates and photo uploads.
- Test SQLite backup creation in `../reworkzone_data/backups/`.

### Step 7: Deploy under `/manage` without disturbing the public website or enquiry system
- Mount `/manage` in the React frontend (or dedicated SPA bundle).
- Add `.htaccess` routing rules for `/manage` without affecting `/` or `/admin`.
- Run final production build and sync to repository root for seamless Hostinger Git deployment.
