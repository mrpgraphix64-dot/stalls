# Reworkzone Stalls — Internal Operations Management System (V1 Architecture & Implementation Specification)

> **Document Type:** System Architecture & Implementation Blueprint for Autonomous AI Builder  
> **Target Scope:** Version 1 (MVP) Internal Operations Workspace  
> **Client / Business:** Reworkzone (`stalls.reworkzone.in`)  
> **Audience:** Development AI / Engineering Team  
> **Status:** Final Approved Specification (Baseline for Implementation)

---

## 1. Executive Summary & Objective

Reworkzone designs, fabricates, and installs bespoke exhibition stalls and pavilions across trade shows in India and internationally. Currently, stall project information—3D renders, working artwork, print-ready files, structural fabrication drawings, furniture orders, electrical requirements, and on-site handovers—is scattered across WhatsApp chats, email threads, and spreadsheets.

### The Objective
Build a lightweight, centralized, internal operations workspace where the Reworkzone event management team can track every exhibition from preparation through installation:
- **Hierarchy:** `Event / Exhibition` &rarr; `Stall / Booth` &rarr; `Detailed Modules` (Design, Print, Production, Furniture, Electrical, Checklist, Expenses, Drive Links).
- **Core Principle:** This is an **operations workspace**, not a complicated enterprise ERP/CRM. No complex role hierarchies, no payment gateways, no accounting engines, and no SMS/Email integrations.
- **File Management Principle (Google Drive Links Only):**
  - **No binary file uploads to the server:** Large design files (`.ai`, `.psd`, `.cdr`), 3D renders, and high-res print PDFs are hosted on Google Drive where the team already works.
  - The system saves and organizes **Google Drive URLs and metadata** (Main Folder + categorized links with explicit `is_final` approval flags). Google Drive manages file permissions, storage capacity, and bandwidth.
- **Access Model (6-Digit PIN Authentication):**
  - **Version 1 Scope:** Single shared Master account protected by a **6-Digit Security PIN**.
  - **No Default PIN in Repository:** No default PIN is hardcoded into the code or repository. The initial PIN is configured securely during installation / first-run setup.
  - **Future-Ready Schema:** The database schema includes a `role` column (`'master'` vs `'operations'`) so a second restricted account can be activated in the future without schema migrations, but **only the Master account is seeded or active in Version 1**.

---

## 2. Technical Architecture & Database

### Current Website Architecture & Database Context
The existing portfolio website (`stalls.reworkzone.in`) does **NOT** use PostgreSQL, MySQL, or any external database server:
- Enquiries are saved in a persistent CSV file (`enquiries.csv` in `../reworkzone_leads/`).
- Settings are saved in JSON (`smtp_config.json`).
- Admin access at `/admin` is protected by a simple PIN.

### The Management System Architecture: SQLite + Google Drive Links
To maintain zero maintenance, zero database hosting fees, and seamless compatibility with Hostinger:
- **Database:** **SQLite 3** (`reworkzone_stalls.sqlite` stored securely outside `public_html` in `../reworkzone_data/`).
  - Native in PHP (`pdo_sqlite`) and Node.js (`better-sqlite3` or `sqlite3`).
  - Single file database with full relational SQL capabilities, transactions, and foreign keys.
  - Zero daemon configuration, zero connection timeouts, instant backups by copying the single `.sqlite` file.
- **Backend:** Lightweight PHP REST API running directly on the existing Hostinger hosting (or lightweight Node.js service).
- **Frontend:** React 18 + Vite + Tailwind CSS mounted at `/manage/*`.
- **File Storage:** **Zero local server disk usage.** Replaced entirely with **Google Drive Link Management**. Each stall links to its primary Google Drive folder plus individual categorized links (Working Artwork, 3D Renders, Print-Ready PDFs, Photos).

```
                         [ Team Member Browser ]
                     (React + Tailwind UI at /manage/*)
                                     │
                             [ 6-Digit PIN Gate ]
                        (bcrypt/Argon2id + Lockout)
                                     │
                            [ Lightweight API ]
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
         [ SQLite Database File ]            [ Google Drive Links ]
      (../reworkzone_data/stalls.sqlite)     (Main Folder & File URLs)
```

| Component | Selected Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite + Tailwind CSS + Lucide Icons | Matches existing site aesthetics; fast, responsive mobile & desktop. |
| **Database** | SQLite 3 (`reworkzone_stalls.sqlite`) | **No PostgreSQL needed.** Single file, ACID compliant, native on Hostinger. |
| **Authentication** | 6-Digit PIN Session | Secure `password_hash()` (bcrypt/Argon2id) with server-side attempt limits. |
| **File Management** | **Google Drive Links Only** | **No server uploads.** Saves Drive URLs; team uses existing Google Drive storage. |
| **Notifications** | None | No email or SMS overhead. Pure internal dashboard. |

---

## 3. Database Schema (SQLite 3)

All entities use standard ISO-8601 string timestamps and text UUIDs.

```mermaid
erDiagram
    AUTH_ACCOUNTS ||--o{ ACTIVITY_LOGS : performs
    EVENTS ||--o{ BOOTHS : contains
    BOOTHS ||--o{ BOOTH_LINKS : references
    BOOTHS ||--o{ BOOTH_ITEMS : requires
    BOOTHS ||--o{ BOOTH_TASKS : tracks
    BOOTHS ||--o{ BOOTH_EXPENSES : incurs
    BOOTHS ||--o{ ACTIVITY_LOGS : records

    AUTH_ACCOUNTS {
        integer id PK
        string account_name
        string pin_hash
        string role
        integer is_active
        string last_login_at
    }

    EVENTS {
        string id PK
        string name
        string venue
        string city
        string start_date
        string end_date
        string setup_date
        string dismantling_date
        string coordinator_name
        string notes
        string status
        string created_at
        string updated_at
    }

    BOOTHS {
        string id PK
        string event_id FK
        string booth_number
        string client_name
        string client_contact_person
        string client_phone
        string client_email
        string dimensions
        real area_sqm
        string structure_type
        string main_drive_folder_url
        string installation_date
        string handover_date
        string status
        string special_instructions
        string last_edited_by
        string created_at
        string updated_at
    }

    BOOTH_LINKS {
        string id PK
        string booth_id FK
        string category
        string title
        string drive_url
        integer version
        integer is_final
        string notes
        string created_at
        string updated_at
    }

    BOOTH_ITEMS {
        string id PK
        string booth_id FK
        string category
        string item_name
        real quantity
        string unit
        string status
        string vendor_name
        string notes
        string updated_at
    }

    BOOTH_TASKS {
        string id PK
        string booth_id FK
        string task_name
        integer display_order
        integer is_completed
        string completed_at
        string completed_by
        string updated_at
    }

    BOOTH_EXPENSES {
        string id PK
        string booth_id FK
        string category
        string description
        real estimated_cost
        real actual_cost
        string vendor_name
        integer is_paid
        string notes
        string updated_at
    }

    ACTIVITY_LOGS {
        string id PK
        string booth_id FK
        string action_type
        string actor_label
        string description
        string created_at
    }
```

### Table Definitions (SQLite Schema)

#### 1. `auth_accounts` (PIN Account Schema)
- `id` (INTEGER PRIMARY KEY)
- `account_name` (TEXT NOT NULL) — e.g. "Master Admin"
- `pin_hash` (TEXT NOT NULL) — Hash generated using PHP `password_hash()` with `PASSWORD_BCRYPT` (cost 12) or `PASSWORD_ARGON2ID`
- `role` (TEXT NOT NULL DEFAULT 'master') — `'master'` (full access) or `'operations'` (restricted access)
- `is_active` (INTEGER DEFAULT 1)
- `last_login_at` (TEXT)

*V1 Account Seed:*
- **Only Account 1 (Master Admin) is seeded in Version 1.**
- No default PIN is written in this document or the repo. The initial PIN is prompted / configured on first run.
- Account 2 (`operations`) is not seeded in V1, but the table schema is ready for it when needed.

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
- `id` (TEXT PRIMARY KEY)
- `event_id` (TEXT NOT NULL, REFERENCES `events(id)` ON DELETE CASCADE)
- `booth_number` (TEXT NOT NULL) — e.g. "A01", "Hall 3 - E26"
- `client_name` (TEXT NOT NULL) — e.g. "MagnusMinds"
- `client_contact_person` (TEXT)
- `client_phone` (TEXT)
- `client_email` (TEXT)
- `dimensions` (TEXT) — e.g. "20 × 10 ft (6m × 3m)"
- `area_sqm` (REAL)
- `structure_type` (TEXT) — e.g. "3 sides open", "Corner", "Island Stand"
- `main_drive_folder_url` (TEXT) — **Google Drive Master Folder Link for this Stall**
- `installation_date` (TEXT)
- `handover_date` (TEXT)
- `status` (TEXT DEFAULT 'not_started') — `not_started`, `design_pending`, `in_production`, `installed`, `closed`
- `special_instructions` (TEXT)
- `last_edited_by` (TEXT)
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

#### 4. `booth_links` (Replaces File Uploads with Google Drive Links)
- `id` (TEXT PRIMARY KEY)
- `booth_id` (TEXT NOT NULL, REFERENCES `booths(id)` ON DELETE CASCADE)
- `category` (TEXT NOT NULL) — `client_assets`, `3d_design`, `artwork`, `print_ready`, `production`, `references`, `installation`
- `title` (TEXT NOT NULL) — e.g. "Front Fascia Approved Print PDF", "3D Stall Render V2", "Electrical Layout DWG"
- `drive_url` (TEXT NOT NULL) — Full Google Drive URL
- `version` (INTEGER DEFAULT 1) — Optional revision number
- `is_final` (INTEGER DEFAULT 0) — **0 = Draft, 1 = Final Approved Link.** *Rule:* New links always default to 0. An explicit user approval action is required to promote to 1.
- `notes` (TEXT) — e.g. "Approved by client on WhatsApp 9 Dec; CMYK 300 DPI"
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

#### 5. `booth_items`
- `id` (TEXT PRIMARY KEY)
- `booth_id` (TEXT NOT NULL, REFERENCES `booths(id)` ON DELETE CASCADE)
- `category` (TEXT NOT NULL) — `furniture`, `electrical`, `printing`, `structure`, `production`, `misc`
- `item_name` (TEXT NOT NULL) — e.g. "High Bar Stools", "Spotlights 50W", "Reception Counter"
- `quantity` (REAL NOT NULL DEFAULT 1)
- `unit` (TEXT DEFAULT 'pcs') — `pcs`, `sq ft`, `meters`, `sets`
- `status` (TEXT DEFAULT 'pending') — `pending`, `ordered`, `ready`, `dispatched`, `installed`
- `vendor_name` (TEXT)
- `notes` (TEXT)
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

#### 6. `booth_tasks` (Checklist)
- `id` (TEXT PRIMARY KEY)
- `booth_id` (TEXT NOT NULL, REFERENCES `booths(id)` ON DELETE CASCADE)
- `task_name` (TEXT NOT NULL)
- `display_order` (INTEGER DEFAULT 0)
- `is_completed` (INTEGER DEFAULT 0)
- `completed_at` (TEXT)
- `completed_by` (TEXT)
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

*Standard 10 Default Tasks:*
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
- `id` (TEXT PRIMARY KEY)
- `booth_id` (TEXT NOT NULL, REFERENCES `booths(id)` ON DELETE CASCADE)
- `category` (TEXT NOT NULL) — `printing`, `structure`, `furniture`, `electrical`, `transport`, `labor`, `other`
- `description` (TEXT NOT NULL)
- `estimated_cost` (REAL DEFAULT 0.0)
- `actual_cost` (REAL DEFAULT 0.0)
- `vendor_name` (TEXT)
- `is_paid` (INTEGER DEFAULT 0)
- `notes` (TEXT)
- `updated_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

#### 8. `activity_logs`
- `id` (TEXT PRIMARY KEY)
- `booth_id` (TEXT)
- `action_type` (TEXT)
- `actor_label` (TEXT) — e.g. "Master Admin"
- `description` (TEXT)
- `created_at` (TEXT DEFAULT CURRENT_TIMESTAMP)

---

## 4. 6-Digit PIN Authentication Flow & Security

```
[ User visits /manage ]
         │
         ▼
[ Is session active? ] ──► YES ──► [ Open Operations Dashboard ]
         │
        NO
         ▼
[ Show 6-Digit PIN Pad ]
  ┌───┬───┬───┐
  │ 1 │ 2 │ 3 │
  ├───┼───┼───┤
  │ 4 │ 5 │ 6 │
  ├───┼───┼───┤
  │ 7 │ 8 │ 9 │
  └───┴───┴───┘
         │
   [ Submits PIN ]
         │
         ▼
[ Verify via password_verify() ]
  └── Valid Master PIN ──► Create Secure Session (Role: 'master')
```

- **Clean keypad interface:** Numeric touch-pad for mobile and standard keyboard entry on desktop.
- **Auto-submission:** Submits automatically upon entering the 6th digit.
- **Server-Side Brute-Force Rate Limiting:**
  - Track consecutive failed attempts per IP / session in a transient log.
  - If 5 failed attempts occur within 10 minutes, lock out submissions from that client for 15 minutes.
- **Session Security:**
  - Encrypted, HttpOnly, SameSite=Lax cookie.
  - Session automatically expires after 7 days of inactivity.

---

## 5. Frontend UI & Routing Specifications

Route Prefix: `/manage/*`  
Theme: Clean, high-contrast, professional admin aesthetic matching Reworkzone brand (#111827 dark, #E53935 accent red, #FAF9F5 background).

```
/manage/login                 --> 6-Digit PIN Pad entry screen
/manage                       --> Operations Dashboard (KPI counters, active stalls, urgent tasks)
/manage/events                --> Events Directory (cards with dates, booth counts, status badges)
/manage/events/:id            --> Single Event Hub (overview + list of stalls in this event)
/manage/booths                --> Master Stalls Directory (searchable, filterable by event & status)
/manage/booths/:id            --> Stall Detail Command Center (8 interactive tabs)
  ├── Tab 1: Overview         (Client info, stall size, dates, Main Drive Folder button, progress circle)
  ├── Tab 2: Design           (3D renders Google Drive links, revision history)
  ├── Tab 3: Print            (Working AI/CDR/PSD links vs Approved Print-Ready PDF links)
  ├── Tab 4: Production       (Fabrication specs, dimensions, structural drawings Drive links)
  ├── Tab 5: Furniture        (Editable table: item, pcs, status, vendor)
  ├── Tab 6: Electrical       (Lights, power sockets, load specs, status)
  ├── Tab 7: Drive Links      (Complete Google Drive Link Library: Add Link, category filter, 1-click open)
  └── Tab 8: Checklist & Cost (10-step progress checklist + Estimated vs Actual expenses)
/manage/settings              --> PIN management & Server-Protected SQLite Backup Download (Master only)
```

### Google Drive Links UI & Approval Safety Rule
- **Main Drive Folder Card:** Prominent header button:  
  `[ 📁 Open Google Drive Master Folder ↗ ]`
- **Link Entry Form Modal:**
  - *Category:* Select from `Print Ready`, `3D Design`, `Working Artwork`, `Production`, `References`, `Installation`.
  - *Title:* e.g. "Approved Backwall Banner 6x3m (Print PDF)".
  - *Google Drive URL:* `https://drive.google.com/...`
  - *Version / Revision:* e.g. `v2`.
  - *Approval Safety Rule:* **All new links default to Draft (`is_final = 0`).** A separate, intentional click on "Approve for Print" is required to promote to `is_final = 1`.
  - *Notes:* Optional notes for printer or fabricator.
- **Visual Safety Badges:**
  - `is_final = 1`: Highlighted with an emerald badge **"APPROVED FOR PRINT"**.
  - `is_final = 0`: Highlighted with an amber badge **"WORKING DRAFT"**.

---

## 6. Security, Reliability & Hosting Architecture

### Hosting Environment & Deployment Safeguards
1. **Hosting Environment**: Hostinger Shared / Cloud Hosting running Apache 2.4 + PHP 8.x.
2. **Web Routing**: `.htaccess` handles SPA routing (`RewriteRule . /index.html [L]`) and routes `/admin` to `admin.php`.
3. **Git Deployment Behavior**: Hostinger Git integration runs `git reset --hard origin/main` on push. Any untracked files inside `public_html` are wiped on deploy.
4. **Persistent Storage Location**: The SQLite database MUST reside outside the deploy root in `../reworkzone_data/reworkzone_stalls.sqlite` with directory permissions `0755`.
5. **No Server Disk Overhead**: Because design and print files are stored as Google Drive links, server disk space is never consumed by large binaries.

### Security Hardening Guidelines
1. **PIN Security**:
   - Stored using PHP `password_hash()` with `PASSWORD_BCRYPT` (cost 12) or `PASSWORD_ARGON2ID`.
   - Rate limiting: 5 failed attempts $\rightarrow$ 15-minute lockout.
2. **Database Protection**:
   - Database file placed in `../reworkzone_data/`.
   - `.htaccess` rule added to deny direct HTTP requests to any database or backup file:
     ```apache
     <FilesMatch "\.(sqlite|db|csv|log|bak|env)$">
       Require all denied
     </FilesMatch>
     ```
3. **Consistent Backups & Server-Side Protected Download**:
   - Automated daily SQLite snapshot created via SQLite's safe backup API (`sqlite3_backup` or atomic transaction copy) stored in `../reworkzone_data/backups/`.
   - **Endpoint Security on Backup Download:** The backup download API endpoint (`/manage/api/backup.php`) **strictly validates server-side** that the session is authenticated and has `role === 'master'`. Unauthenticated or unauthorized requests receive `HTTP 403 Forbidden`.
   - **Offsite Redundancy:** The Master administrator can download the `.sqlite` snapshot locally with 1 click from `/manage/settings` to maintain an offsite copy.

---

## 7. Version 1 (MVP) vs Version 2 Boundaries

| Feature | Version 1 (Build First) | Version 2 (Future / Out of Scope) |
| :--- | :---: | :---: |
| 6-Digit PIN Authentication (Master Account Only) | ✅ Yes | — |
| Multi-Account Access (Operations Account) | Schema Ready | ✅ Role distinction activated |
| Event Creation & Scheduling | ✅ Yes | — |
| Booth Creation with 8 Tab Views | ✅ Yes | — |
| Main Google Drive Folder per Booth | ✅ Yes | — |
| Categorized Google Drive File Links | ✅ Yes | — |
| Explicit "Final" Link Approval Action | ✅ Yes | — |
| Furniture & Material Items Checklist | ✅ Yes | — |
| 10-Step Default Checklist with Auto % | ✅ Yes | — |
| Basic Costing (Estimated vs Actual) | ✅ Yes | — |
| Search & Multi-Filter by Event/Status | ✅ Yes | — |
| Responsive Mobile & Desktop Layout | ✅ Yes | — |
| Automated Daily SQLite Backups | ✅ Yes | — |
| Server-Protected 1-Click DB Backup Download | ✅ Yes (Master only) | — |
| Direct Server File Uploads | ❌ Removed | Replaced by Google Drive Links |
| Excel / CSV Export of Stall Summaries | ❌ Post-MVP | ✅ V2 |
| PDF Stall Handover Sheet Generation | ❌ Post-MVP | ✅ V2 |
| Reusable Stall Blueprint Templates | ❌ Post-MVP | ✅ V2 |
| Automated WhatsApp / SMS Notifications | ❌ Out of Scope | Not needed |

---

## 8. Recommended Implementation Order for Builder AI

The autonomous builder AI should execute the build following these **7 sequential steps**:

### Step 1: Inspect existing website, hosting setup, PHP version & admin auth
- Inspect the existing website structure, Hostinger Apache `.htaccess` rules, and PHP runtime.
- Verify that persistent storage path `../reworkzone_data/` is writable.
- Confirm zero modifications to the public portfolio landing page and `/send-enquiry.php`.

### Step 2: Create the SQLite database and secure PIN authentication
- Create SQLite database `reworkzone_stalls.sqlite` with the 8 relational tables (including `booth_links` and `main_drive_folder_url`).
- Seed **only the Master account**; prompt for or configure the initial PIN securely (no hardcoded PIN in repo).
- Build the PIN verification API endpoint with 5-attempt rate-limiting lockout and secure session cookies.

### Step 3: Build dashboard, event management, and booth management pages
- Build the `/manage` PIN gate UI (clean numeric keypad + keyboard support).
- Build the Dashboard overview with KPI tiles (Active Events, Total Booths, In Production, Pending Tasks).
- Build the Event management interface (create, list, edit event dates and venues).
- Build the Booth listing with event filtering, status badges, and search.

### Step 4: Add Google Drive links management, production, furniture, and electrical management
- Implement the Booth Details screen with the 8 interactive tabs.
- Build the **Main Google Drive Folder** input and 1-click redirect button.
- Build the **Google Drive Links Library** (`booth_links`) with category filtering (`Print Ready`, `3D Design`, `Working Artwork`, `Production`, `References`, `Installation`).
- Enforce the **Approval Safety Rule**: new links default to draft (`is_final = 0`); explicit button click required to promote to approved final link (`is_final = 1`).
- Build editable item tables for Furniture, Electrical, and Fabrication materials.

### Step 5: Implement checklists, costing, search, and activity logging
- Implement the 10-step progress checklist with auto-calculated percentage completion.
- Build the Costing module (Estimated vs. Actual table with auto-calculated difference).
- Implement activity logging (`activity_logs`) to track updates and changes.

### Step 6: Test permissions, drive links, mobile layout, backups, and complete workflow
- Test that unauthenticated users cannot access any `/manage` views or `/manage/api/*` endpoints.
- Test that the backup download endpoint strictly denies non-master access (`HTTP 403 Forbidden`).
- Verify that opening Google Drive links opens correctly in new tabs.
- Verify mobile responsiveness on venue/mobile screens for on-site checklist updates.
- Test SQLite daily backup creation and the 1-click **Download DB Backup** feature.

### Step 7: Deploy under `/manage` without disturbing the public website or enquiry system
- Mount `/manage` in the React frontend (or dedicated SPA bundle).
- Add `.htaccess` routing rules for `/manage` without affecting `/` or `/admin`.
- Run final production build and sync to repository root for seamless Hostinger Git deployment.
