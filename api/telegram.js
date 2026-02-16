// Telegram integration for Railway app
const TELEGRAM_BOT_TOKEN = '7879731542:AAFWjAgJ0_qbEB7GlMuBtrDI_k3-YP3r9X0';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = '7630693719';

// Receive Telegram webhook
app.post('/api/webhook/telegram', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.sendStatus(200);
  
  const chatId = message.chat.id;
  const text = message.text;
  const user = message.from.first_name || 'User';
  
  console.log(`📩 Telegram from ${user}: ${text}`);
  
  // Store message in database
  storage.create('messages', {
    sender: 'user',
    content: text,
    platform: 'telegram',
    chatId: chatId.toString(),
    timestamp: new Date().toISOString()
  });
  
  // Broadcast to Socket.io (if using)
  if (io) {
    io.emit('telegram:message', { user, text, timestamp: new Date().toISOString() });
  }
  
  res.sendStatus(200);
});

// Send message to Telegram
async function sendTelegramMessage(text) {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text })
    });
    const data = await response.json();
    console.log('📤 Sent to Telegram:', data.ok ? 'OK' : 'Failed');
    return data;
  } catch (err) {
    console.error('Telegram send error:', err.message);
  }
}

// Export for use in routes
module.exports = { sendTelegramMessage };
