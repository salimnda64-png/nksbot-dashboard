require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3000;

// ══════════════════════════════════════════════════════════════
//  MONGODB CONNECTION
// ══════════════════════════════════════════════════════════════
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Dashboard MongoDB OK'))
  .catch(err => console.error('❌ MongoDB erreur:', err.message));

// ══════════════════════════════════════════════════════════════
//  SCHEMAS
// ══════════════════════════════════════════════════════════════
const GuildSchema = new mongoose.Schema({
  guildId:        { type: String, required: true, unique: true },
  guildName:      String,
  premium:        { type: Boolean, default: false },
  premiumExpires: Date,
  premiumNote:    String,   // note admin (ex: "payé PayPal 2026-04-12")

  // Prefix
  prefix: { type: String, default: '!', enum: ['!', '/'] },

  // Panel access — rôles autorisés à accéder au dashboard (en plus des admins)
  panelRoles: [String],

  // Auto-roles
  autoroles: [String],

  // Logs
  logs: {
    membres:    String,
    messages:   String,
    moderation: String,
    vocal:      String,
    commandes:  String,
    raid:       String,
  },

  // Welcome / goodbye
  welcome: {
    enabled:        { type: Boolean, default: false },
    channelId:      String,
    title:          { type: String, default: 'Bienvenue !' },
    message:        { type: String, default: 'Bienvenue {user} sur {server} !' },
    color:          { type: String, default: '#7c3aed' },
    imageUrl:       String,
    dmEnabled:      Boolean,
    dmMessage:      String,
    goodbyeEnabled: { type: Boolean, default: false },
    goodbyeChannelId: String,
    goodbyeMessage: { type: String, default: 'Au revoir {user} !' },
  },

  // Tickets avancés
  tickets: {
    categoryId:      String,
    staffRoleId:     String,
    logChannelId:    String,
    mode:            { type: String, default: 'channel' },
    maxOpen:         { type: Number, default: 5 },    // 5 gratuit, illimité premium
    priorityEnabled: { type: Boolean, default: false },
    transcriptsEnabled: { type: Boolean, default: false },
    categories: [{           // catégories de tickets (ex: Support, Bug, Premium)
      id:       String,
      label:    String,
      emoji:    String,
      roleId:   String,
    }],
    closeMessage:    { type: String, default: 'Ticket fermé. Merci !' },
  },

  // Anti-raid & Auto-mod
  antiRaid: {
    enabled:       { type: Boolean, default: true },
    joinThreshold: { type: Number, default: 5 },
    joinTimeWindow:{ type: Number, default: 10 },
    action:        { type: String, default: 'kick' },
  },
  autoMod: {
    enabled:        Boolean,
    filterLinks:    Boolean,
    filterInvites:  { type: Boolean, default: true },
    filterCaps:     Boolean,
    bannedWords:    [String],
    warnThreshold:  { type: Number, default: 3 },
  },

  // XP
  xp: {
    enabled:         { type: Boolean, default: true },
    announceChannel: String,
    multiplier:      { type: Number, default: 1 },
    levelRoles: [{
      level:  Number,
      roleId: String,
    }],
  },

  // Economy
  economy: {
    enabled:        Boolean,
    currencyName:   { type: String, default: 'pièces' },
    currencyEmoji:  { type: String, default: '🪙' },
  },

  // ── NOTIFICATIONS SOCIALES ──────────────────────────────────
  socialNotifs: {
    // YouTube
    youtube: {
      enabled:     { type: Boolean, default: false },
      channelId:   String,         // ID ou nom de chaîne YouTube
      discordChannelId: String,    // salon Discord où envoyer
      message:     { type: String, default: '🎬 Nouvelle vidéo de {channel} !' },
      pingRole:    String,
      notifyVideo: { type: Boolean, default: true },
      notifyLive:  { type: Boolean, default: true },
      notifyShort: { type: Boolean, default: true },
    },
    // Twitch
    twitch: {
      enabled:   { type: Boolean, default: false },
      username:  String,           // nom d'utilisateur Twitch
      discordChannelId: String,
      message:   { type: String, default: '🔴 {streamer} est en live sur Twitch !' },
      pingRole:  String,
      showGame:  { type: Boolean, default: true },
      showViewers: { type: Boolean, default: true },
    },
    // TikTok
    tiktok: {
      enabled:   { type: Boolean, default: false },
      username:  String,
      discordChannelId: String,
      message:   { type: String, default: '🎵 {user} a posté une nouvelle vidéo TikTok !' },
      pingRole:  String,
      notifyVideo: { type: Boolean, default: true },
      notifyLive:  { type: Boolean, default: false },
    },
    // Instagram
    instagram: {
      enabled:   { type: Boolean, default: false },
      username:  String,
      discordChannelId: String,
      message:   { type: String, default: '📸 {user} a posté sur Instagram !' },
      pingRole:  String,
      notifyPost:  { type: Boolean, default: true },
      notifyReel:  { type: Boolean, default: true },
      notifyStory: { type: Boolean, default: false },
    },
  },

  // ── STATUT DU BOT (Premium uniquement) ─────────────────────
  botStatus: {
    enabled:    { type: Boolean, default: false },
    status:     { type: String, default: 'online', enum: ['online', 'idle', 'dnd', 'invisible'] },
    activityType: { type: String, default: 'PLAYING', enum: ['PLAYING', 'WATCHING', 'LISTENING', 'COMPETING'] },
    activityText: { type: String, default: '' },
  },

  // ── REACTION ROLES / BOUTONS ────────────────────────────────
  reactionRoles: [{
    messageId:   String,
    channelId:   String,
    type:        { type: String, enum: ['reaction', 'button'], default: 'button' },
    roles: [{
      emoji:  String,
      label:  String,
      roleId: String,
      style:  { type: String, default: 'PRIMARY' },
    }],
  }],

  // ── EMBEDS PERSONNALISÉS ────────────────────────────────────
  embeds: [{
    name:        String,
    channelId:   String,
    title:       String,
    description: String,
    color:       String,
    imageUrl:    String,
    thumbnailUrl:String,
    footer:      String,
    fields: [{
      name:   String,
      value:  String,
      inline: Boolean,
    }],
    sentAt: Date,
  }],

  updatedAt: { type: Date, default: Date.now },
});

const Guild = mongoose.models.Guild || mongoose.model('Guild', GuildSchema);

// Schema Premium Log — pour le panel admin owner
const PremiumLogSchema = new mongoose.Schema({
  guildId:      { type: String, required: true },
  guildName:    String,
  userId:       String,    // Discord ID de l'utilisateur qui a payé
  username:     String,
  activatedBy:  String,    // "owner" ou Discord ID du panel admin
  method:       String,    // PayPal, Virement, Paysafecard, Manuel, etc.
  amount:       Number,    // ex: 1.99
  note:         String,
  expiresAt:    Date,
  createdAt:    { type: Date, default: Date.now },
});
const PremiumLog = mongoose.models.PremiumLog || mongoose.model('PremiumLog', PremiumLogSchema);

// ══════════════════════════════════════════════════════════════
//  MIDDLEWARE
// ══════════════════════════════════════════════════════════════
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

// ── Auth middleware ────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Admin d'un serveur (permissions Discord) OU rôle panelRoles configuré
async function requireAdmin(req, res, next) {
  const guildId = req.params.guildId;
  const discordGuild = req.session.user?.guilds?.find(g => g.id === guildId);
  const isDiscordAdmin = discordGuild && ((discordGuild.permissions & 0x8) === 0x8 || discordGuild.owner);

  if (isDiscordAdmin) return next();

  // Vérifier si l'utilisateur a un rôle autorisé dans panelRoles
  try {
    const dbGuild = await Guild.findOne({ guildId });
    if (dbGuild?.panelRoles?.length > 0) {
      // Récupérer les rôles du membre via l'API Discord
      const memberRes = await axios.get(
        `https://discord.com/api/v10/guilds/${guildId}/members/${req.session.user.id}`,
        { headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN } }
      );
      const memberRoles = memberRes.data.roles || [];
      const hasRole = dbGuild.panelRoles.some(r => memberRoles.includes(r));
      if (hasRole) return next();
    }
  } catch {}

  return res.redirect('/dashboard');
}

// Owner uniquement (panel admin)
function requireOwner(req, res, next) {
  if (req.session.user?.id !== process.env.OWNER_DISCORD_ID) {
    return res.status(403).json({ error: 'Accès refusé — Owner uniquement' });
  }
  next();
}

// ══════════════════════════════════════════════════════════════
//  OAUTH2 DISCORD
// ══════════════════════════════════════════════════════════════
const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL  = process.env.DISCORD_CALLBACK_URL || `http://localhost:${PORT}/auth/callback`;

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  DISCORD_CALLBACK_URL,
    response_type: 'code',
    scope:         'identify guilds',
  });
  res.redirect('https://discord.com/api/oauth2/authorize?' + params.toString());
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');

  try {
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token',
      new URLSearchParams({
        client_id:     DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  DISCORD_CALLBACK_URL,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenRes.data;
    const [userRes, guildsRes] = await Promise.all([
      axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } }),
      axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${access_token}` } }),
    ]);

    req.session.user = {
      id:          userRes.data.id,
      username:    userRes.data.username,
      discriminator: userRes.data.discriminator,
      avatar:      userRes.data.avatar,
      guilds:      guildsRes.data,
      accessToken: access_token,
    };

    // Rediriger vers admin panel si owner
    if (userRes.data.id === process.env.OWNER_DISCORD_ID) {
      return res.redirect('/admin');
    }
    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth2 erreur:', err.response?.data || err.message);
    res.redirect('/login?error=oauth');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ══════════════════════════════════════════════════════════════
//  PAGES HTML
// ══════════════════════════════════════════════════════════════
app.get('/login',               (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/dashboard',           requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views/dashboard.html')));
app.get('/dashboard/:guildId',  requireAuth, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views/guild.html')));

// Panel admin owner
app.get('/admin',               requireAuth, (req, res) => {
  if (req.session.user?.id !== process.env.OWNER_DISCORD_ID) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// ══════════════════════════════════════════════════════════════
//  API — UTILISATEUR
// ══════════════════════════════════════════════════════════════
app.get('/api/me', requireAuth, (req, res) => {
  const u = req.session.user;
  res.json({
    id:       u.id,
    username: u.username,
    avatar:   u.avatar,
    guilds:   u.guilds,
    isOwner:  u.id === process.env.OWNER_DISCORD_ID,
  });
});

// ══════════════════════════════════════════════════════════════
//  API — GUILDS
// ══════════════════════════════════════════════════════════════
app.get('/api/guilds', requireAuth, async (req, res) => {
  try {
    const allGuilds   = req.session.user.guilds;
    const adminGuilds = allGuilds.filter(g => (g.permissions & 0x8) === 0x8 || g.owner);
    const dbGuilds    = await Guild.find({ guildId: { $in: allGuilds.map(g => g.id) } });

    // Pour les serveurs sans perms admin, vérifier panelRoles
    const panelGuilds = [];
    for (const g of allGuilds) {
      if (adminGuilds.some(ag => ag.id === g.id)) continue;
      const db = dbGuilds.find(d => d.guildId === g.id);
      if (!db?.panelRoles?.length) continue;
      try {
        const memberRes = await axios.get(
          `https://discord.com/api/v10/guilds/${g.id}/members/${req.session.user.id}`,
          { headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN } }
        );
        const memberRoles = memberRes.data.roles || [];
        if (db.panelRoles.some(r => memberRoles.includes(r))) panelGuilds.push(g);
      } catch {}
    }

    const visibleGuilds = [...adminGuilds, ...panelGuilds];
    const result = visibleGuilds.map(g => ({
      ...g,
      botPresent: dbGuilds.some(db => db.guildId === g.id),
      premium:    dbGuilds.find(db => db.guildId === g.id)?.premium || false,
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET config guild ──────────────────────────────────────────
app.get('/api/guild/:guildId', requireAuth, requireAdmin, async (req, res) => {
  try {
    let guild = await Guild.findOne({ guildId: req.params.guildId });
    if (!guild) guild = new Guild({ guildId: req.params.guildId });
    res.json(guild);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SAVE config guild ─────────────────────────────────────────
app.post('/api/guild/:guildId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    let guild = await Guild.findOne({ guildId });
    if (!guild) guild = new Guild({ guildId });

    const fields = [
      'logs', 'welcome', 'tickets', 'antiRaid', 'autoMod',
      'xp', 'economy', 'autoroles', 'socialNotifs',
      'botStatus', 'reactionRoles', 'embeds', 'panelRoles', 'prefix',
    ];

    for (const key of fields) {
      if (req.body[key] === undefined) continue;
      if (Array.isArray(req.body[key])) {
        guild[key] = req.body[key];
      } else if (typeof req.body[key] === 'object') {
        guild[key] = { ...(guild[key]?.toObject?.() || {}), ...req.body[key] };
      } else {
        guild[key] = req.body[key];
      }
      guild.markModified(key);
    }

    // Vérification : botStatus seulement si premium
    if (req.body.botStatus && !guild.premium) {
      return res.status(403).json({ error: 'Le statut du bot est une fonctionnalité Premium.' });
    }

    guild.updatedAt = new Date();
    await guild.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Channels & Roles Discord ──────────────────────────────────
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
    res.json(r.data.map(r => ({ id: r.id, name: r.name, color: r.color })));
  } catch { res.status(500).json({ error: 'Impossible de récupérer les rôles' }); }
});

// ── Send embed depuis le dashboard ────────────────────────────
app.post('/api/guild/:guildId/send-embed', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { channelId, embed } = req.body;
    if (!channelId || !embed) return res.status(400).json({ error: 'channelId et embed requis' });

    await axios.post(`https://discord.com/api/v10/channels/${channelId}/messages`, { embeds: [embed] }, {
      headers: { Authorization: 'Bot ' + process.env.BOT_TOKEN, 'Content-Type': 'application/json' }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  API — PANEL ADMIN (OWNER ONLY)
// ══════════════════════════════════════════════════════════════

// Liste tous les serveurs premium avec infos
app.get('/api/admin/premium', requireAuth, requireOwner, async (req, res) => {
  try {
    const premiumGuilds = await Guild.find({ premium: true }).select(
      'guildId guildName premium premiumExpires premiumNote updatedAt'
    );
    const logs = await PremiumLog.find().sort({ createdAt: -1 }).limit(50);
    res.json({ guilds: premiumGuilds, logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Tous les serveurs (overview admin)
app.get('/api/admin/guilds', requireAuth, requireOwner, async (req, res) => {
  try {
    const guilds = await Guild.find().select(
      'guildId guildName premium premiumExpires prefix updatedAt'
    ).sort({ updatedAt: -1 });
    res.json(guilds);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Activer Premium pour un serveur (par guildId, userId ou username Discord)
app.post('/api/admin/premium/activate', requireAuth, requireOwner, async (req, res) => {
  try {
    const { guildId, guildName, userId, username, days, method, amount, note } = req.body;
    if (!guildId) return res.status(400).json({ error: 'guildId requis' });

    const expires = new Date(Date.now() + (days || 30) * 24 * 60 * 60 * 1000);
    const guild = await Guild.findOneAndUpdate(
      { guildId },
      {
        premium:        true,
        premiumExpires: expires,
        guildName:      guildName || undefined,
        premiumNote:    note || '',
      },
      { upsert: true, new: true }
    );

    // Log dans PremiumLog
    await PremiumLog.create({
      guildId,
      guildName:   guildName || guild.guildName || 'Inconnu',
      userId:      userId || '',
      username:    username || '',
      activatedBy: req.session.user.id,
      method:      method || 'Manuel',
      amount:      amount || 1.99,
      note:        note || '',
      expiresAt:   expires,
    });

    res.json({ success: true, expiresAt: expires });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Révoquer Premium
app.post('/api/admin/premium/revoke', requireAuth, requireOwner, async (req, res) => {
  try {
    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: 'guildId requis' });
    await Guild.findOneAndUpdate({ guildId }, { premium: false, premiumExpires: null });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chercher un utilisateur Discord par username ou ID pour trouver ses serveurs
app.get('/api/admin/search-user', requireAuth, requireOwner, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Paramètre q requis' });

    // Chercher dans les logs premium
    const logs = await PremiumLog.find({
      $or: [
        { userId: { $regex: q, $options: 'i' } },
        { username: { $regex: q, $options: 'i' } },
        { guildId: { $regex: q, $options: 'i' } },
        { guildName: { $regex: q, $options: 'i' } },
      ]
    }).sort({ createdAt: -1 }).limit(20);

    res.json({ logs });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stats globales admin
app.get('/api/admin/stats', requireAuth, requireOwner, async (req, res) => {
  try {
    const totalGuilds   = await Guild.countDocuments();
    const premiumGuilds = await Guild.countDocuments({ premium: true });
    const totalRevenue  = await PremiumLog.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
    const recentLogs    = await PremiumLog.find().sort({ createdAt: -1 }).limit(10);
    res.json({
      totalGuilds,
      premiumGuilds,
      totalRevenue: totalRevenue[0]?.total || 0,
      recentActivations: recentLogs,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  API — NOTIFICATIONS SOCIALES (internes, appelées par le bot)
// ══════════════════════════════════════════════════════════════

// Le bot appelle cette route pour récupérer tous les serveurs avec notifs actives
app.get('/api/bot/social-notifs', async (req, res) => {
  const botKey = req.headers['x-bot-key'];
  if (botKey !== process.env.BOT_SECRET_KEY) return res.status(401).json({ error: 'Non autorisé' });

  try {
    const guilds = await Guild.find({
      $or: [
        { 'socialNotifs.youtube.enabled': true },
        { 'socialNotifs.twitch.enabled':  true },
        { 'socialNotifs.tiktok.enabled':  true },
        { 'socialNotifs.instagram.enabled': true },
      ]
    }).select('guildId socialNotifs');
    res.json(guilds);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`🌐 Dashboard NKSBOT v1.01 sur http://localhost:${PORT}`);
  console.log(`👑 Owner ID: ${process.env.OWNER_DISCORD_ID || '⚠️ Non défini dans .env'}`);
});
