# WhatsApp Integration — Setup & Usage Guide

## Architecture

```
Frontend (React/Vite :5173)
    │
    ├── REST API ──────────────→ FastAPI Backend (:8000)
    │                               │
    │                               └── Proxy /api/v1/whatsapp/* ──→ WhatsApp Service (:3001)
    │
    └── Socket.IO ────────────────────────────────────────────────→ WhatsApp Service (:3001)
                                                                        │
                                                                        └── whatsapp-web.js (Chromium)
                                                                                │
                                                                                └── WhatsApp Web
```

## Running the Services

### 1. WhatsApp Node.js Service
```bash
cd whatsapp-service
npm install       # first time only
npm start         # production
# or
npm run dev       # development with auto-reload
```
Runs on: http://localhost:3001

### 2. FastAPI Backend (unchanged)
```bash
cd backend
pip install -r requirements.txt   # first time
uvicorn app.main:app --reload --port 8000
```
Runs on: http://localhost:8000

### 3. Frontend (unchanged)
```bash
cd frontend
npm install       # first time
npm run dev
```
Runs on: http://localhost:5173

---

## User Flow

1. Log in as **Super Admin**
2. Click **WhatsApp** in the left sidebar
3. Click **Connect WhatsApp** — a QR code appears
4. Open WhatsApp on your phone → **Settings → Linked Devices → Link a Device**
5. Scan the QR code
6. Once connected, your WhatsApp chats appear in the left panel
7. Click any chat to open the conversation
8. Send and receive messages in real time

**Session Persistence:** After the first scan, your session is saved in
`whatsapp-service/.wwebjs_auth/`. On server restart, the session restores
automatically — no re-scanning needed.

---

## Features

| Feature | Details |
|---|---|
| QR Connect | Browser-based QR displayed inside CRM |
| Session Persistence | LocalAuth saves Chromium session across restarts |
| Per-User Sessions | Each CRM super admin has their own isolated session |
| Chat List | All WhatsApp chats sorted by most recent message |
| Search | Search chats by contact name |
| Unread Count | Real-time unread badge per chat and total in sidebar |
| Send Messages | Text messages with optimistic UI |
| Receive Messages | Real-time via Socket.IO push |
| Message Status | ✓ sent · ✓✓ delivered · ✓✓ read (blue) |
| Timestamps | Smart timestamps (time for today, date for older) |
| Group Chats | Displayed with group icon |
| Disconnect | Logs out and clears session data |
| Mark Read | Auto-marks messages read when chat is opened |

---

## Environment Variables

### whatsapp-service/.env
```
PORT=3001
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:8000
```

### frontend/.env
```
VITE_WHATSAPP_SERVICE_URL=http://localhost:3001   # Socket.IO direct connection
```

### backend/.env
```
WHATSAPP_SERVICE_URL=http://localhost:3001        # REST proxy target
```

---

## Troubleshooting

**"WhatsApp service offline (port 3001)"**
→ Start the whatsapp-service: `cd whatsapp-service && npm start`

**QR code not appearing**
→ Check that Chromium/Puppeteer can run. On Linux: install chromium dependencies.
→ Try: `npx puppeteer browsers install chrome`

**Session not restoring after restart**
→ Check `.wwebjs_auth/` folder exists in `whatsapp-service/`
→ If corrupt, delete `.wwebjs_auth/` and scan QR again

**Real-time messages not arriving**
→ Ensure Socket.IO connects (check browser console for `[WA-Socket] Connected`)
→ CORS: confirm `CORS_ORIGINS` in `.env` includes your frontend origin

---

## Security Notes

- WhatsApp endpoints require SUPER_ADMIN role (enforced in FastAPI)
- Socket.IO connection uses `crmUserId` from the CRM JWT (passed as query param)
- Session files are stored locally — ensure the server is trusted
- Do NOT commit `.wwebjs_auth/` to git (already in `.gitignore`)
