// ═══════════════════════════════════════════════════════════════════════════════
// BLAZE STORAGE — File-based persistence with in-memory fallback
// ═══════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join('/tmp', 'data'); // Use /tmp for Railway
let useFileStorage = true;

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.warn('⚠️ Using in-memory storage (filesystem not writable)');
  useFileStorage = false;
}

class BlazeStorage {
  constructor() {
    this.collections = {};
    this.filePath = path.join(DATA_DIR, 'blaze-db.json');
    this.load();
    if (useFileStorage) {
      setInterval(() => this.save(), 30000);
    }
  }

  load() {
    if (!useFileStorage) {
      this.seed();
      return;
    }
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.collections = JSON.parse(raw);
        console.log('📂 Database loaded');
      } else {
        this.seed();
      }
    } catch (err) {
      console.error('❌ DB load error:', err.message);
      this.seed();
    }
  }

  save() {
    if (!useFileStorage) return;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.collections, null, 2));
    } catch (err) {
      console.error('❌ DB save error:', err.message);
    }
  }

  getAll(collection) {
    return Object.values(this.collections[collection] || {}).sort((a, b) => {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }

  get(collection, id) {
    return (this.collections[collection] || {})[id] || null;
  }

  create(collection, data) {
    if (!this.collections[collection]) this.collections[collection] = {};
    const id = data.id || uuidv4();
    const record = { id, ...data, createdAt: data.createdAt || new Date().toISOString() };
    this.collections[collection][id] = record;
    this.save();
    return record;
  }

  update(collection, id, data) {
    if (!this.collections[collection]?.[id]) return null;
    this.collections[collection][id] = { ...this.collections[collection][id], ...data, updatedAt: new Date().toISOString() };
    this.save();
    return this.collections[collection][id];
  }

  delete(collection, id) {
    if (!this.collections[collection]?.[id]) return false;
    delete this.collections[collection][id];
    this.save();
    return true;
  }

  count(collection) {
    return Object.keys(this.collections[collection] || {}).length;
  }

  query(collection, filterFn) {
    return this.getAll(collection).filter(filterFn);
  }

  seed() {
    console.log('🌱 Seeding database...');
    this.collections = {};

    const agents = [
      { id: 'hunter', name: 'Hunter Agent', role: 'Lead Discovery', status: 'idle', icon: '🎯', stats: { leadsFound: 234, successRate: 87 } },
      { id: 'outreach', name: 'Outreach Agent', role: 'Email Campaigns', status: 'idle', icon: '📧', stats: { messagesSent: 1847, openRate: 42 } },
      { id: 'creator', name: 'Creator Agent', role: 'Content Generation', status: 'idle', icon: '🎨', stats: { contentCreated: 89, postsPublished: 67 } },
      { id: 'whatsapp', name: 'WhatsApp Brain', role: 'Support', status: 'idle', icon: '💬', stats: { conversations: 156, responseTime: '2m' } }
    ];
    agents.forEach(a => this.create('agents', a));

    const leads = [
      { name: 'Lerato Molefe', company: 'Molefe Beauty', email: 'lerato@molefebeauty.co.za', score: 92, tier: 'HOT', source: 'referral' },
      { name: 'Ayanda Dlamini', company: 'Dlamini Logistics', email: 'ayanda@dlamini.co.za', score: 88, tier: 'HOT', source: 'systeme.io' }
    ];
    leads.forEach(l => this.create('leads', l));

    this.collections['conversations'] = {};
    this.collections['messages'] = {};
    this.collections['outbox'] = {};

    this.save();
    console.log('✅ Database seeded');
  }
}

module.exports = new BlazeStorage();
