; installer.nsh
; Custom NSIS hooks for the Hotel Check-In installer.
; electron-builder includes this via nsis.include in package.json.
;
; Responsibilities:
;   - Add Windows Firewall rule for the API server (port 8080)
;   - Remove the firewall rule on uninstall
;   - Show a pre-install notice about required permissions

; ──────────────────────────────────────────────────────────────────────────────
; PRE-INSTALL  (runs before files are copied)
; ──────────────────────────────────────────────────────────────────────────────
!macro customInstall
  ; Inform the user about the firewall prompt they're about to see
  DetailPrint "Configuring Windows Firewall for Hotel Check-In API server..."

  ; Add inbound rule for the API server on port 8080 TCP
  ; /f silently deletes any existing rule with the same name first
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Hotel Check-In API Server"'
  nsExec::ExecToLog 'netsh advfirewall firewall add rule \
    name="Hotel Check-In API Server" \
    dir=in \
    action=allow \
    protocol=TCP \
    localport=8080 \
    profile=private,domain \
    description="Allows the Hotel Check-In desktop API to accept connections from mobile devices on the local network."'

  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONEXCLAMATION "Could not add firewall rule automatically.$\nTo connect mobile devices, manually allow port 8080 in Windows Firewall."
  ${Else}
    DetailPrint "Firewall rule added successfully for port 8080 (Private + Domain profiles)."
  ${EndIf}

  ; Create AppData directories so they exist before first launch
  CreateDirectory "$APPDATA\hotel-checkin-desktop"
  CreateDirectory "$APPDATA\hotel-checkin-desktop\data"
  CreateDirectory "$APPDATA\hotel-checkin-desktop\storage"
  CreateDirectory "$APPDATA\hotel-checkin-desktop\storage\portraits"
  CreateDirectory "$APPDATA\hotel-checkin-desktop\storage\id-proofs"
!macroend

; ──────────────────────────────────────────────────────────────────────────────
; PRE-UNINSTALL  (runs before files are removed)
; ──────────────────────────────────────────────────────────────────────────────
!macro customUnInstall
  DetailPrint "Removing Hotel Check-In API Server firewall rule..."
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Hotel Check-In API Server"'

  ; Ask user whether to delete guest data
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to delete all guest data (database, photos)?$\n$\nChoose NO to keep your data for reinstallation." \
    IDNO keepData

  ; Remove the AppData folder only if user confirms
  RMDir /r "$APPDATA\hotel-checkin-desktop"
  DetailPrint "Guest data removed."
  Goto done

  keepData:
    DetailPrint "Guest data kept at: $APPDATA\hotel-checkin-desktop"

  done:
!macroend
