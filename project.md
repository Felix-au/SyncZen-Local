# Project Technical Reference — Hotel Check-In System

> This document is the authoritative technical guide for developers operating and extending this project. It covers the runtime architecture, database schema, API contract, and key design decisions.

---

## 1. Runtime Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Electron Process (main.ts)                                      │
│                                                                  │
│  ┌─────────────────┐      ┌──────────────────────────────────┐  │
│  │  BrowserWindow   │      │  Background Services             │  │
│  │  (Vite React)   │ IPC  │  ├── MariaDB Launcher (3307)    │  │
│  │                 │◄────►│  ├── Express API Server (8080)  │  │
│  │  preload.ts     │      │  └── Port availability checker  │  │
│  └─────────────────┘      └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Process Startup Order

1. `main.ts` — Electron main process starts
2. `db-launcher.ts` — Spawns `mysqld.exe` silently; polls TCP 3307 until ready
3. `db.ts` — Creates MariaDB connection pool; runs `initDatabase()` (creates tables if missing)
4. `api.ts` — Starts Express; finds free port ≥ 8080; mounts all routes
5. `main.ts` — Creates BrowserWindow, loads Vite dev server or `dist/index.html`

### IPC Surface (preload.ts → renderer)

```typescript
window.electronAPI = {
  minimize(): void
  maximize(): void
  close():    void
}
```

---

## 2. Database Schema

### `rooms`

```sql
CREATE TABLE rooms (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  room_number      VARCHAR(20)  NOT NULL UNIQUE,
  room_type        VARCHAR(50)  NOT NULL DEFAULT 'Standard',
  floor            INT          NOT NULL DEFAULT 1,
  status           ENUM('available','occupied','maintenance','checkout')
                                NOT NULL DEFAULT 'available',
  price_per_night  DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### `booking_groups`

```sql
CREATE TABLE booking_groups (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_reference VARCHAR(20) NOT NULL UNIQUE,
  check_in_time    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out_date   DATE         NOT NULL,
  status           ENUM('checked_in','checked_out','cancelled')
                                NOT NULL DEFAULT 'checked_in',
  id_proof_path    VARCHAR(500),
  notes            TEXT,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### `guests`

```sql
CREATE TABLE guests (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  booking_group_id    INT NOT NULL REFERENCES booking_groups(id),
  name                VARCHAR(200) NOT NULL,
  age                 INT,
  sex                 ENUM('male','female','other'),
  photo_path          VARCHAR(500),
  is_primary_contact  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### `room_allocations`

```sql
CREATE TABLE room_allocations (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  booking_group_id INT NOT NULL REFERENCES booking_groups(id),
  room_id          INT NOT NULL REFERENCES rooms(id),
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_room (booking_group_id, room_id)
);
```

---

## 3. REST API Reference

Base URL: `http://localhost:8080` (port may increment if 8080 is busy)

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{ status: 'ok', port }` |

### Rooms

| Method | Path | Body / Notes |
|---|---|---|
| `GET` | `/api/rooms` | Returns all rooms with live occupancy join |
| `POST` | `/api/rooms` | `{ room_number, room_type, floor, price_per_night, notes? }` |
| `PATCH` | `/api/rooms/:id/status` | `{ status: 'available' | 'occupied' | 'maintenance' | 'checkout' }` |
| `DELETE` | `/api/rooms/:id` | Soft-delete (only if unoccupied) |

### Bookings

| Method | Path | Body / Notes |
|---|---|---|
| `GET` | `/api/bookings` | Query: `?status=checked_in` |
| `GET` | `/api/bookings/:id` | Full detail with guests and rooms |
| `POST` | `/api/bookings` | See booking payload below |
| `POST` | `/api/bookings/:id/checkout` | Marks group checked out, rooms available |

#### Booking Payload

```json
{
  "guests": [
    {
      "name": "John Doe",
      "age": 34,
      "sex": "male",
      "photo_path": "storage/portraits/portrait-uuid.jpg",
      "is_primary_contact": true
    }
  ],
  "room_ids": [1, 2],
  "check_out_date": "2026-05-30",
  "id_proof_path": "storage/id-proofs/id-uuid.jpg",
  "notes": "Late checkout requested"
}
```

### Guests

| Method | Path | Body |
|---|---|---|
| `GET` | `/api/guests/:id` | Full guest record |
| `PATCH` | `/api/guests/:id` | `{ name?, age?, sex? }` |

### Uploads

| Method | Path | Form field | Output |
|---|---|---|---|
| `POST` | `/api/upload/portrait` | `photo` | Compressed 256×256 JPEG |
| `POST` | `/api/upload/id-proof` | `photo` | Preserved up to 1200×800 JPEG |

### Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/settings/server-info` | Returns `{ local_ip, port, pairing_url, qr_code (data URL) }` |
| `GET` | `/api/settings/stats` | Returns room counts, active bookings, today's guests |

---

## 4. Mobile — Offline Queue Schema

SQLite database: `offline_queue.db` (stored in Expo's `documentDirectory`)

```sql
CREATE TABLE pending_checkins (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid                 TEXT NOT NULL UNIQUE,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  check_out_date       TEXT NOT NULL,
  room_ids_json        TEXT NOT NULL,  -- JSON array of room IDs
  guests_json          TEXT NOT NULL,  -- JSON array of PendingGuest objects
  local_id_proof_uri   TEXT,           -- file:// URI before upload
  server_id_proof_path TEXT,           -- server path after upload
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  retry_count          INTEGER NOT NULL DEFAULT 0
);
```

### Status Lifecycle

```
enqueue() → 'pending'
    │
    ▼
syncEngine picks up → 'syncing'
    │
    ├── success → 'synced'  (local photos deleted)
    └── failure → 'failed'  (retry_count++)
                    │
                    └── picked up again on next poll cycle
```

---

## 5. Image Storage

All media is stored in the Electron `userData` directory, **outside** the application install directory. This means updates to the EXE never affect guest data.

```
%APPDATA%\hotel-checkin-desktop\
└── storage\
    ├── portraits\      portrait-<uuid>.jpg    (256×256, ~20–50 KB each)
    └── id-proofs\      id-<uuid>.jpg          (up to 1200×800, ~200–500 KB)
```

Image paths stored in the database are **relative** (`storage/portraits/...`), not absolute, so the database is portable across machines.

---

## 6. Key Design Decisions

| Decision | Rationale |
|---|---|
| **MariaDB on port 3307** | Avoids collision with any existing system MySQL on 3306 |
| **Dynamic API port** | If 8080 is taken, server tries 8081, 8082… to avoid startup failure |
| **Jimp over Sharp** | Sharp requires native compilation (node-gyp + VS Build Tools). Jimp is pure JS — works on any Windows machine without extra tooling |
| **Multer 1.x pinned** | Multer 2.x has no TypeScript declarations yet; pinned at 1.4.5-lts.2 pending ecosystem catch-up |
| **Offline queue in SQLite** | Lightweight, zero-config, embedded in Expo. Handles disconnects without any remote infrastructure |
| **expo-image-manipulator** | Provides reliable crop of the ID card region without native OpenCV; perspective correction deferred to a future phase using `react-native-vision-camera` frame processors |
| **No authentication (v1.0)** | System is LAN/VPN-only — no internet exposure by default. API token support is planned for v1.1 |

---

## 7. Development Conventions

- All commits use [Conventional Commits](https://www.conventionalcommits.org/) prefixes: `feat`, `fix`, `chore`, `docs`, `refactor`
- Commits are made after every logical unit of work — never batched across multiple unrelated changes
- The `/scratch` directory is **never** committed
- `.agentrules` is **never** committed
- `changelog.md` in `/scratch` is maintained during each session and cleared after docs are updated
