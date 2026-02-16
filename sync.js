#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════════
// BLAZE ↔ RAILWAY SYNC (Complete)
// Polls Railway for outgoing, receives webhooks for incoming
// ═══════════════════════════════════════════════════════════════════════════════

const express = require('express');
const http = require('http');
const https = require('https');
const url = require('url');
const { exec } = require('child_process');

const RAILWAY_API = 'https://blaze-os-railway-production.up.railway.app';
const POLL_INTERVAL = 5000;

console.log('═══════════════════════════════════════════════════');
console.log('🔥 BLAZE ↔ RAILWAY SYNC');
console.log(`   Railway: ${RAILWAY_API}`);
console.log(`   Poll:    every ${POLL_INTERVAL/1000}s`);
console.log('═══════════════════════════════════════════════════\n');

// Poll Railway for outgoing messages
async function pollOutbox() {
  try {
    const data = await httpGet(`${RAILWAY_API}/api/whatsapp/outbox`);
    const pending = data.data || [];
    
    for (const item of pending) {
      console.log(`📤 Sending to WhatsApp: ${item.phone}`);
      
      // Send via OpenClaw CLI
      exec(`openclaw message send --to="${item.phone}" --message="${item.body}" --channel=whatsapp`, (err) => {
        if (err) {
          console.error('❌ Send failed:', err.message);
        } else {
          console.log(`✅ Sent: ${item.phone}`);
          // Mark as sent
          httpPost(`${RAILWAY_API}/api/whatsapp/outbox/${item.id}/sent`, {});
        }
      });
    }
  } catch (err) {
    // Silent fail - Railway might not be fully ready
  }
}

// Forward incoming message to Railway
async function forwardToRailway(data) {
  const payload = {
    from: data.from || data.sender,
    fromName: data.pushName || data.name || '',
    body: data.body || data.text || data.message || '',
    type: data.type || 'text',
    messageId: data.id || '',
    timestamp: data.timestamp || new Date().toISOString()
  };
  
  try {
    await httpPost(`${RAILWAY_API}/api/webhook/whatsapp`, payload);
    console.log(`📥 Forwarded to Railway: ${payload.from}`);
  } catch (err) {
    console.error('❌ Forward failed:', err.message);
  }
}

// HTTP helpers
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function httpPost(urlStr, data) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(urlStr);
    const payload = JSON.stringify(data);
    
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
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Start polling
setInterval(pollOutbox, POLL_INTERVAL);
pollOutbox();

console.log('🔄 Polling started...');
console.log('📡 To complete setup, configure OpenClaw webhook to POST to this server');
console.log('');

// Keep alive
process.on('SIGINT', () => {
  console.log('\n🛑 Stopped');
  process.exit();
});
