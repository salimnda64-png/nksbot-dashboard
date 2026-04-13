require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Dashboard MongoDB OK'))
  .catch(err => console.error('❌ MongoDB:', err.message));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Sert les fichiers statiques depuis la racine (style.css, etc.)
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'nksbot_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

async function requireAdmin(req, res, next) {
  const guild = req.session.user?.guilds?.find(g => g.id === req.params.guildId);
  if (guild && ((guild.permissions & 0x8) === 0x8 || guild.owner)) return next();
  res.redirect('/dashboard');
}

const CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/callback`;

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    response_type: 'code',
    scope: 'identify guilds',
  });
  res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString());
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');
  try {
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: CALLBACK_URL,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const { access_token } = tokenRes.data;
    const [userRes, guildsRes] = await Promise.all([
      axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } }),
      axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${access_token}` } }),
    ]);
    req.session.user = {
      id: userRes.data.id,
      username: userRes.data.username,
      avatar: userRes.data.avatar,
      guilds: guildsRes.data,
    };
    if (userRes.data.id === process.env.OWNER_DISCORD_ID) return res.redirect('/admin');
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth2:', err.response?.data || err.message);
    res.redirect('/login?error=oauth');
  }
});

app.get('/auth/logout', (req, res) => { req.session.destroy(() => res.redirect('/login')); });

app.get('/', (req, res) => res.redirect('/login'));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/dashboard/:guildId', requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'guild.html')));
app.get('/admin', requireAuth, (req, res) => {
  if (req.session.user?.id !== process.env.OWNER_DISCORD_ID) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/api/me', requireAuth, (req, res) => {
  const u = req.session.user;
  res.json({ id: u.id, username: u.username, avatar: u.avatar, guilds: u.guilds, isOwner: u.id === process.env.OWNER_DISCORD_ID });
});

app.get('/api/guilds', requireAuth, async (req, res) => {
  try {
    const Guild = mongoose.models.Guild;
    const adminGuilds = req.session.user.guilds.filter(g => (g.permissions & 0x8) === 0x8 || g.owner);
    const dbGuilds = Guild ? await Guild.find({ guildId: { $in: adminGuilds.map(g => g.id) } }) : [];
    res.json(adminGuilds.map(g => ({
      ...g,
      botPresent: dbGuilds.some(db => db.guildId === g.id),
      premium: dbGuilds.find(db => db.guildId === g.id)?.premium || false,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/guild/:guildId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Guild = mongoose.models.Guild || mongoose.model('Guild', new mongoose.Schema({}, { strict: false }));
    let guild = await Guild.findOne({ guildId: req.params.guildId });
    if (!guild) guild = { guildId: req.params.guildId };
    res.json(guild);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/guild/:guildId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Guild = mongoose.models.Guild || mongoose.model('Guild', new mongoose.Schema({}, { strict: false }));
    await Guild.findOneAndUpdate({ guildId: req.params.guildId }, { ...req.body, updatedAt: new Date() }, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/guild/:guildId/channels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/channels`, { headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN } });
    res.json(r.data.filter(c => c.type === 0 || c.type === 4).map(c => ({ id: c.id, name: c.name, type: c.type })));
  } catch { res.status(500).json({ error: 'Erreur channels' }); }
});

app.get('/api/guild/:guildId/roles', requireAuth, requireAdmin, async (req, res) => {
  try {
    const r = await axios.get(`https://discord.com/api/v10/guilds/${req.params.guildId}/roles`, { headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN } });
    res.json(r.data.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name })));
  } catch { res.status(500).json({ error: 'Erreur roles' }); }
});

// ── Admin — Premium ───────────────────────────────────────────────
app.post('/api/admin/premium/activate', requireAuth, async (req, res) => {
  if (req.session.user?.id !== process.env.OWNER_DISCORD_ID) return res.status(403).json({ error: 'Non autorisé' });
  try {
    const Guild = mongoose.models.Guild || mongoose.model('Guild', new mongoose.Schema({}, { strict: false }));
    const { guildId, days } = req.body;
    const expires = new Date(Date.now() + (days || 30) * 24 * 60 * 60 * 1000);
    await Guild.findOneAndUpdate({ guildId }, { premium: true, premiumExpires: expires }, { upsert: true });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/premium/revoke', requireAuth, async (req, res) => {
  if (req.session.user?.id !== process.env.OWNER_DISCORD_ID) return res.status(403).json({ error: 'Non autorisé' });
  try {
    const Guild = mongoose.models.Guild || mongoose.model('Guild', new mongoose.Schema({}, { strict: false }));
    // ✅ Fix : { guildId: req.body.guildId } au lieu de { req.body.guildId }
    await Guild.findOneAndUpdate({ guildId: req.body.guildId }, { premium: false, premiumExpires: null });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Mémoire IA (Premium) ──────────────────────────────────────────
app.get('/api/guild/:guildId/ai-memory', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Guild = mongoose.models.Guild || mongoose.model('Guild', new mongoose.Schema({}, { strict: false }));
    const guild = await Guild.findOne({ guildId: req.params.guildId }).select('aiMemory premium premiumExpires');
    const isPremium = guild?.premium && guild?.premiumExpires > new Date();
    if (!isPremium) return res.status(403).json({ error: 'Premium requis' });
    res.json({ memory: guild?.aiMemory || [] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/guild/:guildId/ai-memory', requireAuth, requireAdmin, async (req, res) => {
  try {
    const Guild = mongoose.models.Guild || mongoose.model('Guild', new mongoose.Schema({}, { strict: false }));
    const guild = await Guild.findOne({ guildId: req.params.guildId }).select('premium premiumExpires aiMemory');
    const isPremium = guild?.premium && guild?.premiumExpires > new Date();
    if (!isPremium) return res.status(403).json({ error: 'Premium requis' });
    const { action, fact, index } = req.body;
    if (action === 'add') {
      if (!fact || typeof fact !== 'string') return res.status(400).json({ error: 'Fait invalide' });
      if ((guild.aiMemory || []).length >= 20) return res.status(400).json({ error: 'Limite de 20 faits atteinte' });
      await Guild.updateOne({ guildId: req.params.guildId }, { $push: { aiMemory: fact.trim() } });
    } else if (action === 'remove') {
      const idx = parseInt(index);
      if (isNaN(idx) || idx < 0 || idx >= (guild.aiMemory || []).length) return res.status(400).json({ error: 'Index invalide' });
      guild.aiMemory.splice(idx, 1);
      await Guild.updateOne({ guildId: req.params.guildId }, { $set: { aiMemory: guild.aiMemory } });
    } else if (action === 'reset') {
      await Guild.updateOne({ guildId: req.params.guildId }, { $set: { aiMemory: [] } });
    } else {
      return res.status(400).json({ error: 'Action invalide' });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
  console.log(`🌐 Dashboard sur http://localhost:${PORT}`);
  console.log(`👑 Owner: ${process.env.OWNER_DISCORD_ID}`);
});
