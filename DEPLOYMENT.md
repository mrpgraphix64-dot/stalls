# Deployment Guide for Reworkzone Stalls Portfolio

**Target Subdomain**: `stalls.reworkzone.in`  
**Architecture**: Fully standalone, static-optimized React + Vite + Tailwind application  
**Output Bundle**: `c:\Users\user\Downloads\TEchexpo\Web\dist`

---

## 1. Domain & DNS Configuration

To point `stalls.reworkzone.in` to this standalone website without touching or affecting the main `reworkzone.in` website:

1. Log in to your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap, Hostinger).
2. Add a new **CNAME** record:
   - **Type**: `CNAME`
   - **Name / Host**: `stalls`
   - **Target / Value**: `<your-hosting-target>` (e.g., `cname.vercel-dns.com` or `<project>.pages.dev` or `<project>.netlify.app`)
   - **TTL**: Auto or 3600
3. SSL will be automatically provisioned via Let's Encrypt / Cloudflare / Vercel.

---

## 2. Deployment Options

### Option A: Cloudflare Pages (Recommended for India & Global Speed)
1. Push the code to a Git repository (GitHub / GitLab) or run Cloudflare Wrangler.
2. In Cloudflare Dashboard → **Workers & Pages** → **Create Application** → **Pages**.
3. Connect your repository:
   - **Root directory**: `Web` (or repository root)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. In Custom Domains, add `stalls.reworkzone.in`.
5. Cloudflare will automatically route, provision SSL, and cache WebP images at edge POPs across India (Mumbai, Chennai, Delhi) and London.

### Option B: Vercel
1. Install Vercel CLI (`npm i -g vercel`) or import Git repository on [vercel.com](https://vercel.com).
2. Configure project settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. In Project Settings → **Domains**, add `stalls.reworkzone.in`.
4. Update DNS CNAME as instructed by Vercel.

### Option C: Netlify
1. Connect Git repository on [netlify.com](https://netlify.com).
2. Build command: `npm run build`
3. Publish directory: `dist`
4. The repository already includes `public/_redirects` which handles client-side routing.
5. In Domain Management, add `stalls.reworkzone.in`.

### Option D: Traditional VPS / Nginx Server
If hosting on your existing Linux/Nginx server:
1. Build the project locally or via CI:
   ```bash
   npm run build
   ```
2. Copy the contents of `dist/` to your server:
   ```bash
   scp -r dist/* user@your-server-ip:/var/www/stalls.reworkzone.in/html/
   ```
3. Nginx Server Block (`/etc/nginx/sites-available/stalls.reworkzone.in`):
   ```nginx
   server {
       listen 80;
       listen [::]:80;
       server_name stalls.reworkzone.in;
       return 301 https://$host$request_uri;
   }

   server {
       listen 443 ssl http2;
       listen [::]:443 ssl http2;
       server_name stalls.reworkzone.in;

       ssl_certificate /etc/letsencrypt/live/stalls.reworkzone.in/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/stalls.reworkzone.in/privkey.pem;

       root /var/www/stalls.reworkzone.in/html;
       index index.html;

       # Static asset caching
       location ~* \.(webp|jpg|jpeg|png|svg|ico|css|js)$ {
           expires 30d;
           add_header Cache-Control "public, no-transform";
       }

       # SPA routing fallback
       location / {
           try_files $uri $uri/ /index.html;
       }

       error_page 404 /404.html;
   }
   ```

---

## 3. Image Pipeline & Adding Future Projects

To add future exhibition stalls or expo photography:
1. Save high-resolution photography or 3D renders into a folder.
2. Update or run `process_and_manifest.py`:
   ```bash
   python process_and_manifest.py
   ```
   This will automatically:
   - Generate WebP thumbnails (`public/images/thumbs/`)
   - Generate optimized display images (`public/images/optimized/`)
   - Update `public/projectsManifest.json` and `src/data/projectsData.ts`
3. Rebuild the application:
   ```bash
   npm run build
   ```

---

## 4. Enquiry Form Handling

The lead enquiry form in `src/components/EnquirySection.tsx` is configured with:
- Web3Forms API endpoint connected to `info@reworkzone.in`.
- Direct one-click WhatsApp fallback with pre-formatted booth specifications (+91 84010 60482).
- Client-side validation, anti-spam honeypot, and loading/success confirmation cards.
