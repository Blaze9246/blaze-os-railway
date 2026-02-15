#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// BLAZE ↔ OPENCLAW BRIDGE
// ═══════════════════════════════════════════════════════════════════════════════
//
// This script runs on your Hostinger VPS alongside OpenClaw.
// It does two things:
//   1. Hooks into OpenClaw's incoming messages → POSTs them to Blaze OS webhook
//   2. Polls Blaze OS outbox → Sends replies via OpenClaw gateway
//
// SETUP:
//   1. Copy this file to your VPS: /root/.openclaw/workspace/blaze-bridge.js
//   2. Install dependency: npm install node-fetch@2
//   3. Edit BLAZE_API_URL below to your deployed Blaze OS URL
//   4. Run: node blaze-bridge.js
//   5. (Optional) Run with pm2: pm2 start blaze-bridge.js --name blaze-bridge
//
// ═══════════════════════════════════════════════════════════════════════════════

const fetch = require('node-fetch');

// ─── CONFIGURATION ───────────────────────────────────────────────────────────
// Change this to your deployed Blaze OS URL
const BLAZE_API_URL = process.env.BLAZE_API_URL || 'http://localhost:3000';
// OpenClaw gateway (local on VPS)
const OPENCLAW_GATEWAY = process.env.OPENCLAW_GATEWAY || 'http://localhost:18789';
// How often to poll outbox (milliseconds)
const POLL_INTERVAL = 5000; // 5 seconds
// ─────────────────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════');
console.log('🔥 BLAZE ↔ OPENCLAW BRIDGE');
console.log(`   Blaze API: ${BLAZE_API_URL}`);
console.log(`   OpenClaw:  ${OPENCLAW_GATEWAY}`);
console.log(`   Poll:      every ${POLL_INTERVAL / 1000}s`);
console.log('═══════════════════════════════════════════════════\n');

// ═══════════════════════════════════════════════════════════════════════════════
// METHOD 1: WEBHOOK FORWARDER
// ═══════════════════════════════════════════════════════════════════════════════
//
// If OpenClaw supports webhooks/event hooks, add this URL as the webhook:
//   ${BLAZE_API_URL}/api/webhook/whatsapp
//
// The webhook expects a POST with this JSON body:
// {
//   "from": "27821234567",       // sender phone
//   "fromName": "John Doe",      // sender name (optional)
//   "body": "Hello there!",      // message text
//   "type": "text",              // message type
//   "messageId": "wa_msg_123",   // WhatsApp message ID
//   "timestamp": "2026-02-15T10:30:00Z"
// }
//
// If OpenClaw has a config file (e.g. .env or config.yaml), add:
//   WEBHOOK_URL=${BLAZE_API_URL}/api/webhook/whatsapp
//

// ═══════════════════════════════════════════════════════════════════════════════
// METHOD 2: GATEWAY LISTENER (if webhook not available)
// ═══════════════════════════════════════════════════════════════════════════════
//
// This polls OpenClaw's gateway for new messages and forwards them to Blaze OS.
// Only needed if OpenClaw doesn't support outgoing webhooks.

let lastCheckedMessageId = null;

async function checkIncomingMessages() {
  try {
    // Try to get recent messages from OpenClaw gateway
    // Adjust this endpoint based on your OpenClaw API
    const res = await fetch(`${OPENCLAW_GATEWAY}/api/messages?limit=10&since=${lastCheckedMessageId || ''}`);
    if (!res.ok) return;

    const data = await res.json();
    const messages = data.messages || data.data || data || [];

    for (const msg of messages) {
      if (msg.id === lastCheckedMessageId) continue;
      if (msg.fromMe) continue; // Skip our own messages

      // Forward to Blaze OS
      try {
        await fetch(`${BLAZE_API_URL}/api/webhook/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: msg.from || msg.sender || msg.phone,
            fromName: msg.pushName || msg.senderName || msg.name || '',
            body: msg.body || msg.text || msg.message || '',
            type: msg.type || 'text',
            messageId: msg.id || msg.messageId || '',
            timestamp: msg.timestamp || new Date().toISOString(),
            mediaUrl: msg.mediaUrl || msg.media || null,
            isGroup: msg.isGroup || false,
            groupName: msg.groupName || null
          })
        });
        console.log(`→ Forwarded to Blaze: ${(msg.body || '').substring(0, 50)}`);
        lastCheckedMessageId = msg.id;
      } catch (fwdErr) {
        console.error('Forward error:', fwdErr.message);
      }
    }
  } catch (err) {
    // OpenClaw gateway might not have this endpoint — that's okay
    // The webhook method is preferred
    if (!err.message?.includes('ECONNREFUSED')) {
      console.error('Incoming check error:', err.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTBOX POLLER: Blaze OS → OpenClaw → WhatsApp
// ═══════════════════════════════════════════════════════════════════════════════
//
// Polls the Blaze OS outbox for messages to send, then sends them via OpenClaw.

async function pollOutbox() {
  try {
    const res = await fetch(`${BLAZE_API_URL}/api/whatsapp/outbox`);
    if (!res.ok) return;

    const data = await res.json();
    const pending = data.data || [];

    for (const item of pending) {
      try {
        // Send via OpenClaw gateway
        // Adjust this endpoint/payload based on your OpenClaw API
        const sendRes = await fetch(`${OPENCLAW_GATEWAY}/api/send-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: item.phone,
            // OpenClaw might need the @s.whatsapp.net suffix
            to: item.phone.includes('@') ? item.phone : `${item.phone}@s.whatsapp.net`,
            message: item.body,
            text: item.body, // some gateways use 'text' instead of 'message'
            type: item.type || 'text'
          })
        });

        if (sendRes.ok) {
          // Mark as sent in Blaze OS
          await fetch(`${BLAZE_API_URL}/api/whatsapp/outbox/${item.id}/sent`, { method: 'POST' });
          console.log(`← Sent via WhatsApp: ${item.phone}: ${item.body.substring(0, 50)}`);
        } else {
          console.error(`Send failed (${sendRes.status}): ${item.phone}`);
        }
      } catch (sendErr) {
        console.error(`Send error to ${item.phone}:`, sendErr.message);
      }
    }
  } catch (err) {
    if (!err.message?.includes('ECONNREFUSED')) {
      console.error('Outbox poll error:', err.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALTERNATIVE: Express server that OpenClaw calls directly
// ═══════════════════════════════════════════════════════════════════════════════
//
// If OpenClaw supports calling a local webhook, run this mini server.
// OpenClaw would POST to http://localhost:3001/incoming
//
// Uncomment this block if you want to use it:

/*
const express = require('express');
const app = express();
app.use(express.json());

app.post('/incoming', async (req, res) => {
  const msg = req.body;
  try {
    await fetch(`${BLAZE_API_URL}/api/webhook/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: msg.from || msg.sender,
        fromName: msg.pushName || msg.name || '',
        body: msg.body || msg.text || '',
        type: msg.type || 'text',
        messageId: msg.id || '',
        timestamp: msg.timestamp || new Date().toISOString()
      })
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Forward error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('🔌 Local webhook server on port 3001'));
*/

// ═══════════════════════════════════════════════════════════════════════════════
// START POLLING
// ═══════════════════════════════════════════════════════════════════════════════
console.log('🔄 Starting outbox polling...\n');

// Poll outbox for outgoing messages
setInterval(pollOutbox, POLL_INTERVAL);

// Poll OpenClaw for incoming messages (only if webhook not configured)
setInterval(checkIncomingMessages, POLL_INTERVAL);

// Initial check
pollOutbox();
checkIncomingMessages();

// Keep alive
process.on('SIGINT', () => {
  console.log('\n🛑 Bridge stopped');
  process.exit();
});
