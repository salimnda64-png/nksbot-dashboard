<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NKSBOT Dashboard</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--p:#7c3aed;--pl:#a855f7;--bg:#08080f;--bg2:#0d0d1a;--bg3:#111124;--text:#f1f0ff;--muted:#8b87b0;--border:rgba(124,58,237,0.2);--card:rgba(13,13,26,0.9)}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;background:rgba(8,8,15,0.9);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.3rem;background:linear-gradient(135deg,#fff,var(--pl));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-right{display:flex;align-items:center;gap:1rem}
.avatar{width:32px;height:32px;border-radius:50%;border:2px solid var(--p)}
.btn-sm{background:transparent;color:var(--muted);padding:.4rem .8rem;border-radius:6px;border:1px solid var(--border);font-size:.85rem;text-decoration:none;transition:all .2s;cursor:pointer}
.btn-sm:hover{border-color:var(--p);color:var(--text)}
.container{max-width:1100px;margin:0 auto;padding:6rem 2rem 2rem}
h1{font-family:'Syne',sans-serif;font-size:1.8rem;font-weight:800;margin-bottom:.3rem}
.subtitle{color:var(--muted);margin-bottom:2rem}
.guilds{display:flex;flex-direction:column;gap:.8rem}
.guild-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:1.2rem 1.5rem;display:flex;align-items:center;gap:1rem;transition:all .2s}
.guild-card:hover{border-color:rgba(124,58,237,0.4);transform:translateX(4px)}
.guild-icon{width:48px;height:48px;border-radius:50%;object-fit:cover;background:var(--bg3)}
.guild-name{font-weight:600;font-size:1rem}
.guild-id{color:var(--muted);font-size:.8rem;margin-top:.2rem}
.guild-info{flex:1}
.badge-premium{background:rgba(234,179,8,.15);color:#eab308;border:1px solid rgba(234,179,8,.3);font-size:.7rem;padding:.15rem .5rem;border-radius:4px;font-weight:600;margin-left:.5rem}
.badge-bot{background:rgba(87,242,135,.1);color:#57F287;border:1px solid rgba(87,242,135,.3);font-size:.7rem;padding:.15rem .5rem;border-radius:4px}
.btn-config{padding:.6rem 1.2rem;border-radius:8px;font-size:.9rem;font-weight:600;text-decoration:none;background:var(--p);color:white;transition:all .2s}
.btn-config:hover{background:var(--pl)}
.btn-add{padding:.6rem 1.2rem;border-radius:8px;font-size:.9rem;font-weight:600;text-decoration:none;background:transparent;border:1px solid var(--border);color:var(--muted);transition:all .2s}
.btn-add:hover{border-color:var(--p);color:var(--text)}
.loading{color:var(--muted);padding:3rem;text-align:center}
.owner-btn{background:rgba(234,179,8,.15);color:#eab308;border:1px solid rgba(234,179,8,.3);padding:.5rem 1rem;border-radius:8px;font-size:.85rem;font-weight:600;text-decoration:none;transition:all .2s}
.owner-btn:hover{background:rgba(234,179,8,.25)}
</style>
</head>
<body>
<nav>
  <div class="logo">NKSBOT</div>
  <div class="nav-right">
    <div id="userInfo" style="display:flex;align-items:center;gap:.5rem;font-size:.9rem"></div>
    <span id="ownerLink"></span>
    <a href="/auth/logout" class="btn-sm">Déconnexion</a>
  </div>
</nav>
<main class="container">
  <h1>Mes serveurs</h1>
  <p class="subtitle">Sélectionne un serveur pour le configurer</p>
  <div id="guilds" class="guilds"><div class="loading">Chargement...</div></div>
</main>
<script>
const BOT_CLIENT_ID = '1492591833795264642';
async function load() {
  const [me, guilds] = await Promise.all([
    fetch('/api/me').then(r=>r.json()),
    fetch('/api/guilds').then(r=>r.json())
  ]);
  const avatar = me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
  document.getElementById('userInfo').innerHTML = `<img src="${avatar}" class="avatar"><span>${me.username}</span>`;
  if (me.isOwner) document.getElementById('ownerLink').innerHTML = `<a href="/admin" class="owner-btn">👑 Panel Admin</a>`;

  const container = document.getElementById('guilds');
  if (!guilds.length) { container.innerHTML = '<div class="loading">Aucun serveur trouvé.</div>'; return; }

  container.innerHTML = guilds.map(g => {
    const icon = g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : `https://cdn.discordapp.com/embed/avatars/0.png`;
    const premBadge = g.premium ? '<span class="badge-premium">⭐ Premium</span>' : '';
    const botBadge = g.botPresent ? '<span class="badge-bot">✓ Bot actif</span>' : '';
    const btn = g.botPresent
      ? `<a href="/dashboard/${g.id}" class="btn-config">⚙️ Configurer</a>`
      : `<a href="https://discord.com/oauth2/authorize?client_id=${BOT_CLIENT_ID}&permissions=8&scope=bot%20applications.commands&guild_id=${g.id}" target="_blank" class="btn-add">➕ Ajouter le bot</a>`;
    return `<div class="guild-card">
      <img src="${icon}" class="guild-icon" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="guild-info">
        <div class="guild-name">${g.name} ${premBadge} ${botBadge}</div>
        <div class="guild-id">ID: ${g.id}</div>
      </div>
      ${btn}
    </div>`;
  }).join('');
}
load();
</script>
</body>
</html>
