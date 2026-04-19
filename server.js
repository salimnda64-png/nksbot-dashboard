require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

const VIEWS = path.join(__dirname, 'views');
const PUBLIC = path.join(__dirname, 'public');

// ================================================================
//  SÉCURITÉ
// ================================================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// ================================================================
//  RATE LIMITING
// ================================================================
const rateLimitStore = new Map();
function rateLimit({ windowMs, max, message }) {
  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const key = `${req.path}:${ip}`;
    const now = Date.now();
    const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
    if (now > record.resetAt) { record.count = 0; record.resetAt = now + windowMs; }
    record.count++;
    rateLimitStore.set(key, record);
    if (record.count > max) return res.status(429).json({ error: message || 'Trop de requêtes.' });
    next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of rateLimitStore.entries()) if (now > v.resetAt) rateLimitStore.delete(k); }, 10 * 60 * 1000);

const apiLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 150, message: 'Trop de requêtes API.' });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,  message: 'Trop de tentatives.' });
const saveLimiter = rateLimit({ windowMs: 60 * 1000,      max: 20,  message: 'Trop de sauvegardes.' });

// ================================================================
//  MONGODB
// ================================================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Dashboard MongoDB OK'))
  .catch(err => console.error('❌ MongoDB:', err.message));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.static(PUBLIC));

app.use(session({
  secret: process.env.SESSION_SECRET || 'nksbot_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'none',
    secure: true,
  },
}));

// ================================================================
//  MIDDLEWARES AUTH
// ================================================================
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}
function requireOwner(req, res, next) {
  if (req.session.user?.id === process.env.OWNER_DISCORD_ID) return next();
  res.status(403).json({ error: 'Non autorisé' });
}
async function requireAdmin(req, res, next) {
  const guild = req.session.user?.guilds?.find(g => g.id === req.params.guildId);
  if (guild && ((guild.permissions & 0x8) === 0x8 || guild.owner)) return next();
  res.redirect('/dashboard');
}

const CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/callback`;

// ================================================================
//  SCHÉMAS MONGOOSE
// ================================================================
const GuildSchema = new mongoose.Schema({}, { strict: false });
const PaymentLogSchema = new mongoose.Schema({
  guildId: String, guildName: String, userId: String, username: String,
  method: String, amount: Number, note: String, expiresAt: Date,
  createdAt: { type: Date, default: Date.now },
});
const CollabSchema = new mongoose.Schema({
  name: String, platform: String,
  emoji: String, avatar: String,
  credit: String, order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});
function getGuild()      { return mongoose.models.Guild      || mongoose.model('Guild',      GuildSchema); }
function getPaymentLog() { return mongoose.models.PaymentLog || mongoose.model('PaymentLog', PaymentLogSchema); }
function getCollab()     { return mongoose.models.Collab     || mongoose.model('Collab',     CollabSchema); }

// ================================================================
//  AUTH DISCORD
// ================================================================
app.get('/auth/discord', authLimiter, (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString());
});

app.get('/auth/callback', authLimiter, async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');

  try {
    const tokenRes = await axios.post(
      'https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK_URL,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 8000,
      }
    );

    const { access_token } = tokenRes.data;

    const [userRes, guildsRes] = await Promise.all([
      axios.get('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 5000,
      }),
      axios.get('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${access_token}` },
        timeout: 5000,
      }),
    ]);

    req.session.user = {
      id: userRes.data.id,
      username: userRes.data.username,
      avatar: userRes.data.avatar,
      guilds: guildsRes.data,
    };

    await new Promise((resolve, reject) =>
      req.session.save(err => err ? reject(err) : resolve())
    );

    if (userRes.data.id === process.env.OWNER_DISCORD_ID) return res.redirect('/admin');
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth2:', err.response?.data || err.message);
    res.redirect('/login?error=oauth');
  }
});

app.get('/auth/logout', (req, res) => { req.session.destroy(() => res.redirect('/login')); });

// ================================================================
//  PAGES HTML
// ================================================================
app.get('/',                   (req, res) => res.redirect('/login'));
app.get('/login',              (req, res) => res.sendFile(path.join(VIEWS, 'login.html')));
app.get('/dashboard',          requireAuth, (req, res) => res.sendFile(path.join(VIEWS, 'dashboard.html')));
app.get('/dashboard/:guildId', requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(VIEWS, 'guild.html')));
app.get('/admin',              requireAuth, (req, res) => {
  if (req.session.user?.id !== process.env.OWNER_DISCORD_ID) return res.redirect('/dashboard');
  res.sendFile(path.join(VIEWS, 'admin.html'));
});

// ================================================================
//  API — Utilisateur
// ================================================================
app.get('/api/me', requireAuth, apiLimiter, (req, res) => {
  const u = req.session.user;
  res.json({ id: u.id, username: u.username, avatar: u.avatar, guilds: u.guilds, isOwner: u.id === process.env.OWNER_DISCORD_ID });
});

// Cache bot guilds 5 minutes
let botGuildCache = { ids: new Set(), expiresAt: 0 };

app.get('/api/guilds', requireAuth, apiLimiter, async (req, res) => {
  try {
    const Guild = getGuild();
    const adminGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x8) === 0x8 || g.owner);
    const dbGuilds = await Guild.find({ guildId: { $in: adminGuilds.map(g => g.id) } });
    let botGuildIds = new Set(dbGuilds.map(db => db.guildId));

    const now = Date.now();
    if (now > botGuildCache.expiresAt) {
      try {
        const botGuilds = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
          headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN },
          timeout: 5000,
        });
        botGuildCache.ids = new Set(botGuilds.data.map(g => g.id));
        botGuildCache.expiresAt = now + 5 * 60 * 1000;
      } catch {}
    }
    botGuildCache.ids.forEach(id => botGuildIds.add(id));

    res.json(adminGuilds.map(g => ({
      ...g,
      botPresent: botGuildIds.has(g.id),
      premium: dbGuilds.find(db => db.guildId === g.id)?.premium || false,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/guild/:guildId', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const Guild = getGuild();
    let guild = await Guild.findOne({ guildId: req.params.guildId });
    if (!guild) guild = { guildId: req.params.guildId };
    res.json(guild);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/guild/:guildId', requireAuth, requireAdmin, saveLimiter, async (req, res) => {
  try {
    const Guild = getGuild();
    const guild = await Guild.findOne({ guildId: req.params.guildId });
    const isPremium = guild?.premium && guild?.premiumExpires > new Date();
    const body = { ...req.body, updatedAt: new Date() };
    if (!isPremium) {
      delete body.aiMemory;
      delete body.tempVoice;
      delete body.botStatus;
      if (body.tickets) body.tickets.maxOpen = Math.min(body.tickets.maxOpen || 5, 5);
    }
    await Guild.findOneAndUpdate({ guildId: req.params.guildId }, body, { upsert: true });
    res.json({ success: true, isPremium });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/guild/:guildId/channels', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const r = await axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, {
      headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN },
      timeout: 5000,
    });
    res.json(r.data.filter(c => c.type === 0 || c.type === 2 || c.type === 4).map(c => ({ id: c.id, name: c.name, type: c.type })));
  } catch { res.status(500).json({ error: 'Erreur channels' }); }
});

app.get('/api/guild/:guildId/roles', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const r = await axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/roles`, {
      headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN },
      timeout: 5000,
    });
    res.json(r.data.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name })));
  } catch { res.status(500).json({ error: 'Erreur roles' }); }
});

app.post('/api/guild/:guildId/send-message', requireAuth, requireAdmin, saveLimiter, async (req, res) => {
  try {
    const { channelId, content, embed } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Salon requis' });
    const payload = {};
    if (content) payload.content = content;
    if (embed && (embed.title || embed.description)) {
      payload.embeds = [{
        title: embed.title || undefined,
        description: embed.description || undefined,
        color: embed.color ? parseInt(embed.color.replace('#', ''), 16) : 0x7c3aed,
        image: embed.imageUrl ? { url: embed.imageUrl } : undefined,
        footer: embed.footer ? { text: embed.footer } : undefined,
        thumbnail: embed.thumbnailUrl ? { url: embed.thumbnailUrl } : undefined,
      }];
    }
    if (!payload.content && !payload.embeds) return res.status(400).json({ error: 'Contenu requis' });
    await axios.post(`https://discord.com/api/v10/channels/${channelId}/messages`, payload, {
      headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN, 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Erreur envoi message' }); }
});

// ================================================================
//  API — Mémoire IA (Premium)
// ================================================================
app.get('/api/guild/:guildId/ai-memory', requireAuth, requireAdmin, apiLimiter, async (req, res) => {
  try {
    const guild = await getGuild().findOne({ guildId: req.params.guildId });
    const isPremium = guild?.premium && guild?.premiumExpires > new Date();
    if (!isPremium) return res.status(403).json({ error: 'Premium requis' });
    res.json({ memory: guild?.aiMemory || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/guild/:guildId/ai-memory', requireAuth, requireAdmin, saveLimiter, async (req, res) => {
  try {
    const Guild = getGuild();
    const guild = await Guild.findOne({ guildId: req.params.guildId });
    const isPremium = guild?.premium && guild?.premiumExpires > new Date();
    if (!isPremium) return res.status(403).json({ error: 'Premium requis' });
    const { action, fact, index } = req.body;
    if (action === 'add') {
      if (!fact || fact.length > 300) return res.status(400).json({ error: 'Fait invalide (max 300 caractères)' });
      if ((guild.aiMemory || []).length >= 20) return res.status(400).json({ error: 'Limite de 20 faits atteinte' });
      await Guild.updateOne({ guildId: req.params.guildId }, { $push: { aiMemory: fact.trim() } });
    } else if (action === 'remove') {
      const idx = parseInt(index);
      if (isNaN(idx) || idx < 0) return res.status(400).json({ error: 'Index invalide' });
      guild.aiMemory.splice(idx, 1);
      await Guild.updateOne({ guildId: req.params.guildId }, { $set: { aiMemory: guild.aiMemory } });
    } else if (action === 'reset') {
      await Guild.updateOne({ guildId: req.params.guildId }, { $set: { aiMemory: [] } });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
//  API — Admin
// ================================================================
app.get('/api/admin/stats', requireAuth, requireOwner, async (req, res) => {
  try {
    const allGuilds = await getGuild().find({});
    const premiumGuilds = allGuilds.filter(g => g.premium && g.premiumExpires > new Date());
    const logs = await getPaymentLog().find({}).sort({ createdAt: -1 }).limit(10);
    const rev = await getPaymentLog().aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ totalGuilds: allGuilds.length, premiumGuilds: premiumGuilds.length, totalRevenue: rev[0]?.total || 0, recentActivations: logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/premium', requireAuth, requireOwner, async (req, res) => {
  try {
    const guilds = await getGuild().find({ premium: true }).sort({ premiumExpires: 1 });
    const logs = await getPaymentLog().find({}).sort({ createdAt: -1 });
    res.json({ guilds, logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/premium/activate', requireAuth, requireOwner, async (req, res) => {
  try {
    const { guildId, guildName, userId, username, days, method, amount, note } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Guild ID requis' });
    const expires = new Date(Date.now() + (days || 30) * 24 * 60 * 60 * 1000);
    await getGuild().findOneAndUpdate({ guildId }, { premium: true, premiumExpires: expires, guildName: guildName || undefined, premiumNote: note || undefined }, { upsert: true });
    await getPaymentLog().create({ guildId, guildName, userId, username, method, amount, note, expiresAt: expires });
    res.json({ success: true, expiresAt: expires });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/premium/revoke', requireAuth, requireOwner, async (req, res) => {
  try {
    await getGuild().findOneAndUpdate({ guildId: req.body.guildId }, { premium: false, premiumExpires: null });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/guilds', requireAuth, requireOwner, async (req, res) => {
  try { res.json(await getGuild().find({}).sort({ updatedAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/search-user', requireAuth, requireOwner, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json({ logs: [] });
    const logs = await getPaymentLog().find({ $or: [{ guildId: q }, { userId: q }, { username: { $regex: q, $options: 'i' } }, { guildName: { $regex: q, $options: 'i' } }] }).sort({ createdAt: -1 });
    res.json({ logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
//  API — Stats & Collabs
// ================================================================
app.get('/api/stats', async (req, res) => {
  try {
    const total = await getGuild().countDocuments();
    res.json({ servers: total });
  } catch { res.json({ servers: 0 }); }
});

app.get('/api/collabs', async (req, res) => {
  try {
    const collabs = await getCollab().find({}).sort({ order: 1, createdAt: -1 });
    res.json(collabs);
  } catch { res.json([]); }
});

app.post('/api/admin/collabs', requireAuth, requireOwner, async (req, res) => {
  try {
    const { name, platform, emoji, avatar, credit } = req.body;
    if (!name || !platform) return res.status(400).json({ error: 'Nom et plateforme requis' });
    const c = new (getCollab())({ name, platform, emoji: emoji || '👤', avatar: avatar || '', credit: credit || '' });
    await c.save();
    res.json({ success: true, collab: c });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/collabs/:id', requireAuth, requireOwner, async (req, res) => {
  try {
    await getCollab().findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ================================================================
//  ERREURS
// ================================================================
app.use((req, res) => res.status(404).json({ error: 'Route introuvable' }));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'Erreur interne' }); });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Dashboard sur http://0.0.0.0:${PORT}`);
  console.log(`👑 Owner ID: ${process.env.OWNER_DISCORD_ID}`);
});
