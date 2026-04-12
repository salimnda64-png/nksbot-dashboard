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
  populate();
  loadGeneral();
  loadPremium();
  loadAutoroles();
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
  const ch = chOpts(); const chCat = chOpts('', true); const rl = rlOpts();
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

function loadGeneral() {
  const premium = cfg.premium ? '⭐ <span style="color:#eab308">Premium actif</span>' : '🔓 Plan Gratuit (1,99€/mois)';
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
    ? `<div style="text-align:center;padding:1rem"><div style="font-size:2rem">⭐</div><div style="font-family:Syne,sans-serif;font-size:1.3rem;font-weight:800;margin:.5rem 0">Premium Actif</div><div style="color:var(--muted)">Expire le ${cfg.premiumExpires ? new Date(cfg.premiumExpires).toLocaleDateString('fr-FR') : 'N/A'}</div></div>`
    : `<div style="text-align:center;padding:1.5rem">
        <div style="font-size:3rem;margin-bottom:1rem">⭐</div>
        <div style="font-family:Syne,sans-serif;font-size:1.3rem;font-weight:800">Passer Premium</div>
        <div style="color:var(--muted);margin:.5rem 0 1.5rem">1,99€/mois — Tickets illimités, 500 crédits IA, logs avancés...</div>
        <div style="display:flex;flex-direction:column;gap:.8rem;max-width:300px;margin:0 auto">
          <a href="https://paypal.me/AmoungTerrorBoutique/1.99EUR" target="_blank" class="btn-save" style="text-decoration:none;text-align:center;padding:.8rem">💳 Payer avec PayPal (1,99€)</a>
          <a href="https://discord.gg/btuk38RknU" target="_blank" style="color:var(--purple-light);text-decoration:none;font-size:.9rem">💬 Ou ouvrir un ticket Discord</a>
        </div>
      </div>`;
}

function loadAutoroles() {
  const list = document.getElementById('autoroleList');
  list.innerHTML = autoroles.map(id => {
    const role = roles.find(r => r.id === id);
    const name = role ? role.name : id;
    return `<div class="role-tag"><span>@${name}</span><button onclick="removeAutorole('${id}')">✕</button></div>`;
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
    logs: { membres: document.getElementById('log_membres').value || null, messages: document.getElementById('log_messages').value || null, moderation: document.getElementById('log_moderation').value || null, vocal: document.getElementById('log_vocal').value || null, raid: document.getElementById('log_raid').value || null },
    welcome: { enabled: document.getElementById('welcome_enabled').checked, channelId: document.getElementById('welcome_channel').value || null, title: document.getElementById('welcome_title').value, message: document.getElementById('welcome_message').value, color: document.getElementById('welcome_color').value, dmEnabled: document.getElementById('welcome_dm').checked, dmMessage: document.getElementById('welcome_dm_msg').value },
    antiRaid: { enabled: document.getElementById('ar_enabled').checked, joinThreshold: parseInt(document.getElementById('ar_threshold').value), joinTimeWindow: parseInt(document.getElementById('ar_window').value), action: document.getElementById('ar_action').value },
    autoMod: { enabled: document.getElementById('am_enabled').checked, filterLinks: document.getElementById('am_links').checked, filterInvites: document.getElementById('am_invites').checked, filterCaps: document.getElementById('am_caps').checked, warnThreshold: parseInt(document.getElementById('am_warns').value) },
    tickets: { mode: document.getElementById('ticket_mode').value, categoryId: document.getElementById('ticket_cat').value || null, staffRoleId: document.getElementById('ticket_staff').value || null, logChannelId: document.getElementById('ticket_log').value || null },
    xp: { enabled: document.getElementById('xp_enabled').checked, announceChannel: document.getElementById('xp_channel').value || null, multiplier: parseFloat(document.getElementById('xp_mult').value) },
    economy: { enabled: document.getElementById('eco_enabled').checked, currencyName: document.getElementById('eco_name').value, currencyEmoji: document.getElementById('eco_emoji').value },
    autoroles,
  };
  const res = await fetch('/api/guild/' + guildId, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  if (res.success) {
    isDirty = false;
    const bar = document.getElementById('saveBar');
    bar.innerHTML = '<span style="color:#57F287">✅ Sauvegardé !</span>';
    setTimeout(() => { bar.classList.add('hidden'); bar.innerHTML = '<span>⚠️ Modifications non sauvegardées</span><button onclick="save()" class="btn-save">💾 Sauvegarder</button>'; }, 2000);
  }
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
