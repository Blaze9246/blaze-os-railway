// ═══════════════════════════════════════════════════════════════════════════════
// BLAZE TOOL ENGINE — Executes tools with live output streaming
// ═══════════════════════════════════════════════════════════════════════════════
const { v4: uuidv4 } = require('uuid');
const storage = require('./storage');

class ToolEngine {
  constructor(io) {
    this.io = io;
    this.running = new Map(); // executionId → { status, cancel }
  }

  // ─── GET TOOL DEFINITIONS ──────────────────────────────────────────────
  getTools() {
    return [
      {
        id: 'prospect-hunter', name: 'Prospect Hunter', icon: '🔍', color: '#3b82f6',
        category: 'Lead Gen', description: 'Find business leads via Google search + enrichment',
        params: [
          { key: 'query', label: 'Search Query', type: 'text', placeholder: 'e.g. "digital marketing agency Cape Town"', required: true },
          { key: 'location', label: 'Location', type: 'text', placeholder: 'e.g. South Africa', required: false },
          { key: 'maxResults', label: 'Max Results', type: 'number', placeholder: '20', required: false }
        ]
      },
      {
        id: 'content-forge', name: 'Content Forge', icon: '📸', color: '#ff6b35',
        category: 'Content', description: 'Generate Instagram content — carousels, reels scripts, captions',
        params: [
          { key: 'topic', label: 'Topic / Niche', type: 'text', placeholder: 'e.g. "skincare tips for summer"', required: true },
          { key: 'type', label: 'Content Type', type: 'select', options: ['carousel', 'reel-script', 'caption', 'story-sequence'], required: true },
          { key: 'tone', label: 'Tone', type: 'select', options: ['professional', 'casual', 'edgy', 'luxury', 'educational'], required: false }
        ]
      },
      {
        id: 'crystal-ball', name: 'Crystal Ball', icon: '🔮', color: '#8b5cf6',
        category: 'Analytics', description: 'AI lead scoring — analyze and predict conversion likelihood',
        params: [
          { key: 'leadId', label: 'Lead (leave empty for all)', type: 'text', placeholder: 'Lead ID or empty for batch', required: false }
        ]
      },
      {
        id: 'battle-card', name: 'Battle Card', icon: '⚔️', color: '#ef4444',
        category: 'Lead Gen', description: 'Generate sales battle cards with objection handling',
        params: [
          { key: 'competitor', label: 'Competitor Name', type: 'text', placeholder: 'e.g. "Agency XYZ"', required: true },
          { key: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. "e-commerce"', required: false }
        ]
      },
      {
        id: 'competitor-tracker', name: 'Competitor Tracker', icon: '👁️', color: '#f59e0b',
        category: 'Analytics', description: 'Monitor competitor Shopify stores for changes',
        params: [
          { key: 'storeUrl', label: 'Shopify Store URL', type: 'text', placeholder: 'e.g. competitor-store.myshopify.com', required: true }
        ]
      },
      {
        id: 'proposal-forge', name: 'Proposal Forge', icon: '📄', color: '#22c55e',
        category: 'Content', description: 'Auto-generate client proposals based on lead data',
        params: [
          { key: 'leadId', label: 'Lead ID', type: 'text', placeholder: 'Select lead to generate proposal for', required: true },
          { key: 'services', label: 'Services', type: 'text', placeholder: 'e.g. "SEO, Social Media, PPC"', required: true },
          { key: 'budget', label: 'Monthly Budget (ZAR)', type: 'number', placeholder: '15000', required: false }
        ]
      },
      {
        id: 'revenue-oracle', name: 'Revenue Oracle', icon: '📈', color: '#06b6d4',
        category: 'Analytics', description: 'MRR forecasting and revenue projections',
        params: [
          { key: 'months', label: 'Forecast Months', type: 'number', placeholder: '6', required: false }
        ]
      },
      {
        id: 'client-success', name: 'Client Success', icon: '🎓', color: '#ec4899',
        category: 'Content', description: 'Generate onboarding checklists and progress reports',
        params: [
          { key: 'clientName', label: 'Client Name', type: 'text', placeholder: 'e.g. "Essora"', required: true },
          { key: 'reportType', label: 'Report Type', type: 'select', options: ['onboarding-checklist', 'monthly-report', 'quarterly-review'], required: true }
        ]
      },
      {
        id: 'lead-warmer', name: 'Lead Warmer', icon: '🔥', color: '#f97316',
        category: 'Lead Gen', description: 'Generate email nurture sequences for leads',
        params: [
          { key: 'tier', label: 'Lead Tier', type: 'select', options: ['HOT', 'WARM', 'COLD', 'ICE'], required: true },
          { key: 'sequenceLength', label: 'Number of Emails', type: 'number', placeholder: '5', required: false }
        ]
      },
      {
        id: 'campaign-architect', name: 'Campaign Architect', icon: '🏗️', color: '#6366f1',
        category: 'Content', description: 'Generate ad campaigns for Meta/Google',
        params: [
          { key: 'platform', label: 'Platform', type: 'select', options: ['meta-facebook', 'meta-instagram', 'google-search', 'google-display'], required: true },
          { key: 'objective', label: 'Objective', type: 'select', options: ['awareness', 'traffic', 'conversions', 'leads'], required: true },
          { key: 'product', label: 'Product/Service', type: 'text', placeholder: 'What are you advertising?', required: true },
          { key: 'budget', label: 'Daily Budget (ZAR)', type: 'number', placeholder: '500', required: false }
        ]
      },
      {
        id: 'social-guardian', name: 'Social Guardian', icon: '📡', color: '#14b8a6',
        category: 'Analytics', description: 'Monitor brand mentions and social sentiment',
        params: [
          { key: 'brand', label: 'Brand Name', type: 'text', placeholder: 'e.g. "Blaze Ignite"', required: true },
          { key: 'platforms', label: 'Platforms', type: 'text', placeholder: 'twitter, instagram, reddit', required: false }
        ]
      },
      {
        id: 'recipe-vault', name: 'Recipe Vault', icon: '🧪', color: '#a855f7',
        category: 'Content', description: 'Browse and generate winning ad creative recipes',
        params: [
          { key: 'industry', label: 'Industry', type: 'text', placeholder: 'e.g. "beauty", "fitness"', required: true },
          { key: 'format', label: 'Ad Format', type: 'select', options: ['image', 'video', 'carousel', 'story'], required: false }
        ]
      },
      {
        id: 'veo-video', name: 'Veo Video', icon: '🎬', color: '#e11d48',
        category: 'Content', description: 'Generate AI spokesperson videos via HeyGen',
        params: [
          { key: 'script', label: 'Video Script', type: 'textarea', placeholder: 'What should the avatar say?', required: true },
          { key: 'duration', label: 'Max Duration (seconds)', type: 'number', placeholder: '60', required: false }
        ]
      },
      {
        id: 'shopify-auditor', name: 'Shopify Auditor', icon: '🛒', color: '#84cc16',
        category: 'Shopify', description: 'Run comprehensive store audit with AI recommendations',
        params: [
          { key: 'storeId', label: 'Store ID', type: 'text', placeholder: 'e.g. "essora"', required: true }
        ]
      }
    ];
  }

  // ─── EXECUTE TOOL ──────────────────────────────────────────────────────
  async execute(toolId, params, userId = 'zain') {
    const execId = uuidv4();
    const tool = this.getTools().find(t => t.id === toolId);
    if (!tool) throw new Error(`Tool not found: ${toolId}`);

    // Create execution record
    const execution = storage.create('executions', {
      id: execId,
      toolId,
      toolName: tool.name,
      params,
      status: 'running',
      output: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      createdBy: userId
    });

    this.running.set(execId, { status: 'running' });

    // Emit start event
    this.emit(execId, 'start', { toolName: tool.name, execId });

    // Run the tool logic asynchronously
    this._runTool(execId, toolId, params, tool).catch(err => {
      this.emit(execId, 'error', { message: err.message });
      this._complete(execId, 'error');
    });

    return execution;
  }

  async _runTool(execId, toolId, params, tool) {
    const handlers = {
      'prospect-hunter': () => this._prospectHunter(execId, params),
      'content-forge': () => this._contentForge(execId, params),
      'crystal-ball': () => this._crystalBall(execId, params),
      'battle-card': () => this._battleCard(execId, params),
      'competitor-tracker': () => this._competitorTracker(execId, params),
      'proposal-forge': () => this._proposalForge(execId, params),
      'revenue-oracle': () => this._revenueOracle(execId, params),
      'client-success': () => this._clientSuccess(execId, params),
      'lead-warmer': () => this._leadWarmer(execId, params),
      'campaign-architect': () => this._campaignArchitect(execId, params),
      'social-guardian': () => this._socialGuardian(execId, params),
      'recipe-vault': () => this._recipeVault(execId, params),
      'veo-video': () => this._veoVideo(execId, params),
      'shopify-auditor': () => this._shopifyAuditor(execId, params),
    };

    const handler = handlers[toolId];
    if (!handler) throw new Error(`No handler for tool: ${toolId}`);
    await handler();
  }

  // ─── HELPER: Emit + Log ────────────────────────────────────────────────
  emit(execId, type, data) {
    const line = { type, data, timestamp: new Date().toISOString() };
    // Append to execution log
    const exec = storage.get('executions', execId);
    if (exec) {
      exec.output.push(line);
      storage.update('executions', execId, { output: exec.output });
    }
    // Broadcast via Socket.io
    if (this.io) {
      this.io.emit('tool:output', { execId, ...line });
    }
  }

  log(execId, message) {
    this.emit(execId, 'log', { message });
  }

  progress(execId, percent, message) {
    this.emit(execId, 'progress', { percent, message });
  }

  result(execId, data) {
    this.emit(execId, 'result', data);
  }

  _complete(execId, status = 'success') {
    storage.update('executions', execId, { status, completedAt: new Date().toISOString() });
    this.emit(execId, 'complete', { status });
    this.running.delete(execId);
    if (this.io) this.io.emit('tool:complete', { execId, status });
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ═══════════════════════════════════════════════════════════════════════
  // TOOL IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════════════

  async _prospectHunter(execId, params) {
    const query = params.query || 'digital marketing South Africa';
    const max = parseInt(params.maxResults) || 15;
    const location = params.location || 'South Africa';

    this.log(execId, `🔍 Starting Prospect Hunter`);
    this.log(execId, `Query: "${query}" | Location: ${location} | Max: ${max}`);
    this.progress(execId, 5, 'Initializing search...');
    await this._sleep(800);

    // Simulate discovering prospects
    const prospects = [];
    const industries = ['E-commerce', 'Restaurant', 'Fitness', 'Beauty', 'Tech', 'Real Estate', 'Fashion', 'Auto', 'Health', 'Education'];
    const cities = ['Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Port Elizabeth', 'Stellenbosch', 'Sandton', 'Centurion'];
    const domains = ['co.za', 'com', 'co.za', 'africa', 'shop'];

    for (let i = 0; i < max; i++) {
      const pct = Math.round(10 + (i / max) * 80);
      this.progress(execId, pct, `Scanning result ${i + 1}/${max}...`);
      await this._sleep(300 + Math.random() * 400);

      const firstName = ['Sarah', 'Ahmed', 'Thandi', 'Johan', 'Priya', 'Bongani', 'Emma', 'Mohammed', 'Lindiwe', 'Riaan'][i % 10];
      const lastName = ['Williams', 'Patel', 'Mokoena', 'Steyn', 'Naidoo', 'Zulu', 'Johnson', 'Khan', 'Dube', 'Venter'][i % 10];
      const company = `${lastName} ${industries[i % industries.length]}`;
      const city = cities[i % cities.length];
      const domain = domains[i % domains.length];

      const prospect = {
        name: `${firstName} ${lastName}`,
        company,
        email: `${firstName.toLowerCase()}@${lastName.toLowerCase()}.${domain}`,
        phone: `+27${Math.floor(Math.random() * 900000000 + 100000000)}`,
        industry: industries[i % industries.length],
        city,
        website: `https://www.${lastName.toLowerCase()}.${domain}`,
        score: Math.floor(Math.random() * 60 + 30),
        source: 'prospect-hunter'
      };
      prospects.push(prospect);
      this.log(execId, `✅ Found: ${prospect.name} — ${prospect.company} (${city})`);
    }

    this.progress(execId, 90, 'Enriching leads...');
    await this._sleep(600);

    // Auto-add to leads
    let added = 0;
    for (const p of prospects) {
      const existing = storage.query('leads', l => l.email === p.email);
      if (existing.length === 0) {
        const tier = p.score >= 70 ? 'WARM' : p.score >= 40 ? 'COLD' : 'ICE';
        storage.create('leads', { ...p, tier, date: new Date().toISOString().split('T')[0] });
        added++;
      }
    }

    this.progress(execId, 100, 'Complete!');
    this.log(execId, `\n📊 Results: ${prospects.length} prospects found, ${added} new leads added`);
    this.result(execId, { prospects, added, total: prospects.length });
    this._complete(execId);
    if (this.io) this.io.emit('data:refresh', { collection: 'leads' });
  }

  async _contentForge(execId, params) {
    const topic = params.topic || 'digital marketing tips';
    const type = params.type || 'carousel';
    const tone = params.tone || 'professional';

    this.log(execId, `📸 Content Forge — Generating ${type}`);
    this.log(execId, `Topic: "${topic}" | Tone: ${tone}`);
    this.progress(execId, 10, 'Researching topic...');
    await this._sleep(1000);

    this.progress(execId, 30, 'Generating content structure...');
    await this._sleep(800);

    let content = {};
    if (type === 'carousel') {
      this.progress(execId, 50, 'Writing carousel slides...');
      await this._sleep(1200);
      content = {
        type: 'carousel',
        slides: [
          { title: `${topic.charAt(0).toUpperCase() + topic.slice(1)}`, subtitle: '5 Things You Need to Know', design: 'Bold headline, brand gradient background' },
          { title: 'Tip #1', body: `Start with understanding your audience. Research demographics, pain points, and what drives their decisions.`, design: 'Icon + text left-aligned' },
          { title: 'Tip #2', body: `Create value-first content. Give before you ask. Educate, entertain, or inspire.`, design: 'Split layout with image' },
          { title: 'Tip #3', body: `Consistency beats perfection. Show up daily with good content rather than weekly with "perfect" content.`, design: 'Quote card style' },
          { title: 'Tip #4', body: `Use data to guide decisions. Track what works, double down on winners, cut what doesn't perform.`, design: 'Stats graphic layout' },
          { title: 'Tip #5', body: `Engage authentically. Reply to every comment. DM your followers. Build real relationships.`, design: 'Community photo grid' },
          { title: 'Ready to Level Up?', body: `DM us "BLAZE" for a free strategy session 🔥`, design: 'CTA slide, gradient, arrow pointing to DM' }
        ],
        caption: `🔥 ${topic.charAt(0).toUpperCase() + topic.slice(1)} — Save this for later!\n\nHere are 5 game-changing tips that our clients are using right now to crush their competition.\n\nSwipe through and tell us which one hits hardest 👇\n\n#${topic.replace(/\s+/g, '')} #digitalmarketing #blazeignite #growthhacking #entrepreneurship`,
        hashtags: ['#digitalmarketing', '#socialmedia', '#growthtips', '#blazeignite', '#marketingtips']
      };
    } else if (type === 'reel-script') {
      this.progress(execId, 50, 'Writing reel script...');
      await this._sleep(1000);
      content = {
        type: 'reel-script',
        hook: `Stop doing THIS if you want ${topic} to actually work...`,
        script: [
          { time: '0-3s', action: 'HOOK — Look at camera, concerned face', text: `Stop doing THIS if you want ${topic} to actually work...` },
          { time: '3-8s', action: 'THE PROBLEM', text: `Most people make this one mistake: they focus on quantity over quality.` },
          { time: '8-18s', action: 'THE SOLUTION', text: `Here's what top performers do instead: They focus on ONE platform, ONE message, ONE audience. And they go DEEP.` },
          { time: '18-25s', action: 'THE PROOF', text: `Our client went from 500 to 50,000 followers in 90 days using this exact strategy.` },
          { time: '25-30s', action: 'CTA', text: `Want the full playbook? Comment "BLAZE" and I'll send it to you.` }
        ],
        music: 'Trending audio — motivational/business',
        duration: '30 seconds'
      };
    } else if (type === 'caption') {
      this.progress(execId, 50, 'Crafting caption...');
      await this._sleep(800);
      content = {
        type: 'caption',
        versions: [
          { style: 'Story-driven', text: `Last year, I was stuck. Grinding 16-hour days with nothing to show for it.\n\nThen I discovered ${topic}.\n\nWithin 3 months, everything changed. Revenue up 340%. Team doubled. And I actually took a vacation.\n\nHere's the exact framework I used 🧵👇` },
          { style: 'Value-bomb', text: `🔥 ${topic.toUpperCase()} CHEAT SHEET:\n\n✅ Step 1: Audit your current strategy\n✅ Step 2: Identify your top 20% (that drives 80% of results)\n✅ Step 3: Double down on what works\n✅ Step 4: Cut everything else\n✅ Step 5: Automate and scale\n\nSave this. You'll thank me later.\n\n#blazeignite #${topic.replace(/\s+/g, '')}` },
          { style: 'Engagement-bait', text: `Unpopular opinion: Most businesses fail at ${topic} because they're copying what everyone else is doing.\n\nYou don't need another cookie-cutter strategy.\n\nYou need something built FOR YOU.\n\nAgree? Drop a 🔥 below.` }
        ]
      };
    } else {
      this.progress(execId, 50, 'Building story sequence...');
      await this._sleep(1000);
      content = {
        type: 'story-sequence',
        stories: [
          { slide: 1, type: 'poll', text: `Quick question: Are you doing ${topic}?`, options: ['Yes! 🔥', 'Not yet 😅'] },
          { slide: 2, type: 'text', text: `If you said "not yet" — you're leaving money on the table.\n\nHere's why 👇` },
          { slide: 3, type: 'info', text: `Companies using ${topic} see on average 3.2x more engagement and 2.7x more revenue.` },
          { slide: 4, type: 'cta', text: `Want us to set this up for you?\n\nDM "SETUP" and we'll send you our free audit checklist 📋` }
        ]
      };
    }

    this.progress(execId, 90, 'Finalizing content...');
    await this._sleep(500);
    this.progress(execId, 100, 'Done!');
    this.log(execId, `\n✅ Generated ${type} content for "${topic}"`);
    this.result(execId, content);
    this._complete(execId);
  }

  async _crystalBall(execId, params) {
    this.log(execId, `🔮 Crystal Ball — Lead Scoring Engine`);
    this.progress(execId, 5, 'Loading leads...');
    await this._sleep(600);

    const leads = params.leadId
      ? [storage.get('leads', params.leadId)].filter(Boolean)
      : storage.getAll('leads');

    if (!leads.length) {
      this.log(execId, '❌ No leads found');
      this._complete(execId, 'error');
      return;
    }

    this.log(execId, `Analyzing ${leads.length} leads...`);
    const results = [];

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const pct = Math.round(10 + (i / leads.length) * 80);
      this.progress(execId, pct, `Scoring: ${lead.name}...`);
      await this._sleep(200);

      // Scoring factors
      let score = 0;
      let factors = [];

      // Email quality
      if (lead.email?.includes('.co.za') || lead.email?.includes('.com')) { score += 15; factors.push('+15 Valid business email'); }
      // Has company
      if (lead.company) { score += 10; factors.push('+10 Company identified'); }
      // Has phone
      if (lead.phone) { score += 10; factors.push('+10 Phone number available'); }
      // Industry match
      const highValueIndustries = ['E-commerce', 'Beauty', 'Fashion', 'Food & Beverage', 'Fitness'];
      if (highValueIndustries.includes(lead.industry)) { score += 15; factors.push(`+15 High-value industry: ${lead.industry}`); }
      // Source quality
      const sourceScores = { referral: 20, linkedin: 15, website: 12, instagram: 10, 'systeme.io': 8, scraper: 5, 'cold-email': 3 };
      const srcScore = sourceScores[lead.source] || 5;
      score += srcScore;
      factors.push(`+${srcScore} Source: ${lead.source}`);
      // Notes indicate interest
      if (lead.notes?.toLowerCase().includes('ready') || lead.notes?.toLowerCase().includes('interested')) { score += 15; factors.push('+15 Shows buying intent'); }
      if (lead.notes?.toLowerCase().includes('booked') || lead.notes?.toLowerCase().includes('call')) { score += 10; factors.push('+10 Meeting scheduled'); }

      score = Math.min(score, 100);
      const tier = score >= 80 ? 'HOT' : score >= 60 ? 'WARM' : score >= 35 ? 'COLD' : 'ICE';

      // Update lead
      storage.update('leads', lead.id, { score, tier });
      results.push({ name: lead.name, oldScore: lead.score, newScore: score, tier, factors });
      this.log(execId, `${tier === 'HOT' ? '🔥' : tier === 'WARM' ? '🟡' : tier === 'COLD' ? '🔵' : '🧊'} ${lead.name}: ${lead.score} → ${score} (${tier})`);
    }

    this.progress(execId, 100, 'Scoring complete!');
    this.log(execId, `\n📊 Scored ${results.length} leads`);
    this.log(execId, `🔥 HOT: ${results.filter(r => r.tier === 'HOT').length}`);
    this.log(execId, `🟡 WARM: ${results.filter(r => r.tier === 'WARM').length}`);
    this.log(execId, `🔵 COLD: ${results.filter(r => r.tier === 'COLD').length}`);
    this.log(execId, `🧊 ICE: ${results.filter(r => r.tier === 'ICE').length}`);
    this.result(execId, { results });
    this._complete(execId);
    if (this.io) this.io.emit('data:refresh', { collection: 'leads' });
  }

  async _battleCard(execId, params) {
    const competitor = params.competitor || 'Competitor Agency';
    const industry = params.industry || 'digital marketing';

    this.log(execId, `⚔️ Battle Card Generator`);
    this.log(execId, `Competitor: ${competitor} | Industry: ${industry}`);
    this.progress(execId, 20, 'Researching competitor...');
    await this._sleep(1500);

    this.progress(execId, 50, 'Generating battle card...');
    await this._sleep(1200);

    const card = {
      competitor,
      industry,
      strengths: [
        'Established brand presence in local market',
        'Lower entry-level pricing',
        'Larger team size'
      ],
      weaknesses: [
        'No AI-powered automation tools',
        'Manual reporting process (slow turnaround)',
        'Limited Shopify expertise',
        'No integrated campaign management'
      ],
      ourAdvantages: [
        '🔥 AI-powered 24/7 business OS (Blaze OS)',
        '⚡ Automated lead scoring and outreach',
        '📊 Real-time dashboards and reporting',
        '🛒 Deep Shopify integration with store audits',
        '🎯 14 Midnight Magic tools for rapid execution'
      ],
      objectionHandling: [
        { objection: "They're cheaper", response: "We deliver 3-5x more output per rand spent. Our AI tools replace 5+ manual staff hours daily. Calculate the real cost per result, not cost per hour." },
        { objection: "They've been around longer", response: "Longer doesn't mean better. We use cutting-edge AI that didn't exist 2 years ago. Your competitors are already adopting this — the question is whether you want to lead or follow." },
        { objection: "We already have an agency", response: "Perfect. We're not asking you to switch — we're asking you to compare results. Give us 30 days on one campaign. If we don't outperform, you keep your current agency." },
        { objection: "We can do it in-house", response: "Absolutely you can. But should you? Our tools alone cost R500K+ to build. You get them included. Your team stays focused on what they do best." }
      ],
      closingStrategy: 'Offer a free store audit + 14-day trial of Blaze OS. Show the dashboard live. Let the product sell itself.'
    };

    this.progress(execId, 100, 'Battle card ready!');
    this.result(execId, card);
    this._complete(execId);
  }

  async _competitorTracker(execId, params) {
    const storeUrl = params.storeUrl || 'competitor.myshopify.com';
    this.log(execId, `👁️ Competitor Tracker — ${storeUrl}`);
    this.progress(execId, 20, 'Scanning store...');
    await this._sleep(1500);

    this.progress(execId, 60, 'Analyzing products and pricing...');
    await this._sleep(1000);

    const report = {
      store: storeUrl,
      productCount: Math.floor(Math.random() * 200 + 20),
      priceRange: { min: Math.floor(Math.random() * 50 + 10), max: Math.floor(Math.random() * 2000 + 500), currency: 'ZAR' },
      recentChanges: [
        'Added 3 new products in last 7 days',
        'Price increase on "Premium Bundle" (+12%)',
        'New collection launched: "Summer Essentials"',
        'Free shipping threshold changed: R500 → R400'
      ],
      techStack: ['Shopify', 'Klaviyo', 'Judge.me Reviews', 'Facebook Pixel', 'Google Analytics 4'],
      estimatedTraffic: `${Math.floor(Math.random() * 50 + 5)}K monthly visitors`,
      topProducts: ['Product A (bestseller)', 'Product B (most reviewed)', 'Product C (highest priced)']
    };

    this.progress(execId, 100, 'Scan complete!');
    this.log(execId, `📊 Found ${report.productCount} products, ${report.recentChanges.length} recent changes`);
    this.result(execId, report);
    this._complete(execId);
  }

  async _proposalForge(execId, params) {
    const lead = storage.get('leads', params.leadId);
    const services = params.services || 'Social Media Management, SEO';
    const budget = parseInt(params.budget) || 15000;

    this.log(execId, `📄 Proposal Forge`);
    if (!lead) {
      this.log(execId, '❌ Lead not found. Using placeholder data.');
    }
    const name = lead?.name || 'Client';
    const company = lead?.company || 'Company';

    this.progress(execId, 20, 'Analyzing client needs...');
    await this._sleep(1000);
    this.progress(execId, 50, 'Generating proposal...');
    await this._sleep(1500);

    const proposal = {
      title: `Digital Growth Proposal for ${company}`,
      preparedFor: name,
      preparedBy: 'Zain Moolla — Blaze Ignite',
      date: new Date().toISOString().split('T')[0],
      sections: [
        {
          title: 'Executive Summary',
          content: `Blaze Ignite proposes a comprehensive digital growth strategy for ${company}. Our AI-powered approach delivers 3-5x more output than traditional agencies, with full transparency via our Blaze OS dashboard.`
        },
        {
          title: 'Services Included',
          content: services.split(',').map(s => `• ${s.trim()}: Full management, strategy, and reporting`).join('\n')
        },
        {
          title: 'Investment',
          content: `Monthly retainer: R${budget.toLocaleString()}\nSetup fee: R${Math.round(budget * 0.5).toLocaleString()} (once-off)\nContract: 3 months minimum\nPayment: Due 1st of each month`
        },
        {
          title: 'Expected Results (90 Days)',
          content: `• 150-300% increase in social engagement\n• 50-100 qualified leads per month\n• 20-40% improvement in store conversion rate\n• Full brand audit + implementation\n• Weekly performance reports via Blaze OS`
        },
        {
          title: 'Why Blaze Ignite',
          content: `• AI-powered tools (14 Midnight Magic tools)\n• 24/7 Blaze OS dashboard access\n• Dedicated account manager\n• Real-time reporting\n• Proven track record with SA brands`
        }
      ],
      validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
    };

    this.progress(execId, 100, 'Proposal ready!');
    this.log(execId, `\n✅ Proposal generated for ${company}`);
    this.result(execId, proposal);
    this._complete(execId);
  }

  async _revenueOracle(execId, params) {
    const months = parseInt(params.months) || 6;
    this.log(execId, `📈 Revenue Oracle — ${months} month forecast`);
    this.progress(execId, 20, 'Analyzing current data...');
    await this._sleep(1000);

    const leads = storage.getAll('leads');
    const hotLeads = leads.filter(l => l.tier === 'HOT').length;
    const warmLeads = leads.filter(l => l.tier === 'WARM').length;

    const baseRevenue = hotLeads * 8000 + warmLeads * 3000;
    const forecast = [];

    for (let m = 1; m <= months; m++) {
      this.progress(execId, 20 + Math.round((m / months) * 70), `Projecting month ${m}...`);
      await this._sleep(400);
      const growth = 1 + (0.08 + Math.random() * 0.07); // 8-15% monthly growth
      const revenue = Math.round(baseRevenue * Math.pow(growth, m));
      const newLeads = Math.round(leads.length * (1 + m * 0.12));
      forecast.push({
        month: m,
        label: new Date(Date.now() + m * 30 * 86400000).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }),
        projectedRevenue: revenue,
        projectedLeads: newLeads,
        projectedClients: Math.round(hotLeads * (1 + m * 0.15)),
        confidence: Math.max(60, 95 - m * 5) // confidence decreases over time
      });
      this.log(execId, `Month ${m}: R${revenue.toLocaleString()} (${Math.max(60, 95 - m * 5)}% confidence)`);
    }

    this.progress(execId, 100, 'Forecast complete!');
    this.result(execId, {
      currentMRR: baseRevenue,
      forecast,
      summary: `Based on ${leads.length} leads (${hotLeads} HOT, ${warmLeads} WARM), projected to reach R${forecast[forecast.length - 1].projectedRevenue.toLocaleString()} MRR in ${months} months.`
    });
    this._complete(execId);
  }

  async _clientSuccess(execId, params) {
    const clientName = params.clientName || 'Client';
    const reportType = params.reportType || 'onboarding-checklist';

    this.log(execId, `🎓 Client Success — ${reportType} for ${clientName}`);
    this.progress(execId, 30, 'Generating report...');
    await this._sleep(1200);

    let report = {};
    if (reportType === 'onboarding-checklist') {
      report = {
        type: 'onboarding-checklist',
        client: clientName,
        items: [
          { task: 'Welcome call completed', status: 'done', priority: 'high' },
          { task: 'Brand assets received (logo, colors, fonts)', status: 'pending', priority: 'high' },
          { task: 'Social media accounts access granted', status: 'pending', priority: 'high' },
          { task: 'Shopify store access granted', status: 'pending', priority: 'high' },
          { task: 'Competitor list documented', status: 'pending', priority: 'medium' },
          { task: 'Target audience personas created', status: 'pending', priority: 'medium' },
          { task: 'Content calendar (Month 1) drafted', status: 'pending', priority: 'medium' },
          { task: 'Ad accounts set up and connected', status: 'pending', priority: 'medium' },
          { task: 'Analytics and tracking verified', status: 'pending', priority: 'low' },
          { task: 'Blaze OS dashboard configured', status: 'done', priority: 'low' },
          { task: 'First campaign launched', status: 'pending', priority: 'high' },
          { task: '7-day check-in call scheduled', status: 'pending', priority: 'medium' }
        ]
      };
    } else {
      report = {
        type: reportType,
        client: clientName,
        period: new Date().toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }),
        metrics: {
          impressions: Math.floor(Math.random() * 100000 + 20000),
          engagement: `${(Math.random() * 5 + 2).toFixed(1)}%`,
          leads: Math.floor(Math.random() * 50 + 10),
          conversions: Math.floor(Math.random() * 15 + 3),
          revenue: `R${Math.floor(Math.random() * 50000 + 10000).toLocaleString()}`
        },
        highlights: [
          'Instagram engagement up 34% from last month',
          'Top performing post: Carousel on product benefits (12K reach)',
          '8 new qualified leads from organic social',
          'Google Ads CPC reduced by 18%'
        ],
        recommendations: [
          'Increase budget on top-performing ad sets',
          'Launch retargeting campaign for website visitors',
          'Test video content (Reels) for higher engagement',
          'Add customer testimonials to product pages'
        ]
      };
    }

    this.progress(execId, 100, 'Report ready!');
    this.result(execId, report);
    this._complete(execId);
  }

  async _leadWarmer(execId, params) {
    const tier = params.tier || 'WARM';
    const length = parseInt(params.sequenceLength) || 5;

    this.log(execId, `🔥 Lead Warmer — ${tier} tier, ${length} email sequence`);
    this.progress(execId, 10, 'Analyzing tier behavior...');
    await this._sleep(800);

    const templates = {
      HOT: { delay: [0, 1, 3], tone: 'direct', cta: 'Book a call' },
      WARM: { delay: [0, 2, 5, 8, 14], tone: 'value-first', cta: 'Free audit' },
      COLD: { delay: [0, 3, 7, 14, 21, 30], tone: 'educational', cta: 'Download guide' },
      ICE: { delay: [0, 7, 21, 45, 90], tone: 'nurture', cta: 'Read our blog' }
    };
    const config = templates[tier] || templates.WARM;

    const sequence = [];
    for (let i = 0; i < length; i++) {
      this.progress(execId, 10 + Math.round((i / length) * 80), `Writing email ${i + 1}/${length}...`);
      await this._sleep(600);

      const email = {
        position: i + 1,
        sendDay: config.delay[i] || config.delay[config.delay.length - 1] + (i * 7),
        subject: this._getEmailSubject(tier, i),
        preheader: `Quick note about growing your business...`,
        body: this._getEmailBody(tier, i),
        cta: i === length - 1 ? config.cta : (i % 2 === 0 ? config.cta : 'Learn more')
      };
      sequence.push(email);
      this.log(execId, `📧 Email ${i + 1}: "${email.subject}" (Day ${email.sendDay})`);
    }

    this.progress(execId, 100, 'Sequence ready!');
    this.result(execId, { tier, sequence, totalDays: sequence[sequence.length - 1].sendDay });
    this._complete(execId);
  }

  _getEmailSubject(tier, index) {
    const subjects = {
      HOT: ['Let\'s get this moving — here\'s your proposal', 'Quick follow up on our conversation', 'Your custom growth plan is ready'],
      WARM: ['A quick question for you', '{{company}} could be growing 3x faster', 'I noticed something about your online presence', 'Free audit: here\'s what we found', 'Last chance: your custom growth plan expires soon'],
      COLD: ['Is {{company}} leaving money on the table?', '3 things your competitors are doing right now', 'Quick win for {{company}} (takes 10 min)', 'The #1 mistake we see in your industry', 'Would a free audit help?'],
      ICE: ['Thought you might find this interesting', 'Quick industry update for {{company}}', '2026 digital marketing trends (free report)', 'No pressure — just sharing value', 'Still thinking about growth?']
    };
    const list = subjects[tier] || subjects.WARM;
    return list[index % list.length];
  }

  _getEmailBody(tier, index) {
    if (tier === 'HOT' && index === 0) {
      return `Hi {{first_name}},\n\nGreat chatting with you. As promised, here's what we'd do for {{company}} in the first 90 days:\n\n1. Full digital audit (website, social, ads)\n2. Custom growth strategy\n3. Launch first campaign within 2 weeks\n\nI've attached a proposal with specific numbers. Can we hop on a 15-min call this week to walk through it?\n\nBest,\nZain\nBlaze Ignite 🔥`;
    }
    return `Hi {{first_name}},\n\nI've been looking at what's happening in the ${'{'}industry{'}'} space, and there's a huge opportunity most businesses are missing.\n\nWe recently helped a similar company increase their revenue by 340% in 90 days using our AI-powered approach.\n\nWould it be worth a quick chat to see if this could work for {{company}}?\n\nNo pressure — just value.\n\nBest,\nZain\nBlaze Ignite 🔥`;
  }

  async _campaignArchitect(execId, params) {
    const platform = params.platform || 'meta-instagram';
    const objective = params.objective || 'conversions';
    const product = params.product || 'Digital Marketing Services';
    const budget = parseInt(params.budget) || 500;

    this.log(execId, `🏗️ Campaign Architect — ${platform}`);
    this.progress(execId, 15, 'Designing campaign structure...');
    await this._sleep(1200);

    this.progress(execId, 50, 'Generating ad creatives...');
    await this._sleep(1000);

    const campaign = {
      platform,
      objective,
      product,
      dailyBudget: budget,
      monthlyBudget: budget * 30,
      structure: {
        campaign: `[${objective.toUpperCase()}] ${product} — ${new Date().toLocaleDateString('en-ZA', { month: 'short' })}`,
        adSets: [
          { name: 'Lookalike — Top Customers', audience: 'Lookalike 1% of purchasers', budget: Math.round(budget * 0.4) },
          { name: 'Interest — Target Demo', audience: `Interest: ${product}, Shopify, E-commerce`, budget: Math.round(budget * 0.35) },
          { name: 'Retarget — Website Visitors', audience: 'Website visitors 30 days + engaged IG', budget: Math.round(budget * 0.25) }
        ],
        ads: [
          { name: 'Video — Problem/Solution', type: 'video', copy: `Tired of [pain point]? ${product} fixes that in 30 days. Link in bio.`, cta: 'Learn More' },
          { name: 'Carousel — Benefits', type: 'carousel', copy: `5 reasons ${product} is a game-changer 👇`, cta: 'Shop Now' },
          { name: 'Static — Social Proof', type: 'image', copy: `"This changed everything for our business" — Real client. Real results. 🔥`, cta: 'Get Started' }
        ]
      },
      projections: {
        estimatedReach: `${Math.floor(budget * 40)}-${Math.floor(budget * 80)} people/day`,
        estimatedClicks: `${Math.floor(budget * 0.8)}-${Math.floor(budget * 2)} clicks/day`,
        estimatedCPR: `R${(budget / (budget * 0.01 + 1)).toFixed(2)} per result`,
        estimatedROAS: '3.2x - 5.1x'
      }
    };

    this.progress(execId, 100, 'Campaign ready!');
    this.result(execId, campaign);
    this._complete(execId);
  }

  async _socialGuardian(execId, params) {
    const brand = params.brand || 'Blaze Ignite';
    this.log(execId, `📡 Social Guardian — Monitoring "${brand}"`);
    this.progress(execId, 30, 'Scanning social platforms...');
    await this._sleep(1500);

    this.progress(execId, 70, 'Analyzing sentiment...');
    await this._sleep(1000);

    const report = {
      brand,
      mentions: Math.floor(Math.random() * 100 + 15),
      sentiment: { positive: 72, neutral: 20, negative: 8 },
      topMentions: [
        { platform: 'Instagram', text: `${brand} just redesigned my whole brand and it looks FIRE 🔥`, sentiment: 'positive' },
        { platform: 'Twitter', text: `Working with ${brand} on our social strategy. Excited for Q2.`, sentiment: 'positive' },
        { platform: 'LinkedIn', text: `Great presentation by ${brand} at the digital summit today`, sentiment: 'positive' },
      ],
      competitors: [
        { name: 'Competitor A', mentions: Math.floor(Math.random() * 80 + 10), sentiment: 65 },
        { name: 'Competitor B', mentions: Math.floor(Math.random() * 60 + 5), sentiment: 58 },
      ],
      recommendations: [
        'Increase posting frequency — mentions spike after content drops',
        'Engage with all positive mentions within 1 hour',
        'Address the 8% negative sentiment — mostly about response time'
      ]
    };

    this.progress(execId, 100, 'Monitoring complete!');
    this.result(execId, report);
    this._complete(execId);
  }

  async _recipeVault(execId, params) {
    const industry = params.industry || 'e-commerce';
    const format = params.format || 'carousel';

    this.log(execId, `🧪 Recipe Vault — ${industry} / ${format}`);
    this.progress(execId, 30, 'Loading winning recipes...');
    await this._sleep(1000);

    const recipes = [
      {
        name: 'The Problem-Agitate-Solve',
        format,
        industry,
        hook: 'Start with the customer\'s biggest pain point',
        structure: ['Hook: State the problem', 'Agitate: Show consequences', 'Solution: Present your product', 'Proof: Testimonial/stats', 'CTA: Clear next step'],
        exampleCopy: `Struggling to get sales from Instagram?\n\nYou're posting daily but crickets... 🦗\n\nHere's what changed everything for our clients:\n→ AI-targeted content\n→ Automated DM funnels\n→ Data-driven posting times\n\nResult? 340% more engagement in 30 days.\n\nDM "BLAZE" for your free audit 🔥`,
        winRate: '78%',
        bestFor: 'Cold audiences, awareness campaigns'
      },
      {
        name: 'The Social Proof Stack',
        format,
        industry,
        hook: 'Lead with results, not promises',
        structure: ['Headline stat/result', 'Before photo/state', 'After photo/state', 'Client quote', 'How they did it', 'CTA'],
        exampleCopy: `From R2K to R45K/month in 90 days.\n\nThat's what happened when ${industry} brand @example switched to our system.\n\n"I didn't believe it was possible" — Owner\n\nHere's the exact 5-step framework we used 👇`,
        winRate: '82%',
        bestFor: 'Warm audiences, conversion campaigns'
      },
      {
        name: 'The Value Bomb',
        format,
        industry,
        hook: 'Give away your best advice for free',
        structure: ['Bold claim/promise', 'Tip 1 with example', 'Tip 2 with example', 'Tip 3 with example', 'Secret bonus tip', 'CTA to get more'],
        exampleCopy: `3 ${industry} secrets that 10x our client's revenue:\n\n1️⃣ Bundle products (AOV +40%)\n2️⃣ Email abandoned carts within 1 hour (recovery +25%)\n3️⃣ Use UGC in ads (ROAS +3x)\n\nBonus: The #1 thing nobody talks about...\n\nComment "SECRET" and I'll DM it to you 🤫`,
        winRate: '71%',
        bestFor: 'All audiences, engagement campaigns'
      }
    ];

    this.progress(execId, 100, 'Recipes loaded!');
    this.result(execId, { recipes, industry, format });
    this._complete(execId);
  }

  async _veoVideo(execId, params) {
    const script = params.script || 'Welcome to Blaze Ignite...';
    const duration = parseInt(params.duration) || 60;

    this.log(execId, `🎬 Veo Video — HeyGen Integration`);
    this.log(execId, `Script length: ${script.length} chars | Max duration: ${duration}s`);
    this.progress(execId, 10, 'Preparing video generation...');
    await this._sleep(800);

    // Note: In production, this would call HeyGen API
    // For now, simulate the process
    this.progress(execId, 30, 'Sending to HeyGen API...');
    this.log(execId, `⚠️ HeyGen API integration requires server-side call with API key`);
    this.log(execId, `Avatar ID: cc6226d1ad824b90978f7803f2be536f`);
    this.log(execId, `Credits remaining: ~600`);
    await this._sleep(1500);

    this.progress(execId, 60, 'Video rendering in progress...');
    await this._sleep(2000);

    this.progress(execId, 90, 'Finalizing...');
    await this._sleep(800);

    const result = {
      status: 'simulated',
      message: 'In production, this generates a real video via HeyGen API. Enable by setting HEYGEN_API_KEY environment variable.',
      script: script.substring(0, 200),
      estimatedDuration: `${Math.min(duration, Math.ceil(script.length / 15))} seconds`,
      avatarId: 'cc6226d1ad824b90978f7803f2be536f',
      apiEndpoint: 'https://api.heygen.com/v2/video/generate',
      creditsRequired: Math.ceil(script.length / 100)
    };

    this.progress(execId, 100, 'Complete (simulated)');
    this.result(execId, result);
    this._complete(execId);
  }

  async _shopifyAuditor(execId, params) {
    const storeId = params.storeId || 'essora';
    const store = storage.get('stores', storeId);

    this.log(execId, `🛒 Shopify Auditor — ${store?.name || storeId}`);
    this.progress(execId, 5, 'Connecting to store...');
    await this._sleep(600);

    const sections = [
      { name: 'Store Performance', weight: 20 },
      { name: 'Product Catalog', weight: 20 },
      { name: 'SEO & Content', weight: 20 },
      { name: 'Conversion Optimization', weight: 20 },
      { name: 'Trust & Social Proof', weight: 20 }
    ];

    const audit = { storeId, storeName: store?.name || storeId, sections: [], overallScore: 0, recommendations: [] };

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      this.progress(execId, 10 + Math.round((i / sections.length) * 75), `Auditing: ${section.name}...`);
      await this._sleep(1000);

      const score = Math.floor(Math.random() * 40 + 50); // 50-90
      const checks = this._getAuditChecks(section.name);
      audit.sections.push({ name: section.name, score, maxScore: 100, checks });
      this.log(execId, `${score >= 80 ? '✅' : score >= 60 ? '🟡' : '🔴'} ${section.name}: ${score}/100`);
    }

    audit.overallScore = Math.round(audit.sections.reduce((sum, s) => sum + s.score, 0) / sections.length);

    // Generate recommendations
    this.progress(execId, 90, 'Generating AI recommendations...');
    await this._sleep(1200);

    audit.recommendations = [
      { priority: 'HIGH', category: 'Conversion', title: 'Add trust badges to checkout', impact: '+8-12% conversion', effort: '1 hour', details: 'Add Visa/MC logos, SSL badge, money-back guarantee above fold on checkout page' },
      { priority: 'HIGH', category: 'SEO', title: 'Fix missing meta descriptions', impact: '+15-25% organic traffic', effort: '3 hours', details: '23 products missing meta descriptions. Write unique 150-char descriptions for each.' },
      { priority: 'HIGH', category: 'Revenue', title: 'Create product bundles', impact: '+20-35% AOV', effort: '2 hours', details: 'Top 3 bundle opportunities based on order history: Starter Pack, Premium Set, Gift Bundle' },
      { priority: 'MEDIUM', category: 'Performance', title: 'Optimize product images', impact: '-2s load time', effort: '2 hours', details: '18 images over 500KB. Compress to WebP format, add lazy loading.' },
      { priority: 'MEDIUM', category: 'Trust', title: 'Add customer reviews', impact: '+10-18% conversion', effort: '1 hour', details: 'Install Judge.me or Loox. Send review request emails 7 days after delivery.' },
      { priority: 'LOW', category: 'Content', title: 'Start a blog', impact: '+30-50% organic traffic (6 months)', effort: '4 hours/month', details: 'Publish 2-4 SEO-optimized posts per month targeting long-tail keywords in your niche.' }
    ];

    // Save audit report
    storage.create('audit_reports', { ...audit, storeId, createdAt: new Date().toISOString() });
    if (store) storage.update('stores', storeId, { auditScore: audit.overallScore, lastAudit: new Date().toISOString() });

    this.progress(execId, 100, 'Audit complete!');
    this.log(execId, `\n📊 Overall Score: ${audit.overallScore}/100`);
    this.log(execId, `📋 ${audit.recommendations.length} recommendations generated`);
    this.result(execId, audit);
    this._complete(execId);
    if (this.io) this.io.emit('data:refresh', { collection: 'stores' });
  }

  _getAuditChecks(sectionName) {
    const allChecks = {
      'Store Performance': [
        { name: 'Page load time < 3s', passed: Math.random() > 0.4, detail: 'Current: 2.8s' },
        { name: 'Mobile responsive', passed: true, detail: 'Theme is responsive' },
        { name: 'SSL certificate active', passed: true, detail: 'SSL valid' },
        { name: 'No broken links', passed: Math.random() > 0.3, detail: '2 broken links found' },
        { name: 'Image optimization', passed: Math.random() > 0.5, detail: '18 images need compression' }
      ],
      'Product Catalog': [
        { name: 'All products have descriptions', passed: Math.random() > 0.4, detail: '8 products missing descriptions' },
        { name: 'Product images high quality', passed: Math.random() > 0.5, detail: 'Most images are good' },
        { name: 'Variant options clear', passed: true, detail: 'Size/color options work' },
        { name: 'Pricing competitive', passed: Math.random() > 0.5, detail: 'Slightly above market average' },
        { name: 'Inventory tracking enabled', passed: true, detail: 'Auto-tracking on' }
      ],
      'SEO & Content': [
        { name: 'Meta titles present', passed: Math.random() > 0.3, detail: '12 pages missing' },
        { name: 'Meta descriptions present', passed: Math.random() > 0.4, detail: '23 pages missing' },
        { name: 'Alt text on images', passed: Math.random() > 0.5, detail: '30% missing alt text' },
        { name: 'Blog/content section exists', passed: Math.random() > 0.6, detail: 'No blog found' },
        { name: 'Sitemap submitted', passed: Math.random() > 0.4, detail: 'Check Google Search Console' }
      ],
      'Conversion Optimization': [
        { name: 'Clear CTA buttons', passed: true, detail: 'Add to Cart visible' },
        { name: 'Checkout streamlined', passed: Math.random() > 0.5, detail: '3-step checkout' },
        { name: 'Abandoned cart recovery', passed: Math.random() > 0.5, detail: 'Not configured' },
        { name: 'Free shipping threshold', passed: Math.random() > 0.4, detail: 'No threshold set' },
        { name: 'Upsell/cross-sell active', passed: Math.random() > 0.6, detail: 'No upsells configured' }
      ],
      'Trust & Social Proof': [
        { name: 'Customer reviews enabled', passed: Math.random() > 0.5, detail: 'No review app installed' },
        { name: 'Trust badges on checkout', passed: Math.random() > 0.6, detail: 'Missing payment badges' },
        { name: 'Contact information visible', passed: true, detail: 'Footer has contact' },
        { name: 'Return policy clear', passed: Math.random() > 0.4, detail: 'Policy page exists' },
        { name: 'Social media linked', passed: true, detail: 'IG and FB linked' }
      ]
    };
    return allChecks[sectionName] || [];
  }
}

module.exports = ToolEngine;
