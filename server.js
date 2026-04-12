require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Dashboard MongoDB OK'))
  .catch(err => console.error('❌ MongoDB erreur:', err.message));

// Modèles
const GuildSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  guildName: String,
  premium: { type: Boolean, default: false },
  premiumExpires: Date,
  autoroles: [String],
  logs: { membres: String, messages: String, moderation: String, vocal: String, commandes: String, raid: String },
  welcome: { enabled: { type: Boolean, default: false }, channelId: String, title: { type: String, default: 'Bienvenue !' }, message: { type: String, default: 'Bienvenue {user} !' }, color: { type: String, default: '#7c3aed' }, dmEnabled: Boolean, dmMessage: String },
  tickets: { categoryId: String, staffRoleId: String, logChannelId: String, mode: { type: String, default: 'channel' } },
  antiRaid: { enabled: { type: Boolean, default: true }, joinThreshold: { type: Number, default: 5 }, joinTimeWindow: { type: Number, default: 10 }, action: { type: String, default: 'kick' } },
  autoMod: { enabled: Boolean, filterLinks: Boolean, filterInvites: { type: Boolean, default: true }, filterCaps: Boolean, bannedWords: [String], warnThreshold: { type: Number, default: 3 } },
  xp: { enabled: { type: Boolean, default: true }, announceChannel: String, multiplier: { type: Number, default: 1 } },
  economy: { enabled: Boolean, currencyName: { type: String, default: 'pièces' }, currencyEmoji: { type: String, default: '🪙' } },
  updatedAt: { type: Date, default: Date.now },
});
const Guild = mongoose.models.Guild || mongoose.model('Guild', GuildSchema);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'nksbot_secret_2026',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

// ── Auth middleware ───────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function requireAdmin(req, res, next) {
  const guildId = req.params.guildId;
  const guild = req.session.user?.guilds?.find(g => g.id === guildId);
  if (!guild || !((guild.permissions & 0x8) === 0x8 || guild.owner)) return res.redirect('/dashboard');
  next();
}

// ── OAuth2 Discord Manuel ────────────────────────────────────
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/callback`;

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: DISCORD_CALLBACK_URL,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString());
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');

  try {
    // Échanger le code contre un token
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: DISCORD_CALLBACK_URL,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data;

    // Récupérer le profil
    const [userRes, guildsRes] = await Promise.all([
      axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } }),
      axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${access_token}` } }),
    ]);

    req.session.user = {
      id: userRes.data.id,
      username: userRes.data.username,
      avatar: userRes.data.avatar,
      guilds: guildsRes.data,
      accessToken: access_token,
    };

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth2 erreur:', err.response?.data || err.message);
    res.redirect('/login?error=oauth');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ── Pages ─────────────────────────────────────────────────────
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));
app.get('/dashboard/:guildId', requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views/guild.html')));

// ── API ───────────────────────────────────────────────────────
app.get('/api/me', requireAuth, (req, res) => {
  const u = req.session.user;
  res.json({ id: u.id, username: u.username, avatar: u.avatar, guilds: u.guilds });
});

app.get('/api/guilds', requireAuth, async (req, res) => {
  try {
    const adminGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x8) === 0x8 || g.owner);
    const dbGuilds = await Guild.find({ guildId: { $in: adminGuilds.map(g => g.id) } });
    const result = adminGuilds.map(g => ({
      ...g,
      botPresent: dbGuilds.some(db => db.guildId === g.id),
      premium: dbGuilds.find(db => db.guildId === g.id)?.premium || false,
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/guild/:guildId', requireAuth, requireAdmin, async (req, res) => {
  try {
    let guild = await Guild.findOne({ guildId: req.params.guildId });
    if (!guild) guild = new Guild({ guildId: req.params.guildId });
    res.json(guild);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/guild/:guildId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    let guild = await Guild.findOne({ guildId });
    if (!guild) guild = new Guild({ guildId });
    const fields = ['logs', 'welcome', 'tickets', 'antiRaid', 'autoMod', 'xp', 'economy', 'autoroles'];
    for (const key of fields) {
      if (req.body[key] !== undefined) {
        guild[key] = Array.isArray(req.body[key]) ? req.body[key] : { ...(guild[key]?.toObject?.() || {}), ...req.body[key] };
        guild.markModified(key);
      }
    }
    guild.updatedAt = new Date();
    await guild.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/guild/:guildId/channels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, {
      headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN }
    });
    res.json(r.data.filter(c => c.type === 0 || c.type === 4).map(c => ({ id: c.id, name: c.name, type: c.type })));
  } catch { res.status(500).json({ error: 'Impossible de récupérer les salons' }); }
});

app.get('/api/guild/:guildId/roles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/roles`, {
      headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN }
    });
    res.json(r.data.map(r => ({ id: r.id, name: r.name })));
  } catch { res.status(500).json({ error: 'Impossible de récupérer les rôles' }); }
});

app.post('/api/premium/activate', requireAuth, async (req, res) => {
  if (req.session.user.id !== process.env.OWNER_DISCORD_ID) return res.status(403).json({ error: 'Non autorisé' });
  try {
    const { guildId, days } = req.body;
    const expires = new Date(Date.now() + (days || 30) * 24 * 60 * 60 * 1000);
    await Guild.findOneAndUpdate({ guildId }, { premium: true, premiumExpires: expires }, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`🌐 Dashboard sur http://localhost:${PORT}`));
