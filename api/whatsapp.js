// ═══════════════════════════════════════════════════════════════════════════════
// BLAZE WHATSAPP SYNC — Two-way live chat with OpenClaw
// ═══════════════════════════════════════════════════════════════════════════════
//
// INCOMING: OpenClaw POSTs to /api/webhook/whatsapp → stored + broadcast via Socket.io
// OUTGOING: App sends reply → stored in outbox → OpenClaw polls /api/whatsapp/outbox
//
const { v4: uuidv4 } = require('uuid');
const storage = require('./storage');

class WhatsAppSync {
  constructor(io) {
    this.io = io;
  }

  // ─── Register Express routes ───────────────────────────────────────────
  registerRoutes(app) {

    // ═════════════════════════════════════════════════════════════════════
    // WEBHOOK: OpenClaw pushes incoming WhatsApp messages here
    // ═════════════════════════════════════════════════════════════════════
    app.post('/api/webhook/whatsapp', (req, res) => {
      try {
        const {
          from,          // sender phone number (e.g. "27615215148")
          fromName,      // sender display name
          to,            // recipient (your bot number)
          body,          // message text
          messageId,     // WhatsApp message ID
          timestamp,     // message timestamp
          type,          // message type: text, image, document, etc.
          mediaUrl,      // URL for media messages
          isGroup,       // boolean
          groupName,     // group name if group message
          pushName,      // WhatsApp push name
          quotedMessage, // if replying to a message
        } = req.body;

        // Normalize phone number
        const phone = this._normalizePhone(from);
        if (!phone) {
          return res.status(400).json({ success: false, error: 'Missing "from" field' });
        }

        const name = fromName || pushName || phone;

        // Get or create conversation
        let convo = this._getConversation(phone);
        if (!convo) {
          convo = storage.create('conversations', {
            phone,
            name,
            lastMessage: body || `[${type || 'message'}]`,
            lastMessageAt: new Date().toISOString(),
            unreadCount: 1,
            status: 'active',
            isGroup: !!isGroup,
            groupName: groupName || null,
            labels: [],
            notes: ''
          });
        } else {
          storage.update('conversations', convo.id, {
            name: name || convo.name,
            lastMessage: body || `[${type || 'message'}]`,
            lastMessageAt: new Date().toISOString(),
            unreadCount: (convo.unreadCount || 0) + 1,
            status: 'active'
          });
        }

        // Store message
        const message = storage.create('messages', {
          conversationId: convo.id,
          phone,
          direction: 'incoming',
          body: body || '',
          type: type || 'text',
          mediaUrl: mediaUrl || null,
          messageId: messageId || uuidv4(),
          quotedMessage: quotedMessage || null,
          senderName: name,
          timestamp: timestamp || new Date().toISOString(),
          status: 'received'
        });

        // Broadcast via Socket.io — instant in dashboard
        if (this.io) {
          this.io.emit('whatsapp:message', {
            conversation: storage.get('conversations', convo.id),
            message,
            timestamp: new Date().toISOString()
          });
          this.io.emit('notification', {
            type: 'info',
            message: `💬 New WhatsApp from ${name}: ${(body || '').substring(0, 50)}`
          });
        }

        console.log(`💬 WhatsApp IN: ${name} (${phone}): ${(body || '').substring(0, 60)}`);
        res.json({ success: true, messageId: message.id, conversationId: convo.id });

      } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Also support GET for webhook verification (some services ping GET first)
    app.get('/api/webhook/whatsapp', (req, res) => {
      res.json({ status: 'ok', service: 'Blaze OS WhatsApp Webhook', timestamp: new Date().toISOString() });
    });

    // ═════════════════════════════════════════════════════════════════════
    // CONVERSATIONS: List all chats
    // ═════════════════════════════════════════════════════════════════════
    app.get('/api/whatsapp/conversations', (req, res) => {
      const convos = storage.getAll('conversations');
      // Sort by lastMessageAt descending
      convos.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
      res.json({ success: true, data: convos });
    });

    // Get single conversation
    app.get('/api/whatsapp/conversations/:id', (req, res) => {
      const convo = storage.get('conversations', req.params.id);
      if (!convo) return res.status(404).json({ success: false, error: 'Not found' });
      res.json({ success: true, data: convo });
    });

    // Update conversation (labels, notes, mark read)
    app.put('/api/whatsapp/conversations/:id', (req, res) => {
      const convo = storage.update('conversations', req.params.id, req.body);
      if (!convo) return res.status(404).json({ success: false, error: 'Not found' });
      if (this.io) this.io.emit('whatsapp:conversation:update', convo);
      res.json({ success: true, data: convo });
    });

    // Mark conversation as read
    app.post('/api/whatsapp/conversations/:id/read', (req, res) => {
      const convo = storage.update('conversations', req.params.id, { unreadCount: 0 });
      if (!convo) return res.status(404).json({ success: false, error: 'Not found' });
      if (this.io) this.io.emit('whatsapp:conversation:update', convo);
      res.json({ success: true });
    });

    // ═════════════════════════════════════════════════════════════════════
    // MESSAGES: Get messages for a conversation
    // ═════════════════════════════════════════════════════════════════════
    app.get('/api/whatsapp/conversations/:id/messages', (req, res) => {
      const messages = storage.query('messages', m => m.conversationId === req.params.id);
      // Sort chronologically (oldest first for chat display)
      messages.sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));
      res.json({ success: true, data: messages });
    });

    // ═════════════════════════════════════════════════════════════════════
    // SEND: Reply from Blaze OS → queued for OpenClaw to pick up
    // ═════════════════════════════════════════════════════════════════════
    app.post('/api/whatsapp/send', (req, res) => {
      try {
        const { conversationId, phone, body, type } = req.body;

        if (!body) return res.status(400).json({ success: false, error: 'Message body required' });

        // Resolve phone from conversation if not provided
        let targetPhone = phone;
        let convo = null;
        if (conversationId) {
          convo = storage.get('conversations', conversationId);
          if (convo) targetPhone = convo.phone;
        }
        if (!targetPhone) return res.status(400).json({ success: false, error: 'No phone number' });

        targetPhone = this._normalizePhone(targetPhone);

        // Store the outgoing message
        const message = storage.create('messages', {
          conversationId: conversationId || null,
          phone: targetPhone,
          direction: 'outgoing',
          body,
          type: type || 'text',
          messageId: uuidv4(),
          senderName: 'Blaze Ignite',
          timestamp: new Date().toISOString(),
          status: 'queued' // queued → sent (when OpenClaw picks it up)
        });

        // Add to outbox for OpenClaw to poll
        storage.create('outbox', {
          messageId: message.id,
          phone: targetPhone,
          body,
          type: type || 'text',
          status: 'pending', // pending → sent → delivered
          createdAt: new Date().toISOString()
        });

        // Update conversation
        if (convo) {
          storage.update('conversations', convo.id, {
            lastMessage: body,
            lastMessageAt: new Date().toISOString()
          });
        }

        // Broadcast
        if (this.io) {
          this.io.emit('whatsapp:message', {
            conversation: convo ? storage.get('conversations', convo.id) : null,
            message,
            timestamp: new Date().toISOString()
          });
        }

        console.log(`💬 WhatsApp OUT (queued): ${targetPhone}: ${body.substring(0, 60)}`);
        res.json({ success: true, data: message });

      } catch (err) {
        console.error('Send error:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // ═════════════════════════════════════════════════════════════════════
    // OUTBOX: OpenClaw polls this to get messages to send
    // ═════════════════════════════════════════════════════════════════════
    app.get('/api/whatsapp/outbox', (req, res) => {
      const pending = storage.query('outbox', m => m.status === 'pending');
      res.json({ success: true, data: pending });
    });

    // OpenClaw marks a message as sent after delivering it
    app.post('/api/whatsapp/outbox/:id/sent', (req, res) => {
      const item = storage.update('outbox', req.params.id, { status: 'sent', sentAt: new Date().toISOString() });
      if (!item) return res.status(404).json({ success: false, error: 'Not found' });

      // Update the original message status too
      if (item.messageId) {
        storage.update('messages', item.messageId, { status: 'sent' });
      }
      if (this.io) this.io.emit('whatsapp:status', { messageId: item.messageId, status: 'sent' });
      res.json({ success: true });
    });

    // ═════════════════════════════════════════════════════════════════════
    // STATS
    // ═════════════════════════════════════════════════════════════════════
    app.get('/api/whatsapp/stats', (req, res) => {
      const convos = storage.getAll('conversations');
      const messages = storage.getAll('messages');
      const unread = convos.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

      res.json({
        success: true,
        data: {
          totalConversations: convos.length,
          activeConversations: convos.filter(c => c.status === 'active').length,
          totalMessages: messages.length,
          incoming: messages.filter(m => m.direction === 'incoming').length,
          outgoing: messages.filter(m => m.direction === 'outgoing').length,
          unreadCount: unread
        }
      });
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────
  _normalizePhone(phone) {
    if (!phone) return null;
    // Remove everything except digits
    let clean = phone.replace(/[^\d]/g, '');
    // Remove @s.whatsapp.net suffix if present
    clean = clean.replace(/@.*$/, '');
    // Add country code if missing (default to ZA +27)
    if (clean.startsWith('0') && clean.length === 10) {
      clean = '27' + clean.substring(1);
    }
    return clean || null;
  }

  _getConversation(phone) {
    const convos = storage.query('conversations', c => c.phone === phone);
    return convos[0] || null;
  }
}

module.exports = WhatsAppSync;
