# SyncStay — Technical Operating Guide

This document provides a detailed breakdown of the technical components, database structures, networking parameters, and maintenance operations of the **SyncStay** ecosystem.

---

## 💾 1. Database Architecture & Schema

SyncStay utilizes **SQLite** for data management. 
*   **Desktop:** SQLite is executed via `sql.js` (pure WebAssembly) to avoid native C++ build dependencies on Windows. Because `sql.js` operates in-memory, the desktop application exports the database buffer and writes it back to disk on every database write (`dbRun`).
*   **Mobile:** The offline queue and cached room data are managed using React Native `AsyncStorage`.

### Schema SQL DDL

```sql
-- Represents rooms within the hotel facility
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL DEFAULT 'Standard',
  floor INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK(status IN ('available','occupied','maintenance','checkout')),
  price_per_night REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Represents guest stay groups/bookings
CREATE TABLE IF NOT EXISTS booking_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_reference TEXT NOT NULL UNIQUE,
  check_in_time TEXT NOT NULL DEFAULT (datetime('now')),
  check_out_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'checked_in'
    CHECK(status IN ('checked_in','checked_out','cancelled')),
  notes TEXT,
  id_proof_path TEXT, -- Stores file path of the group ID proof image
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Represents individual guests within a booking group
CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES booking_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  age INTEGER,
  sex TEXT CHECK(sex IN ('male','female','other')),
  photo_path TEXT, -- Stores file path of guest profile image on desktop disk
  is_primary_contact INTEGER NOT NULL DEFAULT 0
);

-- Many-to-many relationship mapping booking groups to room allocations
CREATE TABLE IF NOT EXISTS room_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL REFERENCES booking_groups(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  allocated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(room_id, group_id)
);
```

### Schema Evolution & Migrations
On startup, `applyMigrations()` in `desktop/src/main/db.ts` programmatically inspects table schemas using `PRAGMA table_info` and applies delta modifications:
1.  **`guests.phone`**: Added to enable guest-specific contact tracking.
2.  **`booking_groups.id_proof_path`**: Added to accommodate scans of passports/Aadhaar cards on a per-stay group basis.

---

## 📂 2. File Storage & Paths (Windows)

All persistent assets are saved relative to the Electron application's `userData` folder. On Windows, this directory maps to:

```text
%APPDATA%\SyncStay\
```
*(Equivalent to `C:\Users\<username>\AppData\Roaming\SyncStay\`)*

### Directory Inventory

| File / Folder Path | Type | Description |
|---|---|---|
| `%APPDATA%\SyncStay\syncstay.db` | File | The persistent SQLite binary database file. |
| `%APPDATA%\SyncStay\config.json` | File | Contains persistent configuration details, including API pairing token and setup flags. |
| `%APPDATA%\SyncStay\app.log` | File | Runtime output log capturing `console.log`, warnings, and crash reports. |
| `%APPDATA%\SyncStay\photos\` | Folder | Directory hosting all uploaded document images and guest profile images. |

---

## 📡 3. Network Configuration & Pairing Protocol

The mobile assistant couples with the desktop app over a local area network (LAN).

```
 ┌────────────────┐          QR Code Scan           ┌─────────────────┐
 │   Mobile App   │  ─────────────────────────────>  │   Desktop App   │
 │ (AsyncStorage) │  ◄─────────────────────────────  │ (Express + LAN) │
 └────────────────┘         REST API Calls          └─────────────────┘
```

### Pairing Payload (QR Code)
The desktop application generates a setup QR code encoding a JSON payload:
```json
{
  "url": "http://192.168.1.15:8080",
  "token": "d748f2c3d52c1e4d..."
}
```
*   **IP Resolution:** The desktop app queries `os.networkInterfaces()`, prioritizing local home subnets (`192.168.x.x` and `10.x.x.x`) to bypass virtual VPN card adapters.
*   **Port Selection:** The Express server starts on port `8080` by default. If blocked, it increments ports (`8081`, `8082`, etc.) using a socket check routine.
*   **Firewall Automation:** During installation, an NSIS script triggers PowerShell to register a Windows Firewall rule:
    `netsh advfirewall firewall add rule name=SyncStay-API dir=in action=allow protocol=TCP localport=8080`
    If not installed (e.g. run in development), the app requests UAC elevation to apply the rule on boot.

---

## 🔌 4. API Endpoints Reference

The Express server listens on all network interfaces (`0.0.0.0`) to accept connections from mobile clients.

### Security & Authentication
*   **Bearer Auth:** Except for the `/api/health` check, every API route checks for the header:
    `Authorization: Bearer <token>`
*   **Token Rotation:** The pairing token is randomly generated using 24 cryptographically secure bytes on setup. It can be rotated via the desktop settings panel, which breaks connection with paired mobile devices.

### REST Endpoints Summary

| Endpoint | Method | Security | Payload / Response |
|---|---|---|---|
| `/api/health` | GET | Public | `{ "status": "ok", "ts": "2026-06-22..." }` |
| `/api/rooms` | GET | Bearer | Returns all rooms with current occupants and active bookings. |
| `/api/rooms/available` | GET | Bearer | Returns rooms currently set to `"available"`. |
| `/api/bookings` | GET | Bearer | Returns list of check-in history. |
| `/api/stats` | GET | Bearer | Returns occupancy metrics and active booking counts. |
| `/api/photos/upload` | POST | Bearer | Accepts base64 images; writes jpeg file to `/photos` and returns absolute path. |
| `/api/checkin` | POST | Bearer | Creates booking group, assigns rooms, registers guests, updates room status. |

---

## 🔄 5. Offline Sync Lifecycle

SyncStay uses a strict offline-first paradigm for the mobile check-in assistant.

```
                  Start Check-In
                         │
              ───────────────────────
             /                       \
        Is Online?               Is Offline?
           /                           \
          ▼                             ▼
 Upload images directly          Buffer images to base64
          │                             │
 Submit REST Check-in            Store in AsyncStorage
          │                             │
      All Done                      Sync later
```

### Sync Mechanisms
1.  **Direct Mode (Online):** 
    *   The app uploads guest photos and document scans to `/api/photos/upload`.
    *   The API returns server file paths.
    *   The check-in payload is sent to `/api/checkin` containing references to these paths.
2.  **Queued Mode (Offline):**
    *   If a request times out (8-second window) or the network is unreachable, `smartCheckin` catches the error.
    *   The complete check-in payload, including raw **base64 image strings**, is queued inside `AsyncStorage`.
    *   A background timer attempts to sync the queue every 15 seconds.
    *   During sync: images are uploaded first, the payload is rewritten with the updated server image paths, and then submitted to `/api/checkin`.
    *   Successful uploads are deleted from the local mobile queue.

---

## 🛡️ 6. Hardening & Security Features

*   **GPU Disablement:** Hardware acceleration is disabled globally (`app.disableHardwareAcceleration()`) to ensure the desktop application boots inside virtual desktops, VMs, and remote control environments.
*   **Sandbox Settings:** The Electron main window utilizes `contextIsolation: true` and exposes a secure IPC API bridge (`preload.ts`) to avoid exposing Node APIs directly to the web environment.
*   **Auto-Checkout Worker:** On boot, the database runs `autoCheckoutOverdue()`. Any booking with a checkout date prior to the current system date is automatically checked out, and its allocated rooms are freed.

---

## 🧹 7. Maintenance Operations

### Manual Database Backups
To back up the database, copy the SQLite file while the app is closed:
```cmd
copy "%APPDATA%\SyncStay\syncstay.db" "D:\Backups\syncstay_backup_%date%.db"
```

### Viewing Logs
The log file `%APPDATA%\SyncStay\app.log` captures warnings and errors. To inspect runtime behavior, run in PowerShell:
```powershell
Get-Content -Path "$env:APPDATA\SyncStay\app.log" -Wait
```
