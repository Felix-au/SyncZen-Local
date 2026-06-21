<p align="center">
  <img src="logo.png" width="120" alt="SyncZen Local Logo"/>
</p>
<h1 align="center">📱 SyncZen Local: Quick Start & Usage Guide</h1>
<p align="center">
  <em>The complete quick-start guide for setting up, compiling, and operating SyncZen Local.</em>
</p>

---

## 📋 Table of Contents

- 🚀 [How to Run](#how-to-run)
  - [Option A: From Source (Development)](#option-a-from-source-development)
  - [Option B: Standalone Release (Prebuilt binaries)](#option-b-standalone-release-prebuilt-binaries)
- ⚙️ [Prerequisites & Environment Setup](#prerequisites--environment-setup)
- 📶 [Local Network & Pairing Configuration](#local-network--pairing-configuration)
- 🏨 [Usage Walkthrough & Interface Map](#usage-walkthrough--interface-map)
  - [1. First-Run Setup Workstation](#1-first-run-setup-workstation)
  - [2. Mobile Device Pairing](#2-mobile-device-pairing)
  - [3. Completing Guest Check-Ins](#3-completing-guest-check-ins)
  - [4. Processing Check-Outs](#4-processing-check-outs)
- 📁 [Codebase Directory Checklist](#codebase-directory-checklist)
- 👤 [Author](#author)

---

## 🚀 How to Run

### Option A: From Source (Development)

To run the SyncZen Local workstation and mobile assistant in a local developer environment:

#### 1. Start the Desktop Workstation (Electron)
Install Node.js dependencies and launch the Electron application in development mode:
```cmd
cd desktop
npm install
npm run dev
```
*This launches the Electron GUI window and boots the local Express API server on port 8080 (or the next available port).*

#### 2. Start the Mobile Assistant (Expo)
Launch the Metro Bundler and open the app in a web browser or scan the QR code using Expo Go on your mobile device:
```cmd
cd mobile
npm install
npx expo start --clear
```
*Open `http://localhost:8081` in your browser, or scan the QR code displayed in the terminal with Expo Go on Android/iOS.*

---

### Option B: Standalone Release (Prebuilt binaries)

For quick deployment without configuring a development environment, both the desktop executable and mobile APK are released on GitHub.

#### 1. Windows Desktop Installation
*   Download the latest `SyncZen-Local-Setup-1.0.0.exe` from [GitHub Releases](https://github.com/Felix-au/Hotel-Check-In/releases).
*   Double-click the installer. It will:
    1.  Install the SyncZen Local application.
    2.  Prompt for administrator privileges to add the inbound Windows Firewall exception rule.
    3.  Create desktop and Start Menu shortcuts.
    4.  Launch the application.
*   *Alternatively, compile from source by running `npm run build:win` inside the `desktop` directory.*

#### 2. Android APK Sideloading
*   Download the latest `SyncZen.apk` from [GitHub Releases](https://github.com/Felix-au/Hotel-Check-In/releases).
*   Transfer the APK to your Android device (via USB, email, or direct download).
*   Enable installation from unknown sources:
    1.  Go to **Settings ➔ Apps ➔ Special app access ➔ Install unknown apps**.
    2.  Select your file manager or web browser.
    3.  Toggle **Allow from this source** to enabled.
*   Open the file manager, tap the downloaded `SyncZen.apk` file, and confirm the installation.
*   *Alternatively, compile from source by running `npx expo prebuild --platform android` followed by `.\gradlew assembleRelease` inside the `mobile/android` folder.*

---

## ⚙️ Prerequisites & Environment Setup

These requirements are only necessary if you are running from source or compiling binaries locally:

| Requirement | Minimum Version | CLI Verification Command |
|---|---|---|
| **Node.js** | 18.0.0+ | `node -v` |
| **Java JDK** | 17 (Required for Gradle build) | `java -version` |
| **Android SDK** | API 24+ (Android 7.0+) | `echo %ANDROID_HOME%` |
| **Gradle** | 8.13 | Handled automatically by the project wrapper |

---

## 📶 Local Network & Pairing Configuration

SyncZen Local routes all requests over your local WiFi network.

```
 ┌─────────────────┐                               ┌─────────────────┐
 │   Mobile App    │ ───────── QR Scan Pair ──────►│   Desktop App   │
 │ (AsyncStorage)  │ ◄─────── REST API calls ──────│ (Express Server)│
 └─────────────────┘                               └─────────────────┘
```

1.  **WiFi Alignment:** Ensure that both the desktop computer running the workstation and the mobile devices are connected to the **same local area network (LAN) router**.
2.  **IP Address Resolution:** The desktop application dynamically queries `os.networkInterfaces()`, prioritizing local home IP ranges (e.g., `192.168.x.x` and `10.x.x.x`) to bypass virtual VPN connections.
3.  **Firewall Exceptions:** The Express server listens on port `8080` (or increments to `8081`, `8082` if occupied). The application creates an inbound firewall rule named `SyncZen-API` using `netsh`. Ensure you accept the UAC permission prompt on startup to allow incoming traffic.
4.  **Authorization:** Communication is secured using a 32-character cryptographically random Bearer token generated on setup.

---

## 🏨 Usage Walkthrough & Interface Map

### 1. First-Run Setup Workstation
*   On the first launch of the desktop application, a **First-Run Setup** screen appears.
*   The application automatically initializes the SQLite schema, registers a PowerShell firewall rule for port 8080, creates a secure pairing token, and starts the API host.
*   Once finished, you will be redirected to the **Dashboard** displaying live occupancy gauges, guest counts, and recent bookings.

### 2. Mobile Device Pairing
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

## 📁 Codebase Directory Checklist

Use this checklist table to locate key components and logic files in the repository:

| Module / Component | Path Location | Functional Role |
|---|---|---|
| **Main Process** | `desktop/electron/main.ts` | Handles Electron app lifecycle, windows, and IPC event handlers. |
| **API Server** | `desktop/electron/server/api.ts` | Hosts Express API routes, LAN IP checks, and bearer token auth. |
| **Database Manager** | `desktop/electron/server/db.ts` | Manages `sql.js` schema initialization, migrations, and writes to `synczen.db`. |
| **Desktop Shell** | `desktop/src/App.tsx` | Main React application layout, sidebar navigation, and page router. |
| **Design System** | `desktop/src/index.css` | Root styling theme, colors, cards, gauges, tables, and animations. |
| **Setup Screen** | `desktop/src/pages/SetupPage.tsx` | First-run setup progress interface. |
| **Gauges & stats** | `desktop/src/pages/DashboardPage.tsx` | Stat widgets and recent booking feeds. |
| **Inventory CRUD** | `desktop/src/pages/RoomsPage.tsx` | Table of rooms and room status modifications. |
| **Pairing Center** | `desktop/src/pages/PairPage.tsx` | Renders pairing QR code and connection tokens. |
| **Mobile Core** | `mobile/App.tsx` | Main Expo entry point and screen routers. |
| **Storage Store** | `mobile/src/store.ts` | Manages local AsyncStorage queues and secure token keys. |
| **Sync Manager** | `mobile/src/sync.ts` | Handles offline check-in serialization, image pre-uploads, and retry synchronization loops. |
| **Pairing Screen** | `mobile/src/screens/PairScreen.tsx` | Expo camera QR scanner and manual connection input forms. |
| **Registration Wizard** | `mobile/src/screens/CheckInWizard.tsx` | Segmented guest form flow, profile widgets, and room selectors. |

---

## 👤 Author

**Felix-au** (Harshit Soni)

- 🔗 GitHub: [github.com/Felix-au](https://github.com/Felix-au)
- 📧 Email: [harshit.soni.23cse@bmu.edu.in](mailto:harshit.soni.23cse@bmu.edu.in)

---

<p align="center"><sub>Built for hospitality teams who require secure, local-first check-ins without the dependency of external clouds.</sub></p>
