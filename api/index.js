const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;

// Telegram bot config
const TELEGRAM_BOT_TOKEN = '7879731542:AAFWjAgJ0_qbEB7GlMuBtrDI_k3-YP3r9X0';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = '7630693719';

// In-memory storage for demo
const messages = [];

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get messages
app.get('/api/messages', (req, res) => {
  res.json({ success: true, data: messages });
});

// Telegram webhook - receive messages
app.post('/api/webhook/telegram', (req, res) => {
  const { message } = req.body;
  if (!message) return res.sendStatus(200);
  
  const msg = {
    id: Date.now(),
    sender: message.from.first_name || 'User',
    content: message.text,
    platform: 'telegram',
    timestamp: new Date().toISOString()
  };
  
  messages.push(msg);
  console.log('📩 Telegram message:', msg.content);
  
  res.sendStatus(200);
});

// Send message to Telegram
app.post('/api/send-telegram', async (req, res) => {
  const { text } = req.body;
  
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
    
    const data = await response.json();
    res.json({ success: data.ok });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
