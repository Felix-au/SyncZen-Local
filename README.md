# SyncStay — Master Repository Overview

```text
 ____                  ____  _
/ ___| _   _ _ __   ___/ ___|| |_ __ _ _   _
\___ \| | | | '_ \ / __\___ \| __/ _` | | | |
 ___) | |_| | | | | (__ ___) | || (_| | |_| |
|____/ \__, |_| |_|\___|____/ \__\__,_|\__, |
       |___/                           |___/
```

**SyncStay** is a modern, unified hotel guest check-in and data tracking ecosystem. It comprises a central desktop administration workstation (Electron/React/Express) and a secure offline-first mobile check-in assistant (React Native/Expo).

---

## 🎨 Product Identity & Design

| Brand Field | Specification | Visual Target |
|---|---|---|
| **Name** | SyncStay | Modern Hospitality Suite |
| **Tagline** | One platform. Every device. No compromise. | Premium UX, Zero Friction |
| **Logo** | Navy & Rose-Gold infinity loop (`/logo.png`) | End-to-end synergy |
| **Colors** | Navy (`#060C17` / `#1B2A4A`), Rose Gold (`#C9956A`), Text (`#F0EDE8` / `#A8B8C4`) | Warm contrast, sleek dark aesthetics |

---

## 📦 Key Deliverables

1. 💻 **`SyncStay Setup.exe`**: An NSIS Windows installer that sets up the database, creates a custom Windows Defender Firewall rule for port 8080, and installs the desktop admin panel.
2. 📱 **`SyncStay.apk`**: An Android application designed for rapid check-ins, supporting offline-first operations with base64-buffered photo queues and camera scanning.

---

## 🏛️ System Architecture

The following diagram illustrates how the desktop administration console acts as a local LAN hub, while the mobile applications sync check-in queues in real-time or buffer them when offline.

```mermaid
graph TD
    %% Styling
    classDef main fill:#0C1826,stroke:#C9956A,stroke-width:2px,color:#F0EDE8;
    classDef sub fill:#112035,stroke:#4E6070,stroke-width:1px,color:#A8B8C4;
    classDef greenNode fill:#1EC994,stroke:#1EC994,stroke-width:1px,color:#060C17;
    classDef orangeNode fill:#F0A830,stroke:#F0A830,stroke-width:1px,color:#060C17;

    subgraph DesktopApp ["Desktop Workstation (Electron App)"]
        UI["React + Vite UI Panel"]:::main
        Main["Electron Main Process"]:::main
        Server["Express API Server (:8080)"]:::main
        SQLJS[("sql.js (In-Memory WASM)")]:::sub
        DBFile[("syncstay.db (Disk File)")]:::sub
    end

    subgraph MobileApp ["Mobile Assistant (Expo Android APK)"]
        MobUI["Check-In Wizard (Camera + Forms)"]:::main
        AsyncStr[("AsyncStorage Queue")]:::sub
        SyncEngine["Sync Engine"]:::main
    end

    %% Connections
    UI <-->|IPC Channels| Main
    Main <-->|Read/Write WASM| SQLJS
    Main -->|Auto Save / Persistence| DBFile
    Server <-->|Local DB Access| SQLJS
    
    MobUI <-->|Write Check-ins| AsyncStr
    AsyncStr <-->|Read Queue| SyncEngine
    
    SyncEngine <-->|Bearer Token Auth (LAN WiFi)| Server
    
    %% Pairing
    UI -->|Generates Pair QR Code| MobUI

    class DesktopApp,MobileApp main;
```

---

## 🛠️ Technical Stack Breakdown

### Desktop Workstation
*   **Shell Platform:** Electron 39.2.6
*   **UI Architecture:** React 19 + TypeScript + Vite 7
*   **Database Engine:** `sql.js` (WebAssembly-based SQLite, eliminating native C++ compiler requirements)
*   **LAN API Host:** Express 4.19 with automated free-port scanning (defaults to port 8080)
*   **Desktop Installer:** `electron-builder` + NSIS script for firewall rule administration
*   **Security:** Cryptographically generated 32-character tokens for API auth

### Mobile Assistant
*   **Runtime:** Expo SDK 56 (React Native)
*   **Local Storage:** AsyncStorage (offline payload queue) & SecureStore (native API token)
*   **Peripherals:** Camera support (`expo-camera`) for QR pairing & photo document scans
*   **Offline Queue:** Base64-backed storage structure ensuring media files survive app restarts
*   **Compilation:** Native Gradle packaging (`gradlew assembleRelease`) for local APK generation

---

## 📂 Repository Directory Structure

```text
Hotel-Check-In/
├── logo.png             # Navy & Rose Gold logo
├── .agentrules          # Repository documentation & commit guidelines
├── README.md            # Master repository overview (this document)
├── guide.md             # Compilation, setup, and deployment guide
├── project.md           # Technical operating guide & maintenance manual
├── scratch/             # Session plans & temporary change buffers (ignored by git)
│   ├── plan.md
│   └── changelog.md
│
├── desktop/             # Electron desktop admin codebase
│   ├── electron/        # Main & Preload process (TypeScript)
│   ├── src/             # Renderer process (React 19 + TypeScript)
│   ├── build/           # Packaging configuration assets (NSIS script, icon)
│   └── package.json
│
└── mobile/              # Expo React Native mobile assistant codebase
    ├── src/             # API clients, store manager, sync scripts & screens
    ├── assets/          # App icons & splash screens
    └── package.json
```

---

## 🚀 Running the Project

To compile or run the applications, please consult the core documentation files:
*   📚 **[guide.md](file:///c:/Users/Felix/Desktop/Hotel-Check-In/guide.md)**: Steps to run the dev environment, compile binaries, and configure native prerequisites.
*   ⚙️ **[project.md](file:///c:/Users/Felix/Desktop/Hotel-Check-In/project.md)**: Operating manuals, database schemas, and networking configuration specifics.
