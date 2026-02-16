// Telegram webhook handler for Railway app
// Add this to your index.js

const TELEGRAM_BOT_TOKEN = '7879731542:AAFWjAgJ0_qbEB7GIMuBtrDI_k3-YP3r9X0';
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Receive Telegram webhook
app.post('/api/webhook/telegram', express.json(), async (req, res) => {
  const { message } = req.body;
  if (!message) return res.sendStatus(200);
  
  const chatId = message.chat.id;
  const text = message.text;
  const user = message.from.first_name || 'User';
  
  console.log(`📩 Telegram from ${user}: ${text}`);
  
  // Store in database
  // TODO: Add your database storage here
  
  res.sendStatus(200);
});

// Send message to Telegram
async function sendTelegramMessage(chatId, text) {
  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (err) {
    console.error('Telegram send error:', err);
  }
}

// Set webhook on startup
fetch(`${TELEGRAM_API}/setWebhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://blaze-os-railway-production.up.railway.app/api/webhook/telegram'
  })
}).then(() => console.log('✅ Telegram webhook set'));
