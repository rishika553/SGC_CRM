/**
 * SGC CRM — WhatsApp Web Microservice
 * Powered by whatsapp-web.js + Socket.IO
 *
 * Features:
 *  - QR-based session init with LocalAuth persistence
 *  - Per-CRM-user session isolation (keyed by crmUserId)
 *  - REST API: status, qr, connect, disconnect, chats, messages, send
 *  - Socket.IO: qr_update, status_change, new_message, message_ack events
 *  - Sessions survive server restarts (LocalAuth saves Chromium session)
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const QRCode = require('qrcode');
const { Server: SocketIOServer } = require('socket.io');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3001;

// ── CORS ────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8000').split(',');
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

// ── Socket.IO ────────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, credentials: true },
  transports: ['websocket', 'polling'],
});

// Map crmUserId → Set of socket ids
const userSocketMap = new Map(); // crmUserId → Set<socketId>

io.on('connection', (socket) => {
  const crmUserId = socket.handshake.query.crmUserId;
  if (!crmUserId) { socket.disconnect(); return; }

  if (!userSocketMap.has(crmUserId)) userSocketMap.set(crmUserId, new Set());
  userSocketMap.get(crmUserId).add(socket.id);
  socket.join(`user:${crmUserId}`);

  console.log(`[WA-Socket] User ${crmUserId} connected (socket ${socket.id})`);

  socket.on('disconnect', () => {
    const sockets = userSocketMap.get(crmUserId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) userSocketMap.delete(crmUserId);
    }
    console.log(`[WA-Socket] User ${crmUserId} disconnected (socket ${socket.id})`);
  });
});

/** Emit an event to all sockets of a specific CRM user */
function emitToUser(crmUserId, event, data) {
  io.to(`user:${crmUserId}`).emit(event, data);
}

/** Emit an event to ALL connected sockets (for global broadcasts) */
function emitToAll(event, data) {
  io.emit(event, data);
}

// ── Session Store ─────────────────────────────────────────────────────────────
// sessions: Map<crmUserId, SessionState>
const sessions = new Map();

/**
 * @typedef {Object} SessionState
 * @property {'disconnected'|'connecting'|'qr_ready'|'connected'} status
 * @property {string|null} qrDataUrl
 * @property {{wid: string|null, pushname: string|null}|null} user
 * @property {Client|null} client
 */

function getSession(crmUserId) {
  if (!sessions.has(crmUserId)) {
    sessions.set(crmUserId, {
      status: 'disconnected',
      qrDataUrl: null,
      user: null,
      client: null,
    });
  }
  return sessions.get(crmUserId);
}

// ── Client Factory ─────────────────────────────────────────────────────────
const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--metrics-recording-only',
  '--mute-audio',
  '--safebrowsing-disable-auto-update',
];

// Use system-installed Chrome if Puppeteer's bundled Chrome is not available
const SYSTEM_CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
];

function getChromePath() {
  for (const p of SYSTEM_CHROME_PATHS) {
    try {
      if (fs.existsSync(p)) {
        console.log(`[WA] Using system Chrome: ${p}`);
        return p;
      }
    } catch (_) {}
  }
  return null; // let Puppeteer decide
}

const CHROME_EXECUTABLE = getChromePath();

function getAuthPath(crmUserId) {
  return path.join(__dirname, '.wwebjs_auth', `user_${crmUserId}`);
}

/** Remove Chromium singleton lock files left behind by crashed sessions. */
function cleanupSessionLocks(crmUserId) {
  const authPath = getAuthPath(crmUserId);
  if (!fs.existsSync(authPath)) return;

  const lockNames = new Set([
    'SingletonLock',
    'SingletonCookie',
    'SingletonSocket',
    'lockfile',
    'DevToolsActivePort',
  ]);

  const removeLocksInDir = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        removeLocksInDir(fullPath);
        continue;
      }
      if (lockNames.has(entry.name)) {
        try {
          fs.rmSync(fullPath, { force: true });
          console.log(`[WA ${crmUserId}] Removed stale lock: ${fullPath}`);
        } catch (_) {}
      }
    }
  };

  removeLocksInDir(authPath);
}

/** Force-close Puppeteer/Chromium for a whatsapp-web.js client instance. */
async function forceDestroyClient(client) {
  if (!client) return;

  try {
    if (client.pupBrowser) {
      const pages = await client.pupBrowser.pages().catch(() => []);
      await Promise.all(pages.map((page) => page.close().catch(() => {})));
      await client.pupBrowser.close().catch(() => {});
    }
  } catch (_) {}

  try {
    await client.destroy();
  } catch (_) {}
}

async function destroySessionClient(crmUserId) {
  const session = getSession(crmUserId);
  if (session.client) {
    await forceDestroyClient(session.client);
    session.client = null;
  }
  cleanupSessionLocks(crmUserId);
}

function createWhatsAppClient(crmUserId) {
  const session = getSession(crmUserId);

  // Destroy any existing client and clear stale Chromium locks first
  if (session.client) {
    forceDestroyClient(session.client).finally(() => {});
    session.client = null;
  }
  cleanupSessionLocks(crmUserId);

  session.status = 'connecting';
  session.qrDataUrl = null;
  session.user = null;
  emitToUser(crmUserId, 'status_change', { status: 'connecting', user: null });

  const authPath = getAuthPath(crmUserId);

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: `crm_${crmUserId}`, dataPath: authPath }),
    puppeteer: {
      headless: true,
      args: PUPPETEER_ARGS,
      timeout: 90000,
      ...(CHROME_EXECUTABLE ? { executablePath: CHROME_EXECUTABLE } : {}),
    },
    restartOnAuthFail: false,
  });

  client.on('qr', async (qr) => {
    console.log(`[WA ${crmUserId}] QR generated`);
    try {
      session.qrDataUrl = await QRCode.toDataURL(qr);
      session.status = 'qr_ready';
      emitToUser(crmUserId, 'qr_update', { qr: session.qrDataUrl, status: 'qr_ready' });
    } catch (err) {
      console.error(`[WA ${crmUserId}] QR generation error:`, err);
    }
  });

  client.on('authenticated', () => {
    console.log(`[WA ${crmUserId}] Authenticated`);
    session.status = 'connecting';
    session.qrDataUrl = null;
    emitToUser(crmUserId, 'status_change', { status: 'connecting', user: null });
  });

  client.on('auth_failure', (msg) => {
    console.error(`[WA ${crmUserId}] Auth failure:`, msg);
    session.status = 'disconnected';
    session.qrDataUrl = null;
    session.user = null;
    emitToUser(crmUserId, 'status_change', { status: 'disconnected', user: null, error: 'auth_failure' });
  });

  client.on('ready', () => {
    console.log(`[WA ${crmUserId}] Client ready`);
    session.status = 'connected';
    session.qrDataUrl = null;
    session.user = {
      wid: client.info?.wid?._serialized || null,
      pushname: client.info?.pushname || 'WhatsApp Account',
    };
    emitToUser(crmUserId, 'status_change', { status: 'connected', user: session.user });
  });

  client.on('disconnected', (reason) => {
    console.log(`[WA ${crmUserId}] Disconnected:`, reason);
    session.status = 'disconnected';
    session.qrDataUrl = null;
    session.user = null;
    try { client.destroy(); } catch (_) {}
    session.client = null;
    emitToUser(crmUserId, 'status_change', { status: 'disconnected', user: null });
  });

  // ── Incoming message → push to frontend via Socket.IO ──────────────────
  client.on('message', async (msg) => {
    try {
      const chat = await msg.getChat();
      const contact = await msg.getContact();
      const payload = formatMessage(msg, contact, chat);
      emitToUser(crmUserId, 'new_message', payload);
    } catch (err) {
      console.error(`[WA ${crmUserId}] Error handling incoming message:`, err);
    }
  });

  // Message acknowledgment (sent → delivered → read)
  client.on('message_ack', (msg, ack) => {
    emitToUser(crmUserId, 'message_ack', { id: msg.id._serialized, ack });
  });

  client.initialize().catch(async (err) => {
    console.error(`[WA ${crmUserId}] Init error: ${err.message}`);
    await forceDestroyClient(client);
    session.client = null;
    session.status = 'disconnected';
    session.qrDataUrl = null;
    session.user = null;
    cleanupSessionLocks(crmUserId);
    emitToUser(crmUserId, 'status_change', { status: 'disconnected', user: null, error: err.message });

    const message = err.message || '';
    const isRetryable = (
      message.includes('Execution context') ||
      message.includes('navigation') ||
      message.includes('Session closed') ||
      message.includes('Target closed') ||
      message.includes('already running') ||
      message.includes('browser is already running') ||
      message.includes('Protocol error')
    );

    if (isRetryable) {
      console.log(`[WA ${crmUserId}] Retryable init error — retrying in 5s...`);
      setTimeout(() => {
        const s = getSession(crmUserId);
        if (s.status === 'disconnected' && !s.client) {
          createWhatsAppClient(crmUserId);
        }
      }, 5000);
    }
  });

  session.client = client;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatMessage(msg, contact, chat) {
  return {
    id: msg.id._serialized,
    body: msg.body,
    type: msg.type,
    from: msg.from,
    to: msg.to,
    fromMe: msg.fromMe,
    timestamp: msg.timestamp,
    isRead: msg.isStatus,
    ack: msg.ack,
    hasMedia: msg.hasMedia,
    mediaUrl: null, // populated on demand
    contactName: contact?.pushname || contact?.name || msg.from,
    contactNumber: contact?.number || msg.from?.replace('@c.us', ''),
    chatId: chat?.id?._serialized || msg.from,
    chatName: chat?.name || contact?.pushname || msg.from,
  };
}

function formatChat(chat) {
  const lastMsg = chat.lastMessage;
  return {
    id: chat.id._serialized,
    name: chat.name,
    isGroup: chat.isGroup,
    unreadCount: chat.unreadCount || 0,
    timestamp: lastMsg?.timestamp || 0,
    lastMessage: lastMsg ? {
      id: lastMsg.id?._serialized,
      body: lastMsg.body || '',
      type: lastMsg.type,
      fromMe: lastMsg.fromMe,
      timestamp: lastMsg.timestamp,
    } : null,
    isArchived: chat.archived || false,
    isMuted: chat.isMuted || false,
  };
}

// ── Middleware: validate crmUserId ────────────────────────────────────────
function requireCrmUser(req, res, next) {
  const crmUserId = req.headers['x-crm-user-id'] || req.query.crmUserId;
  if (!crmUserId) {
    return res.status(400).json({ success: false, error: 'Missing x-crm-user-id header or crmUserId query param' });
  }
  req.crmUserId = crmUserId;
  next();
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /status — session status for a CRM user
app.get('/status', requireCrmUser, (req, res) => {
  const session = getSession(req.crmUserId);
  res.json({
    success: true,
    status: session.status,
    connected: session.status === 'connected',
    user: session.user,
  });
});

// GET /qr — current QR code data URL
app.get('/qr', requireCrmUser, (req, res) => {
  const session = getSession(req.crmUserId);
  res.json({
    success: true,
    status: session.status,
    qr: session.qrDataUrl,
  });
});

// POST /connect — initiate WhatsApp session
app.post('/connect', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  if (session.status === 'connected') {
    return res.json({ success: true, message: 'Already connected', status: 'connected', user: session.user });
  }
  if (session.status === 'connecting' || session.status === 'qr_ready') {
    return res.json({
      success: true,
      message: 'Connection already in progress',
      status: session.status,
      qr: session.qrDataUrl,
    });
  }

  await destroySessionClient(req.crmUserId);
  createWhatsAppClient(req.crmUserId);
  res.json({ success: true, message: 'WhatsApp connection initiated', status: 'connecting' });
});

// POST /disconnect — logout and destroy session
app.post('/disconnect', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  try {
    if (session.client) {
      try { await session.client.logout(); } catch (_) {}
      await forceDestroyClient(session.client);
      session.client = null;
    }
  } catch (err) {
    console.error(`[WA ${req.crmUserId}] Disconnect error:`, err);
  } finally {
    session.status = 'disconnected';
    session.qrDataUrl = null;
    session.user = null;

    // Remove persisted auth for this user
    const authPath = getAuthPath(req.crmUserId);
    if (fs.existsSync(authPath)) {
      try { fs.rmSync(authPath, { recursive: true, force: true }); } catch (_) {}
    }

    emitToUser(req.crmUserId, 'status_change', { status: 'disconnected', user: null });
    res.json({ success: true, message: 'WhatsApp disconnected', status: 'disconnected' });
  }
});

// GET /chats — fetch chat list
app.get('/chats', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  if (session.status !== 'connected' || !session.client) {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
  }
  try {
    const limit = parseInt(req.query.limit) || 50;
    const chats = await session.client.getChats();
    const formatted = chats
      .filter((c) => !c.archived)
      .sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0))
      .slice(0, limit)
      .map(formatChat);
    res.json({ success: true, data: formatted, total: formatted.length });
  } catch (err) {
    console.error(`[WA ${req.crmUserId}] getChats error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /messages/:chatId — fetch message history for a chat
app.get('/messages/:chatId', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  if (session.status !== 'connected' || !session.client) {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
  }
  try {
    const chatId = decodeURIComponent(req.params.chatId);
    const limit = parseInt(req.query.limit) || 50;
    const chat = await session.client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });

    const formatted = await Promise.all(
      messages.map(async (msg) => {
        try {
          const contact = await msg.getContact();
          return formatMessage(msg, contact, chat);
        } catch (_) {
          return formatMessage(msg, null, chat);
        }
      })
    );

    // Mark chat as read
    try { await chat.sendSeen(); } catch (_) {}

    res.json({ success: true, data: formatted, chatId, total: formatted.length });
  } catch (err) {
    console.error(`[WA ${req.crmUserId}] getMessages error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /send — send a WhatsApp message
app.post('/send', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  if (session.status !== 'connected' || !session.client) {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
  }
  const { chatId, message } = req.body;
  if (!chatId || !message?.trim()) {
    return res.status(400).json({ success: false, error: 'chatId and message are required' });
  }
  try {
    const sentMsg = await session.client.sendMessage(chatId, message.trim());
    res.json({
      success: true,
      data: {
        id: sentMsg.id._serialized,
        body: sentMsg.body,
        fromMe: true,
        timestamp: sentMsg.timestamp,
        chatId,
      },
    });
  } catch (err) {
    console.error(`[WA ${req.crmUserId}] sendMessage error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /send-media — send image/file
app.post('/send-media', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  if (session.status !== 'connected' || !session.client) {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
  }
  const { chatId, mediaBase64, mimetype, filename, caption } = req.body;
  if (!chatId || !mediaBase64 || !mimetype) {
    return res.status(400).json({ success: false, error: 'chatId, mediaBase64, and mimetype are required' });
  }
  try {
    const media = new MessageMedia(mimetype, mediaBase64, filename || 'file');
    const sentMsg = await session.client.sendMessage(chatId, media, { caption: caption || '' });
    res.json({
      success: true,
      data: {
        id: sentMsg.id._serialized,
        fromMe: true,
        timestamp: sentMsg.timestamp,
        chatId,
        hasMedia: true,
      },
    });
  } catch (err) {
    console.error(`[WA ${req.crmUserId}] sendMedia error:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /mark-read/:chatId — mark a chat as read
app.post('/mark-read/:chatId', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  if (session.status !== 'connected' || !session.client) {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
  }
  try {
    const chatId = decodeURIComponent(req.params.chatId);
    const chat = await session.client.getChatById(chatId);
    await chat.sendSeen();
    res.json({ success: true, message: 'Chat marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /contact/:number — lookup a contact by phone number (e.g. 919876543210)
app.get('/contact/:number', requireCrmUser, async (req, res) => {
  const session = getSession(req.crmUserId);
  if (session.status !== 'connected' || !session.client) {
    return res.status(503).json({ success: false, error: 'WhatsApp not connected' });
  }
  try {
    const number = req.params.number.replace(/[^0-9]/g, '');
    const numberId = await session.client.getNumberId(number);
    if (!numberId) {
      return res.status(404).json({ success: false, error: 'Number not registered on WhatsApp' });
    }
    res.json({ success: true, data: { numberId: numberId._serialized, isRegistered: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'whatsapp-service', uptime: process.uptime() });
});

// ── Auto-restore sessions on startup ─────────────────────────────────────
// Disabled: only restore sessions when user explicitly clicks Connect.
// This avoids boot-time crashes from stale/corrupt session data.
function restorePersistedSessions() {
  const authBaseDir = path.join(__dirname, '.wwebjs_auth');
  if (!fs.existsSync(authBaseDir)) return;

  const entries = fs.readdirSync(authBaseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const match = entry.name.match(/^user_(.+)$/);
    if (!match) continue;
    const crmUserId = match[1];
    console.log(`[WA-Restore] Restoring session for CRM user: ${crmUserId}`);
    createWhatsAppClient(crmUserId);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`✅ WhatsApp Web Service running on http://localhost:${PORT}`);
  console.log(`📡 Socket.IO available on ws://localhost:${PORT}`);
  console.log(`🔑 Using Chrome: ${CHROME_EXECUTABLE || 'Puppeteer bundled'}`);
});
