# Setup & Deployment Guide

This guide covers two paths: **running from source code** (for developers) and **installing the distributed binaries** (for end users).

---

## Prerequisites

### For Source Code Setup

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 LTS | [nodejs.org](https://nodejs.org) |
| npm | ≥ 10 | Included with Node.js |
| Git | Any | For cloning |
| Java JDK | 17 (Android build only) | [Adoptium](https://adoptium.net) |
| Android Studio | Latest (APK build only) | Includes Android SDK |

### For Binary Installation

| Component | Requirement |
|---|---|
| Windows EXE | Windows 10/11 64-bit |
| Android APK | Android 10+ (API 29+) |

---

## Part 1 — Desktop EXE

### Option A: Run from Source

```bash
# 1. Clone the repository
git clone https://github.com/your-org/hotel-checkin.git
cd hotel-checkin/desktop

# 2. Install dependencies
npm install

# 3. Download portable MariaDB
#    Place the MariaDB portable binaries in:
#    desktop/db-engine/  (structure below)
#
#    db-engine/
#    └── bin/
#        └── mysqld.exe
#
#    Download: https://downloads.mariadb.org (ZIP version, not installer)

# 4. Start in development mode
npm run dev
```

The app will open an Electron window. The embedded MariaDB starts automatically on port **3307** and the API server on port **8080**.

### Option B: Install the EXE

1. Download `HotelCheckIn-Setup-x.x.x.exe` from the Releases page.
2. Run the installer — no administrator rights required for user-space install.
3. The NSIS installer will:
   - Extract the portable MariaDB binaries
   - Create a Start Menu shortcut
   - Register a Windows Firewall rule for port 8080 (requires elevation prompt)
4. Launch **Hotel Check-In** from the Start Menu.

### First-Run Behaviour

```
App launch
    │
    ▼
Is db-engine/bin/mysqld.exe present?
    │
    ├── YES → Is userData/data/ initialized?
    │               │
    │               ├── YES → Start mysqld.exe (uses existing data)
    │               └── NO  → Run mysqld --initialize-insecure (first run)
    │
    └── NO → Show error: "Database engine missing"
         └── Re-run installer or manually place db-engine/
```

### Configuration Ports

| Service | Default Port | Configurable? |
|---|---|---|
| MariaDB | 3307 | Change in `db-launcher.ts` |
| API Server | 8080 | Auto-increments if busy |

> **Port 3307** is intentionally different from the MySQL default (3306) to avoid conflicts with any existing MySQL/MariaDB system installation.

---

## Part 2 — Android APK

### Option A: Build from Source (EAS / Local)

```bash
cd hotel-checkin/mobile

# 1. Install dependencies
npm install

# 2. Start Expo dev server (for testing on device via Expo Go)
npx expo start

# 3. Build production APK using EAS Build (free tier)
npm install -g eas-cli
eas login
eas build --platform android --profile preview

# OR build locally (requires Android Studio + SDK)
npx expo run:android --variant release
```

### Option B: Install the APK

1. Transfer `hotel-checkin-v1.0.0.apk` to the Android device.
2. On the device: **Settings → Install unknown apps** → allow from your file manager.
3. Open the APK file and install.

> **Required Android Permissions:**
> - `CAMERA` — guest portraits and ID capture
> - `INTERNET` — server communication
> - `READ/WRITE_EXTERNAL_STORAGE` — image handling

---

## Part 3 — Pairing the Mobile App to the Desktop

### Method 1: QR Code (Recommended)

1. On the desktop app, navigate to the **Pairing** tab.
2. A QR code is displayed showing the server URL.
3. On the mobile app, tap **Server Pairing → Scan QR**.
4. Point the camera at the desktop QR code.
5. The app will auto-configure and test the connection.

### Method 2: Manual URL

1. On the desktop, note the IP shown: e.g. `192.168.1.15:8080`.
2. On the mobile app, tap **Server Pairing → Manual URL**.
3. Enter: `http://192.168.1.15:8080`
4. Tap **Test & Save**.

---

## Part 4 — Wide Area Network (WAN) Setup

For APKs connecting from a different network (e.g. a remote branch):

### Option A: Tailscale (Easiest — 100% Free)

```
1. Install Tailscale on the Windows desktop machine:
   https://tailscale.com/download/windows

2. Install Tailscale on each Android device:
   Google Play → "Tailscale"

3. Sign in with the same account on all devices.

4. On the desktop, find your Tailscale IP (e.g. 100.x.x.x):
   Tailscale tray icon → "Copy IP Address"

5. On each mobile device, use the Tailscale IP as the server URL:
   http://100.x.x.x:8080
```

### Option B: DuckDNS + Port Forwarding

```
1. Go to https://duckdns.org → create a free account.
2. Register a subdomain, e.g. "myhotellib.duckdns.org".
3. Install DuckDNS update client on the desktop machine to keep
   the domain pointing to your router's current public IP.

4. On your router admin page:
   - Add a Port Forward rule:
     External Port: 8080  →  Internal IP: 192.168.1.15  Port: 8080

5. On each mobile device, use:
   http://myhotellib.duckdns.org:8080
```

> ⚠️ Port forwarding exposes your API to the internet. Consider adding
> an API token (configurable in server settings) for additional security.

---

## Part 5 — Data Backup

All data is stored in the Windows `userData` directory:

```
C:\Users\<YourUser>\AppData\Roaming\hotel-checkin-desktop\
├── data\          ← MariaDB data files (the actual database)
├── storage\
│   ├── portraits\   ← Guest portrait JPEGs
│   └── id-proofs\   ← ID document JPEGs
```

**To back up:** Copy the entire `hotel-checkin-desktop` folder to an external drive or NAS.

**To restore:** Replace the folder contents before launching the app.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| App opens but "DB Error" shown | MariaDB binary missing | Re-run installer or place `db-engine/` folder |
| API server not reachable from mobile | Windows Firewall blocking port 8080 | Run installer (adds firewall rule) or add rule manually |
| QR scan fails | Mobile not on same network | Use Tailscale or DuckDNS instead |
| "Connection Failed" on pairing | Wrong IP or port | Check desktop Pairing tab for correct URL |
| Check-ins not syncing | Server was offline when check-in was made | Open Queue screen — items sync automatically when server restarts |
| MariaDB port conflict | Another MySQL on 3307 | Change port in `db-launcher.ts` and rebuild |
