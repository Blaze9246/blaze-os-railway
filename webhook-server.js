#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// WhatsApp Webhook Bridge - Receives from OpenClaw, forwards to Railway
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const https = require('https');
const http = require('http');
const url = require('url');

const app = express();
app.use(express.json());

const RAILWAY_WEBHOOK = 'https://blaze-os-railway-production.up.railway.app/api/webhook/whatsapp';
const PORT = 18800;

console.log('═══════════════════════════════════════════════════');
console.log('📡 WhatsApp Webhook Bridge');
console.log(`   Port: ${PORT}`);
console.log(`   Forward to: ${RAILWAY_WEBHOOK}`);
console.log('═══════════════════════════════════════════════════\n');

// Receive webhooks from OpenClaw/Baileys
app.post('/webhook', (req, res) => {
  const data = req.body;
  
  console.log('📩 WhatsApp message received:', data.from);
  
  // Forward to Railway
  const payload = JSON.stringify({
    from: data.from || data.sender,
    fromName: data.pushName || data.name || '',
    body: data.body || data.text || data.message || '',
    type: data.type || 'text',
    messageId: data.id || data.messageId || '',
    timestamp: data.timestamp || new Date().toISOString(),
    isGroup: data.isGroup || false
  });
  
  const parsed = url.parse(RAILWAY_WEBHOOK);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port || 443,
    path: parsed.path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  };
  
  const request = https.request(options, (response) => {
    console.log(`→ Forwarded to Railway: ${response.statusCode}`);
    res.json({ ok: true });
  });
  
  request.on('error', (err) => {
    console.error('❌ Forward error:', err.message);
    res.status(500).json({ error: err.message });
  });
  
  request.write(payload);
  request.end();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Webhook server running on port ${PORT}`);
  console.log('');
  console.log('Next step: Configure OpenClaw to POST to:');
  console.log(`http://localhost:${PORT}/webhook`);
});
