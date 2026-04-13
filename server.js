// ================================================================
//  NKSBOT v1.01 — Base de données (MongoDB / Mongoose)
// ================================================================
const mongoose = require('mongoose');

async function connect() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ MongoDB connecté');
}

// ── Guild (config serveur) ────────────────────────────────────────
const GuildSchema = new mongoose.Schema({
  guildId:   { type: String, required: true, unique: true },
  guildName: String,
  premium:        { type: Boolean, default: false },
  premiumExpires: Date,

  // Préfixe configurable depuis le dashboard
  prefix: { type: String, default: '!', enum: ['!', '/'] },

  // Rôles autorisés à accéder au panel dashboard
  panelRoles: [String],

  // Auto-roles à l'arrivée
  autoroles: [String],

  // Logs par salon
  logs: {
    membres:    String,
    messages:   String,
    moderation: String,
    vocal:      String,
    commandes:  String,
    raid:       String,
  },

  // Welcome / Goodbye
  welcome: {
    enabled:          { type: Boolean, default: false },
    channelId:        String,
    title:            { type: String, default: 'Bienvenue !' },
    message:          { type: String, default: 'Bienvenue {user} sur {server} !' },
    color:            { type: String, default: '#7c3aed' },
    imageUrl:         String,
    dmEnabled:        Boolean,
    dmMessage:        String,
    goodbyeEnabled:   { type: Boolean, default: false },
    goodbyeChannelId: String,
    goodbyeMessage:   { type: String, default: 'Au revoir {user} !' },
  },

  // Tickets avancés
  tickets: {
    categoryId:         String,
    staffRoleId:        String,
    logChannelId:       String,
    mode:               { type: String, default: 'channel' },
    maxOpen:            { type: Number, default: 5 },
    priorityEnabled:    { type: Boolean, default: false },
    transcriptsEnabled: { type: Boolean, default: false },
    closeMessage:       { type: String, default: 'Ticket fermé. Merci !' },
    categories: [{
      id:     String,
      label:  String,
      emoji:  String,
      roleId: String,
    }],
  },

  // Anti-raid
  antiRaid: {
    enabled:        { type: Boolean, default: true },
    joinThreshold:  { type: Number,  default: 5 },
    joinTimeWindow: { type: Number,  default: 10 },
    action:         { type: String,  default: 'kick' },
  },

  // Auto-mod
  autoMod: {
    enabled:       Boolean,
    filterLinks:   Boolean,
    filterInvites: { type: Boolean, default: true },
    filterCaps:    Boolean,
    capsThreshold: { type: Number, default: 70 },
    bannedWords:   [String],
    warnThreshold: { type: Number, default: 3 },
  },

  // XP
  xp: {
    enabled:         { type: Boolean, default: true },
    announceChannel: String,
    multiplier:      { type: Number, default: 1 },
    levelRoles: [{ level: Number, roleId: String }],
  },

  // Économie
  economy: {
    enabled:       Boolean,
    currencyName:  { type: String, default: 'pièces' },
    currencyEmoji: { type: String, default: '🪙' },
  },

  // ── NOTIFICATIONS SOCIALES ──────────────────────────────────────
  socialNotifs: {
    youtube: {
      enabled:         { type: Boolean, default: false },
      channelId:       String,          // ID ou handle YouTube (ex: @monchannel)
      discordChannelId: String,          // Salon Discord où envoyer
      message:         { type: String, default: '🎬 {channel} a publié une nouvelle vidéo !' },
      pingRole:        String,
      notifyVideo:     { type: Boolean, default: true },
      notifyLive:      { type: Boolean, default: true },
      notifyShort:     { type: Boolean, default: true },
      lastVideoId:     String,           // Pour ne pas renvoyer deux fois
    },
    twitch: {
      enabled:         { type: Boolean, default: false },
      username:        String,           // Nom d'utilisateur Twitch
      discordChannelId: String,
      message:         { type: String, default: '🔴 {streamer} est en live sur Twitch !' },
      pingRole:        String,
      showGame:        { type: Boolean, default: true },
      showViewers:     { type: Boolean, default: true },
      liveMessageId:   String,           // ID du message envoyé (pour l'éditer si fin de live)
      isLive:          { type: Boolean, default: false },
    },
    tiktok: {
      enabled:         { type: Boolean, default: false },
      username:        String,
      discordChannelId: String,
      message:         { type: String, default: '🎵 {user} a posté une nouvelle vidéo TikTok !' },
      pingRole:        String,
      lastVideoId:     String,
    },
    instagram: {
      enabled:         { type: Boolean, default: false },
      username:        String,
      discordChannelId: String,
      message:         { type: String, default: '📸 {user} a posté sur Instagram !' },
      pingRole:        String,
      notifyPost:      { type: Boolean, default: true },
      notifyReel:      { type: Boolean, default: true },
      lastPostId:      String,
    },
  },

  // ── STATUT BOT (Premium only) ───────────────────────────────────
  botStatus: {
    enabled:      { type: Boolean, default: false },
    status:       { type: String, default: 'online' },   // online / idle / dnd / invisible
    activityType: { type: String, default: 'PLAYING' },  // PLAYING / WATCHING / LISTENING / COMPETING
    activityText: { type: String, default: '' },
  },

  // ── REACTION ROLES ──────────────────────────────────────────────
  reactionRoles: [{
    messageId: String,
    channelId: String,
    type:      { type: String, enum: ['reaction', 'button'], default: 'button' },
    roles: [{
      emoji:  String,
      label:  String,
      roleId: String,
      style:  { type: String, default: 'PRIMARY' },
    }],
  }],

  updatedAt: { type: Date, default: Date.now },
});

// ── Member (XP, économie, IA) ─────────────────────────────────────
const MemberSchema = new mongoose.Schema({
  guildId:    { type: String, required: true },
  userId:     { type: String, required: true },
  xp:         { type: Number, default: 0 },
  level:      { type: Number, default: 0 },
  balance:    { type: Number, default: 0 },
  warnings:   { type: Number, default: 0 },
  lastDaily:  Date,
  lastWork:   Date,
  aiCredits:  { type: Number, default: 500 },   // 500 crédits par défaut (gratuit)
  aiHistory:  [{ role: String, content: String }],
  aiResetAt:  Date,                              // Pour reset mensuel
});

// Index composé pour éviter les doublons
MemberSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const Guild  = mongoose.models.Guild  || mongoose.model('Guild',  GuildSchema);
const Member = mongoose.models.Member || mongoose.model('Member', MemberSchema);

// ── Helpers ───────────────────────────────────────────────────────
async function getGuild(guildId, guildName) {
  let g = await Guild.findOne({ guildId });
  if (!g) {
    g = new Guild({ guildId, guildName: guildName || undefined });
    await g.save();
  } else if (guildName && g.guildName !== guildName) {
    g.guildName = guildName;
    await g.save();
  }
  return g;
}

async function getMember(guildId, userId) {
  let m = await Member.findOne({ guildId, userId });
  if (!m) {
    m = new Member({ guildId, userId, aiCredits: 500 });
    await m.save();
  }

  // Reset mensuel des crédits IA si ça fait plus d'un mois
  if (!m.aiResetAt || m.aiResetAt < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
    const guildDoc = await Guild.findOne({ guildId });
    const isPrem   = guildDoc?.premium && guildDoc?.premiumExpires > new Date();
    m.aiCredits = isPrem ? Infinity : 500;
    m.aiResetAt = new Date();
    await m.save();
  }

  return m;
}

async function isPremium(guildId) {
  const g = await Guild.findOne({ guildId });
  if (!g?.premium) return false;
  if (g.premiumExpires && g.premiumExpires < new Date()) {
    // Expiration — désactive auto
    g.premium = false;
    await g.save();
    return false;
  }
  return true;
}

// Récupère le préfixe du serveur (depuis DB ou config par défaut)
async function getPrefix(guildId) {
  const g = await Guild.findOne({ guildId }).select('prefix');
  return g?.prefix || '!';
}

module.exports = { connect, Guild, Member, getGuild, getMember, isPremium, getPrefix };
