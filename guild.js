const guildId = location.pathname.split('/').pop();
let cfg = {}, channels = [], roles = [], autoroles = [];

async function load() {
  const [c, ch, rl] = await Promise.all([
    fetch('/api/guild/' + guildId).then(r => r.json()),
    fetch('/api/guild/' + guildId + '/channels').then(r => r.json()),
    fetch('/api/guild/' + guildId + '/roles').then(r => r.json()),
  ]);
  cfg = c; channels = ch; roles = rl;
  autoroles = cfg.autoroles || [];

  // Check premium success
  const params = new URLSearchParams(location.search);
  if (params.get('premium') === 'success') {
    showNotif('✅ Premium activé avec succès ! Merci 🎉', 'success');
    history.replaceState({}, '', location.pathname);
  }

  populate();
  loadGeneral();
  loadPremium();
  loadAutoroles();
  loadNotifs();
}

function chOpts(sel, incCat) {
  return channels.filter(c => incCat ? true : c.type === 0).map(c =>
    `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${c.type === 4 ? '📁 ' : '#'}${c.name}</option>`
  ).join('');
}
function rlOpts(sel) {
  return roles.map(r => `<option value="${r.id}"${r.id === sel ? ' selected' : ''}>${r.name}</option>`).join('');
}
function setSelect(id, opts, sel) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<option value="">Désactivé</option>' + opts;
  if (sel) el.value = sel;
}

function populate() {
  const ch = chOpts(), chCat = chOpts('', true), rl = rlOpts();
  setSelect('log_membres', ch, cfg.logs?.membres);
  setSelect('log_messages', ch, cfg.logs?.messages);
  setSelect('log_moderation', ch, cfg.logs?.moderation);
  setSelect('log_vocal', ch, cfg.logs?.vocal);
  setSelect('log_raid', ch, cfg.logs?.raid);
  document.getElementById('welcome_enabled').checked = cfg.welcome?.enabled || false;
  setSelect('welcome_channel', ch, cfg.welcome?.channelId);
  document.getElementById('welcome_title').value = cfg.welcome?.title || 'Bienvenue !';
  document.getElementById('welcome_message').value = cfg.welcome?.message || 'Bienvenue {user} !';
  document.getElementById('welcome_color').value = cfg.welcome?.color || '#7c3aed';
  document.getElementById('welcome_dm').checked = cfg.welcome?.dmEnabled || false;
  document.getElementById('welcome_dm_msg').value = cfg.welcome?.dmMessage || '';
  document.getElementById('ar_enabled').checked = cfg.antiRaid?.enabled !== false;
  document.getElementById('ar_threshold').value = cfg.antiRaid?.joinThreshold || 5;
  document.getElementById('ar_window').value = cfg.antiRaid?.joinTimeWindow || 10;
  document.getElementById('ar_action').value = cfg.antiRaid?.action || 'kick';
  document.getElementById('am_enabled').checked = cfg.autoMod?.enabled || false;
  document.getElementById('am_links').checked = cfg.autoMod?.filterLinks || false;
  document.getElementById('am_invites').checked = cfg.autoMod?.filterInvites !== false;
  document.getElementById('am_caps').checked = cfg.autoMod?.filterCaps || false;
  document.getElementById('am_warns').value = cfg.autoMod?.warnThreshold || 3;
  document.getElementById('ticket_mode').value = cfg.tickets?.mode || 'channel';
  setSelect('ticket_cat', chCat, cfg.tickets?.categoryId);
  document.getElementById('ticket_staff').innerHTML = '<option value="">Aucun</option>' + rl;
  if (cfg.tickets?.staffRoleId) document.getElementById('ticket_staff').value = cfg.tickets.staffRoleId;
  setSelect('ticket_log', ch, cfg.tickets?.logChannelId);
  document.getElementById('xp_enabled').checked = cfg.xp?.enabled !== false;
  setSelect('xp_channel', ch, cfg.xp?.announceChannel);
  document.getElementById('xp_mult').value = cfg.xp?.multiplier || 1;
  document.getElementById('eco_enabled').checked = cfg.economy?.enabled || false;
  document.getElementById('eco_name').value = cfg.economy?.currencyName || 'pièces';
  document.getElementById('eco_emoji').value = cfg.economy?.currencyEmoji || '🪙';
  document.getElementById('autorole_select').innerHTML = '<option value="">Choisir un rôle...</option>' + rl;
}

function loadNotifs() {
  const n = cfg.socialNotifs || {};
  const ch = chOpts(), rl = rlOpts();

  // YouTube
  document.getElementById('yt_enabled').checked = n.youtube?.enabled || false;
  document.getElementById('yt_channelId').value = n.youtube?.channelId || '';
  document.getElementById('yt_message').value = n.youtube?.message || '🎬 {channel} a publié une nouvelle vidéo !';
  setSelect('yt_discordChannel', ch, n.youtube?.discordChannelId);
  document.getElementById('yt_pingRole').innerHTML = '<option value="">Aucun</option>' + rl;
  if (n.youtube?.pingRole) document.getElementById('yt_pingRole').value = n.youtube.pingRole;

  // Twitch
  document.getElementById('tw_enabled').checked = n.twitch?.enabled || false;
  document.getElementById('tw_username').value = n.twitch?.username || '';
  document.getElementById('tw_message').value = n.twitch?.message || '🔴 {streamer} est en live !';
  setSelect('tw_discordChannel', ch, n.twitch?.discordChannelId);
  document.getElementById('tw_pingRole').innerHTML = '<option value="">Aucun</option>' + rl;
  if (n.twitch?.pingRole) document.getElementById('tw_pingRole').value = n.twitch.pingRole;

  // TikTok
  document.getElementById('tt_enabled').checked = n.tiktok?.enabled || false;
  document.getElementById('tt_username').value = n.tiktok?.username || '';
  document.getElementById('tt_message').value = n.tiktok?.message || '🎵 {user} a posté une vidéo !';
  setSelect('tt_discordChannel', ch, n.tiktok?.discordChannelId);
  document.getElementById('tt_pingRole').innerHTML = '<option value="">Aucun</option>' + rl;
  if (n.tiktok?.pingRole) document.getElementById('tt_pingRole').value = n.tiktok.pingRole;

  // Instagram
  document.getElementById('ig_enabled').checked = n.instagram?.enabled || false;
  document.getElementById('ig_username').value = n.instagram?.username || '';
  document.getElementById('ig_message').value = n.instagram?.message || '📸 {user} a posté sur Instagram !';
  setSelect('ig_discordChannel', ch, n.instagram?.discordChannelId);
  document.getElementById('ig_pingRole').innerHTML = '<option value="">Aucun</option>' + rl;
  if (n.instagram?.pingRole) document.getElementById('ig_pingRole').value = n.instagram.pingRole;
}

function loadGeneral() {
  const premium = cfg.premium ? '⭐ <span style="color:#eab308">Premium actif</span>' : '🔓 Plan Gratuit';
  document.getElementById('generalInfo').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.8rem">
      <div><strong>ID du serveur</strong><br><code style="color:var(--purple-light)">${guildId}</code></div>
      <div><strong>Plan actuel</strong><br>${premium}</div>
      <div style="color:var(--muted);font-size:.85rem">Dernière modification : ${cfg.updatedAt ? new Date(cfg.updatedAt).toLocaleDateString('fr-FR') : 'Jamais'}</div>
    </div>`;
  if (cfg.guildName) document.getElementById('gName').textContent = cfg.guildName;
}

function loadPremium() {
  const isPremium = cfg.premium;
  document.getElementById('premiumContent').innerHTML = isPremium
    ? `<div style="text-align:center;padding:1.5rem">
        <div style="font-size:3rem">⭐</div>
        <div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;margin:.5rem 0">Premium Actif</div>
        <div style="color:var(--muted)">Expire le ${cfg.premiumExpires ? new Date(cfg.premiumExpires).toLocaleDateString('fr-FR') : 'N/A'}</div>
        <div style="margin-top:1.5rem;display:flex;flex-direction:column;gap:.8rem;max-width:300px;margin:1.5rem auto 0">
          <div style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);border-radius:10px;padding:.8rem;color:#34d399;font-size:.9rem">✅ Tickets illimités</div>
          <div style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);border-radius:10px;padding:.8rem;color:#34d399;font-size:.9rem">✅ Crédits IA illimités</div>
          <div style="background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.3);border-radius:10px;padding:.8rem;color:#34d399;font-size:.9rem">✅ Notifications sociales</div>
        </div>
      </div>`
    : `<div style="text-align:center;padding:1.5rem">
        <div style="font-size:3rem">⭐</div>
        <div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;margin:.5rem 0">Passer Premium</div>
        <div style="color:var(--muted);margin:.5rem 0 1.5rem">Débloque tous les avantages pour ton serveur</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;max-width:500px;margin:0 auto 2rem">
          <div class="price-option" onclick="selectPlan(1, this)">
            <div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800">1,99€</div>
            <div style="color:var(--muted);font-size:.8rem">1 mois</div>
          </div>
          <div class="price-option selected" onclick="selectPlan(3, this)">
            <div style="background:#7c3aed;color:white;font-size:.7rem;padding:2px 8px;border-radius:10px;margin-bottom:.3rem">Populaire</div>
            <div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800">4,99€</div>
            <div style="color:var(--muted);font-size:.8rem">3 mois</div>
          </div>
          <div class="price-option" onclick="selectPlan(12, this)">
            <div style="background:#eab308;color:#000;font-size:.7rem;padding:2px 8px;border-radius:10px;margin-bottom:.3rem">-37%</div>
            <div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800">14,99€</div>
            <div style="color:var(--muted);font-size:.8rem">12 mois</div>
          </div>
        </div>
        <button id="stripeBtn" class="btn-save" style="padding:.9rem 2rem;font-size:1rem;border-radius:10px" onclick="payStripe()">💳 Payer avec Stripe</button>
        <div style="margin-top:1rem;color:var(--muted);font-size:.8rem">🔒 Paiement sécurisé par Stripe · CB, Apple Pay, Google Pay</div>
        <div style="margin-top:.5rem"><a href="https://discord.gg/Vhr22paQAe" target="_blank" style="color:var(--purple-light);font-size:.85rem">💬 Ou contacte-nous sur Discord</a></div>
      </div>`;
}

let selectedMonths = 3;
function selectPlan(months, el) {
  selectedMonths = months;
  document.querySelectorAll('.price-option').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

async function payStripe() {
  const btn = document.getElementById('stripeBtn');
  btn.textContent = '⏳ Redirection...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, months: selectedMonths }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      showNotif('❌ Erreur : ' + (data.error || 'Stripe non configuré'), 'error');
      btn.textContent = '💳 Payer avec Stripe';
      btn.disabled = false;
    }
  } catch {
    showNotif('❌ Erreur de connexion', 'error');
    btn.textContent = '💳 Payer avec Stripe';
    btn.disabled = false;
  }
}

function loadAutoroles() {
  const list = document.getElementById('autoroleList');
  list.innerHTML = autoroles.map(id => {
    const role = roles.find(r => r.id === id);
    return `<div class="role-tag"><span>@${role ? role.name : id}</span><button onclick="removeAutorole('${id}')">✕</button></div>`;
  }).join('');
}
function addAutorole() {
  const sel = document.getElementById('autorole_select');
  const id = sel.value;
  if (!id || autoroles.includes(id)) return;
  autoroles.push(id);
  loadAutoroles();
  dirty();
}
function removeAutorole(id) {
  autoroles = autoroles.filter(r => r !== id);
  loadAutoroles();
  dirty();
}

let isDirty = false;
function dirty() { isDirty = true; document.getElementById('saveBar').classList.remove('hidden'); }

async function save() {
  const body = {
    logs: { membres: v('log_membres'), messages: v('log_messages'), moderation: v('log_moderation'), vocal: v('log_vocal'), raid: v('log_raid') },
    welcome: { enabled: cb('welcome_enabled'), channelId: v('welcome_channel'), title: v('welcome_title'), message: v('welcome_message'), color: v('welcome_color'), dmEnabled: cb('welcome_dm'), dmMessage: v('welcome_dm_msg') },
    antiRaid: { enabled: cb('ar_enabled'), joinThreshold: +v('ar_threshold'), joinTimeWindow: +v('ar_window'), action: v('ar_action') },
    autoMod: { enabled: cb('am_enabled'), filterLinks: cb('am_links'), filterInvites: cb('am_invites'), filterCaps: cb('am_caps'), warnThreshold: +v('am_warns') },
    tickets: { mode: v('ticket_mode'), categoryId: v('ticket_cat'), staffRoleId: v('ticket_staff'), logChannelId: v('ticket_log') },
    xp: { enabled: cb('xp_enabled'), announceChannel: v('xp_channel'), multiplier: +v('xp_mult') },
    economy: { enabled: cb('eco_enabled'), currencyName: v('eco_name'), currencyEmoji: v('eco_emoji') },
    autoroles,
    socialNotifs: {
      youtube: { enabled: cb('yt_enabled'), channelId: v('yt_channelId'), discordChannelId: v('yt_discordChannel'), message: v('yt_message'), pingRole: v('yt_pingRole') },
      twitch: { enabled: cb('tw_enabled'), username: v('tw_username'), discordChannelId: v('tw_discordChannel'), message: v('tw_message'), pingRole: v('tw_pingRole') },
      tiktok: { enabled: cb('tt_enabled'), username: v('tt_username'), discordChannelId: v('tt_discordChannel'), message: v('tt_message'), pingRole: v('tt_pingRole') },
      instagram: { enabled: cb('ig_enabled'), username: v('ig_username'), discordChannelId: v('ig_discordChannel'), message: v('ig_message'), pingRole: v('ig_pingRole') },
    },
  };

  const res = await fetch('/api/guild/' + guildId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

  if (res.success) {
    isDirty = false;
    showNotif('✅ Sauvegardé !', 'success');
    document.getElementById('saveBar').classList.add('hidden');
  } else {
    showNotif('❌ Erreur lors de la sauvegarde', 'error');
  }
}

function v(id) { return document.getElementById(id)?.value || null; }
function cb(id) { return document.getElementById(id)?.checked || false; }

function showNotif(msg, type) {
  const n = document.createElement('div');
  n.style.cssText = `position:fixed;top:80px;right:20px;padding:.8rem 1.5rem;border-radius:10px;font-weight:600;z-index:999;background:${type === 'success' ? 'rgba(52,211,153,.2);border:1px solid rgba(52,211,153,.4);color:#34d399' : 'rgba(248,113,113,.2);border:1px solid rgba(248,113,113,.4);color:#f87171'}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('tab-' + item.dataset.tab).classList.add('active');
  });
});

load();
