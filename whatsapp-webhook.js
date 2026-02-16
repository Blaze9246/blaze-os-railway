#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// WhatsApp Webhook Forwarder - Lightweight Baileys connection
// Forwards incoming messages to Railway, doesn't interfere with OpenClaw
// ═══════════════════════════════════════════════════════════════════════════════

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const https = require('https');
const qrcode = require('qrcode-terminal');

const RAILWAY_WEBHOOK = 'https://blaze-os-railway-production.up.railway.app/api/webhook/whatsapp';

console.log('═══════════════════════════════════════════════════');
console.log('📱 WhatsApp Webhook Forwarder');
console.log('   Forwards incoming messages to Railway');
console.log('═══════════════════════════════════════════════════\n');

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('/root/.openclaw/whatsapp-webhook-auth');
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: ['Blaze Webhook', 'Chrome', '1.0'],
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      console.log('📱 Scan this QR code with WhatsApp:');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Connection closed, reconnecting:', shouldReconnect);
      if (shouldReconnect) connectToWhatsApp();
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
      console.log('📡 Forwarding messages to Railway...\n');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const name = msg.pushName || '';
    
    console.log('📩 Message received:', from, '-', text.substring(0, 50));
    
    // Forward to Railway
    forwardToRailway({
      from: from.replace(/@.*/, ''),
      fromName: name,
      body: text,
      type: 'text',
      messageId: msg.key.id,
      timestamp: new Date().toISOString()
    });
  });

  sock.ev.on('creds.update', saveCreds);
}

function forwardToRailway(data) {
  const payload = JSON.stringify(data);
  
  const options = {
    hostname: 'blaze-os-railway-production.up.railway.app',
    port: 443,
    path: '/api/webhook/whatsapp',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  const req = https.request(options, (res) => {
    console.log(`→ Forwarded: ${res.statusCode}`);
  });
  
  req.on('error', (err) => {
    console.error('❌ Forward error:', err.message);
  });
  
  req.write(payload);
  req.end();
}

connectToWhatsApp();
