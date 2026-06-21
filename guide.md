# SyncZen Local: Quick Start & Usage Guide

SyncZen Local is a local-first hospitality registration platform. It coordinates a Windows desktop workstation (Electron/Express) and Android mobile assistants (Expo/React Native) over your local WiFi network.

> [!IMPORTANT]
> **Unlike cloud PMS solutions** that require internet access and monthly subscriptions, SyncZen Local runs **entirely offline** on your local hardware. Database transactions are processed in-memory via `sql.js` (WebAssembly SQLite) and authorized using local secure tokens. Your guest records never leave your building.

---

## Table of Contents

- [How to Run](#how-to-run)
  - [Option A: From Source (Development)](#option-a-from-source-development)
  - [Option B: Standalone Release](#option-b-standalone-release)
- [Prerequisites & Environment Setup](#prerequisites-and-environment-setup)
- [Usage Basics & Interface Walkthrough](#usage-basics-and-interface-walkthrough)
  - [1. Initial Station Boot](#1-initial-station-boot)
  - [2. Pairing Assistant Devices](#2-pairing-assistant-devices)
  - [3. Completing Guest Check-Ins](#3-completing-guest-check-ins)
  - [4. Processing Check-Outs](#4-processing-check-outs)
- [Codebase Directory Index](#codebase-directory-index)

---

## How to Run

### Option A: From Source (Development)

To run the SyncZen Local workstation and mobile assistant in a local developer environment:

#### 1. Start the Desktop Workstation (Electron)
Install dependencies and launch the Electron application:
```cmd
cd desktop
npm install
npm run dev
```
*This launches the Electron GUI window and starts the local Express API server on port 8080 (or the next available port).*

#### 2. Start the Mobile Assistant (Expo)
Launch the Metro Bundler and open the app in a web browser or scan the QR code using Expo Go on your mobile device:
```cmd
cd mobile
npm install
npx expo start --clear
```
*Open `http://localhost:8081` in your browser, or scan the QR code displayed in the terminal with Expo Go on Android/iOS.*

---

### Option B: Standalone Release

If running compiled binaries without configuring a development environment:

#### 1. Windows Desktop Installation
*   Compile the installer by running `npm run build:win` inside the `desktop` directory.
*   Locate the installer at `desktop/dist/SyncZen-Local-Setup-1.0.0.exe`.
*   Double-click the installer. It will:
    1.  Install the SyncZen Local application.
    2.  Prompt for administrator privileges to add the inbound Windows Firewall exception rule.
    3.  Create desktop and Start Menu shortcuts.
    4.  Launch the application.

#### 2. Android APK Sideloading
*   Compile the APK by running the Gradle tasks:
    ```cmd
    cd mobile
    npx expo prebuild --platform android
    cd android
    gradlew assembleRelease
    ```
*   Locate the compiled release APK at `mobile/android/app/build/outputs/apk/release/app-release.apk`.
*   Transfer `app-release.apk` to your Android device (via USB, cloud storage, or direct sharing).
*   On the Android device, go to **Settings → Apps → Special app access → Install unknown apps** and grant permission to your file manager.
*   Open the file manager, tap `app-release.apk`, and confirm the installation.

---

## Prerequisites & Environment Setup

These requirements are only necessary if you are running from source or compiling binaries locally:

| Requirement | Minimum Version | CLI Verification Command |
|---|---|---|
| **Node.js** | 18.0.0+ | `node -v` |
| **Java JDK** | 17 (Required for Gradle build) | `java -version` |
| **Android SDK** | API 24+ (Android 7.0+) | `echo %ANDROID_HOME%` |
| **Gradle** | 8.13 | Handled automatically by the project wrapper |

---

## Usage Basics & Interface Walkthrough

### 1. Initial Station Boot
*   On the first launch of the desktop application, a **First-Run Setup** screen appears.
*   The application automatically initializes the SQLite schema, registers a PowerShell firewall rule for port 8080, creates a secure pairing token, and starts the API host.
*   Once finished, you will be redirected to the **Dashboard** displaying live occupancy gauges, guest counts, and recent bookings.

### 2. Pairing Assistant Devices
1.  On the desktop console, click the **Pair** tab in the sidebar. This displays a connection QR code, the local IP address, and the security token.
2.  Open the paired **SyncZen Local** app on your Android device.
3.  Tap **Scan QR Code** (or select manual entry) and point the camera at the desktop screen.
4.  Once paired successfully, the connection status indicator at the top of the mobile home screen will turn green (**Server Online**).

### 3. Completing Guest Check-Ins
1.  On the mobile app home screen, tap **Start Check-In**.
2.  Select the **Party Size** (number of incoming guests).
3.  Fill in details for each guest (Name, mobile, age, sex). The first guest is marked as the primary contact.
4.  Use the **Photo Widget** to photograph the guest's profile.
5.  Capture a photo of the group's **ID Proof** (passport, license, Aadhaar).
6.  Select an **Available Room**, set the number of nights, write optional notes, and tap **Review & Confirm**.
7.  If the server is offline, the check-in is buffered locally in AsyncStorage. It will auto-sync once the server is reachable.

### 4. Processing Check-Outs
*   **Manual Check-Out:** In the desktop app, go to **Bookings**, locate the booking reference, and click **Check-out**. This updates the booking status to `checked_out` and changes the associated rooms back to `available`.
*   **Auto-Checkout Failsafe:** Every time the desktop application boots, it automatically identifies bookings whose check-out dates have passed and updates them to free up rooms.

---

## Codebase Directory Index

Use this checklist table to locate key components and logic files in the repository:

- [ ] `desktop/electron/main.ts` — Main Electron process managing application lifecycles and IPC handles.
- [ ] `desktop/electron/server/api.ts` — Express LAN API server, token middleware, and network routing.
- [ ] `desktop/electron/server/db.ts` — sql.js in-memory database schema, migrations, and disk file export.
- [ ] `desktop/src/renderer/src/App.tsx` | `desktop/src/renderer/src/index.css` — React layout shell, page navigation, and navy/rose-gold design systems.
- [ ] `desktop/src/renderer/src/pages/` — Setup flows, Stats dashboards, Rooms grids, and Bookings tables.
- [ ] `mobile/App.tsx` — Main React Native navigation and screen mounting routers.
- [ ] `mobile/src/store.ts` — AsyncStorage managers, secure credentials, and offline caches.
- [ ] `mobile/src/sync.ts` — Photo uploading wrappers, check-in submit pipelines, and background sync queues.
- [ ] `mobile/src/screens/` — Mobile homes, camera QR scanners, and the step-by-step check-in wizard.
