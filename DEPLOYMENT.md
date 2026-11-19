# Deployment Guide for Reworkzone Stalls Portfolio & Management System

**Target Subdomain**: `https://stalls.reworkzone.in/`  
**Internal Operations System**: `https://stalls.reworkzone.in/manage`  
**Hosting Environment**: Hostinger Shared Web Hosting (Apache + PHP 8.2 + SQLite 3)  
**Document Root**: `/home/u131504528/domains/stalls.reworkzone.in/public_html`  
**Persistent Data**: `/home/u131504528/domains/stalls.reworkzone.in/reworkzone_data` (Outside `public_html`)  
**Leads Data**: `/home/u131504528/domains/stalls.reworkzone.in/reworkzone_leads` (Outside `public_html`)  

---

## 1. Hosting Architecture

The system operates seamlessly on Hostinger Web Hosting without requiring external database servers, VPS daemons, Node.js background services, or Docker:

- **Frontend:** React 18 + Vite SPA compiled into static assets in `assets/`, served via Apache root `index.html`.
- **Backend API:** Lightweight PHP endpoints in `manage/api/*.php` communicating via JSON.
- **Database:** Server-side file-based SQLite 3 database (`reworkzone_stalls.sqlite`) residing in `reworkzone_data/` strictly outside `public_html`.
- **Google Drive Integration:** All high-resolution artworks, 3D designs, print files, and photographs remain stored on Google Drive. The system manages categorized Drive URLs and explicit revision approval states.
- **Routing:** Handled via Apache `.htaccess` with SPA fallback for `/manage/*` and clean execution of `/manage/api/*.php`.
- **Security:** `.htaccess` actively returns `403 Forbidden` for all CLI scripts (`*cli.php`), internal helper files (`config.php`, `auth-helper.php`), and sensitive file extensions (`.sqlite`, `.db`, `.log`, `.csv`, `.env`).

---

## 2. Deployment Procedure

Hostinger Web Hosting deploys automatically via Git integration:

1. **Build Frontend Locally:**
   ```bash
   npm run build
   ```
   *Compiles TypeScript/Vite into `dist/` and synchronizes production assets, HTML, and `manage/` PHP endpoints directly to the repository root.*

2. **Commit and Push:**
   ```bash
   git add .
   git commit -m "Deploy: Live production release for Hostinger Web Hosting"
   git push origin main
   ```

3. **Deploy in Hostinger hPanel:**
   - In **hPanel** &rarr; **Advanced** &rarr; **Git**, click **Deploy** (or let automatic webhook deployment trigger).
   - Hostinger pulls `origin/main` into `/public_html`.
   - Existing inquiry leads (`reworkzone_leads/`) and the persistent SQLite database (`reworkzone_data/`) reside in the parent directory outside `public_html` and are never overwritten or deleted by Git pulls.

---

## 3. Master PIN Initialization

The operations management workspace is protected by a single 6-digit Master PIN.

1. **Initialization:**
   Run the CLI initializer once on the server or locally:
   ```bash
   php manage/init-cli.php
   ```
   *The prompt masks the PIN input. Once initialized, the Master account is created with Bcrypt hashing and the setup gate is permanently locked.*

2. **Updating PIN:**
   Any authenticated Master can update the PIN anytime at:
   `https://stalls.reworkzone.in/manage#/settings` &rarr; **Security & PIN**.
   *All existing events, booths, items, links, tasks, and costing data are 100% preserved.*

---

## 4. Backups & Disaster Recovery

- **1-Click Web Backup:** Navigate to **Settings** &rarr; **Download Database Backup** to download a live `.sqlite` snapshot.
- **Server CLI Backup:**
  ```bash
  php manage/backup-cli.php
  ```
  *Creates timestamped snapshots in `../reworkzone_data/backups/` with rolling 7-day retention.*
- **Restore Database:**
  ```bash
  php manage/backup-cli.php --restore=../reworkzone_data/backups/reworkzone_backup_YYYY-MM-DD_HHMMSS.sqlite
  ```
