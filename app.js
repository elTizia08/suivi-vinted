(() => {
'use strict';
/* ================= Données ================= */
const KEY = 'suivi-vinted-v1';
const ST = [['en_ligne','En ligne'],['vendu','Vendu'],['commande','Commandé'],['recu','Reçu'],['expedie','Expédié'],['livre','Livré'],['paye','Payé']];
const SL = Object.fromEntries(ST);
const idx = s => ST.findIndex(x => x[0] === s);
let S = JSON.parse(localStorage.getItem(KEY) || 'null') || {
  articles: [], orders: [], files: [], draft: {}, tab: null,
  settings: { regime: 'micro', decl: 'mensuelle', rate: '' }
};
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const uid = () => Math.random().toString(36).slice(2, 10);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = n => (Number(n) || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(n) ? 0 : n; };
const fdate = t => t ? new Date(t).toLocaleDateString('fr-FR') : '';
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 1800); };

const units = () => S.articles.flatMap(a => a.units.map(u => ({ u, a })));
const hasVal = v => v !== undefined && v !== null && v !== '';
const cost = (u, a) => hasVal(u.cost) ? num(u.cost) : num(a.sheinPrice);
const sale = (u, a) => hasVal(u.salePrice) ? num(u.salePrice) : num(a.vintedPrice);
const findUnit = id => units().find(x => x.u.id === id);
const online = a => a.units.filter(u => u.status === 'en_ligne').length;
const newUnit = (status = 'en_ligne') => ({ id: uid(), status, dates: { [status]: Date.now() }, salePrice: '', cost: '', buyer: '', note: '', orderId: null });

/* ================= Fichiers (bordereaux) en IndexedDB ================= */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('suivi-vinted', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('f');
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const idb = async (mode, fn) => { const d = await dbp; return new Promise((res, rej) => {
  const t = d.transaction('f', mode); const rq = fn(t.objectStore('f'));
  t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); }); };

/* ================= Vues ================= */
const NAV = [
  ['VUE D\'ENSEMBLE'], ['today', 'À faire aujourd\'hui'], ['dash', 'Tableau de bord'],
  ['VENTES'], ['order', 'À commander', () => units().filter(x => x.u.status === 'vendu').length],
  ['shein', 'Commandes Shein'], ['bord', 'Bordereaux'],
  ['CATALOGUE'], ['stock', 'Stock', () => S.articles.length], ['pub', 'Publier'], ['art', 'Articles & fiches'],
  ['COMPTABILITÉ'], ['stats', 'Stats & compta']
];

function unitRow(u, a) {
  const next = ST[idx(u.status) + 1];
  const m = sale(u, a) - cost(u, a);
  const files = S.files.filter(f => f.unitId === u.id).length;
  return `<div class="unit"><div class="row">
    <b>${esc(a.name)}</b><span class="pill">${esc(a.size)}</span>
    <select data-f="u|${u.id}|status">${ST.map(s => `<option value="${s[0]}" ${s[0] === u.status ? 'selected' : ''}>${s[1]}</option>`).join('')}</select>
    ${next ? `<button data-a="adv" data-id="${u.id}">→ ${next[1]}</button>` : ''}
    <span class="mut">Vente</span><input type="number" step="0.01" data-f="u|${u.id}|salePrice" value="${esc(u.salePrice !== '' ? u.salePrice : a.vintedPrice)}">
    <span class="mut">Acheté</span><input type="number" step="0.01" data-f="u|${u.id}|cost" value="${esc(u.cost !== '' ? u.cost : a.sheinPrice)}">
    <b class="${m >= 0 ? 'pos' : 'neg'}">${eur(m)}</b>
    <button class="x" data-a="delUnit" data-id="${u.id}">✕</button></div>
    <div class="row" style="margin-top:6px"><span class="mut">Acheteur</span><input data-f="u|${u.id}|buyer" value="${esc(u.buyer)}" placeholder="pseudo Vinted">
    <span class="mut">Note</span><input data-f="u|${u.id}|note" value="${esc(u.note)}" placeholder="suivi, remarque…">
    <span class="mut">📎 ${files}</span></div></div>`;
}

const views = {
  today() {
    const U = units(), out = [];
    const sec = (title, list, btn) => list.length ? `<h3>${title} (${list.length})</h3>` + list.map(x => `<div class="card row" style="justify-content:space-between"><span><b>${esc(x.a.name)}</b> · ${esc(x.a.size)} ${x.u.buyer ? '· 👤 ' + esc(x.u.buyer) : ''}</span>${btn(x)}</div>`).join('') : '';
    const alerts = [];
    S.articles.forEach(a => {
      if (online(a) < num(a.threshold || 1)) alerts.push(`<div class="alert"><span><b>${esc(a.name)}</b> : plus assez d'annonces en ligne (seuil ${num(a.threshold || 1)})</span><button data-a="goPub" data-id="${a.id}">📝 Remettre en ligne</button></div>`);
      if (num(a.sheinNow) > num(a.sheinPrice) && a.sheinNow !== '') alerts.push(`<div class="alert"><span>⚠ <b>${esc(a.name)}</b> : Shein est passé à ${eur(a.sheinNow)} (payé ${eur(a.sheinPrice)}) : ta marge baisse</span><a href="#stock"><button>Voir le stock</button></a></div>`);
    });
    return `<h2>À faire aujourd'hui</h2>${alerts.join('')}
      ${sec('🛒 À commander sur Shein', U.filter(x => x.u.status === 'vendu'), x => `<a href="#order"><button class="p">Commander</button></a>`)}
      ${sec('📦 Reçu : à expédier', U.filter(x => x.u.status === 'recu'), x => `<span class="row"><a href="#bord"><button>Bordereau</button></a><button class="p" data-a="adv" data-id="${x.u.id}">Expédié</button></span>`)}
      ${sec('🚚 Expédié : marquer livré', U.filter(x => x.u.status === 'expedie'), x => `<button data-a="adv" data-id="${x.u.id}">→ Livré</button>`)}
      ${sec('💶 Livré : marquer payé', U.filter(x => x.u.status === 'livre'), x => `<button class="p" data-a="adv" data-id="${x.u.id}">→ Payé</button>`)}
      ${sec('⏳ Commandé sur Shein, en attente', U.filter(x => x.u.status === 'commande'), x => `<button data-a="adv" data-id="${x.u.id}">→ Reçu</button>`)}
      ${!U.length ? '<div class="card mut">Commence par ajouter un article dans « Articles & fiches ».</div>' : ''}`;
  },

  dash() {
    const U = units(); const c = {};
    ST.forEach(s => c[s[0]] = U.filter(x => x.u.status === s[0]).length);
    const spent = U.filter(x => idx(x.u.status) >= 2).reduce((t, x) => t + cost(x.u, x.a), 0);
    const cashed = U.filter(x => x.u.status === 'paye').reduce((t, x) => t + sale(x.u, x.a), 0);
    const coming = U.filter(x => idx(x.u.status) >= 1 && x.u.status !== 'paye').reduce((t, x) => t + sale(x.u, x.a) - cost(x.u, x.a), 0);
    return `<h2>Tableau de bord</h2><div class="grid">
      <div class="kpi"><small>Dépensé</small><b>${eur(spent)}</b></div>
      <div class="kpi"><small>Encaissé</small><b>${eur(cashed)}</b></div>
      <div class="kpi"><small>Solde</small><b class="${cashed - spent >= 0 ? 'pos' : 'neg'}">${eur(cashed - spent)}</b></div>
      <div class="kpi"><small>Marge à venir</small><b class="pos">${eur(coming)}</b></div></div>
      <h3>Par statut</h3><div class="grid">${ST.map(s => `<div class="kpi"><small>${s[1]}</small><b>${c[s[0]]}</b></div>`).join('')}</div>`;
  },

  order() {
    const list = units().filter(x => x.u.status === 'vendu');
    return `<h2>À commander sur Shein</h2>
      <div class="card">${list.length ? list.map(x => `<label class="row" style="padding:6px 0"><input type="checkbox" class="sel" value="${x.u.id}"> <b>${esc(x.a.name)}</b> · ${esc(x.a.size)} · 👤 ${esc(x.u.buyer || '?')} ${x.a.sheinUrl ? `<a style="color:var(--acc)" target="_blank" rel="noopener" href="${esc(x.a.sheinUrl)}">lien Shein ↗</a>` : ''}</label>`).join('') : '<span class="mut">Rien à commander 🎉</span>'}</div>
      ${list.length ? `<div class="card row"><input id="ordTotal" type="number" step="0.01" placeholder="Total payé (€)"><button class="p" data-a="mkOrder">Créer la commande Shein</button><span class="mut">Le total est réparti à parts égales sur les articles cochés.</span></div>` : ''}`;
  },

  shein() {
    return `<h2>Commandes Shein</h2>${S.orders.length ? `<div class="card"><table><tr><th>Commande</th><th>Articles</th><th>Total</th><th>Statut</th><th></th></tr>
      ${S.orders.slice().reverse().map(o => { const us = units().filter(x => x.u.orderId === o.id); const st = us.every(x => idx(x.u.status) >= 3) ? 'Reçue' : 'En route';
        return `<tr><td>Commande du ${fdate(o.date)}</td><td>${us.length}</td><td>${eur(o.total)}</td><td>${st}</td><td>${st === 'En route' ? `<button data-a="recvOrder" data-id="${o.id}">Marquer reçue</button>` : ''}</td></tr>`; }).join('')}</table></div>` : '<div class="card mut">Aucune commande. Crée-en depuis « À commander ».</div>'}`;
  },

  bord() {
    const U = units(); const opts = `<option value="">— non rattaché —</option>` + U.map(x => `<option value="${x.u.id}">${esc(x.a.name)} #${esc(x.u.id.slice(0, 3))} · ${esc(x.u.buyer || '?')}</option>`).join('');
    const row = f => `<div class="card row" style="justify-content:space-between"><span><b>${esc(f.name)}</b> <span class="mut">${fdate(f.added)}</span> ${f.printed ? '✓ imprimé' : ''}</span>
      <span class="row"><select data-f="f|${f.id}|unitId">${opts.replace(`value="${f.unitId}"`, `value="${f.unitId}" selected`)}</select>
      <button data-a="openF" data-id="${f.id}">Ouvrir / imprimer</button><button data-a="printed" data-id="${f.id}">✓ Imprimé</button><button class="x" data-a="delF" data-id="${f.id}">✕</button></span></div>`;
    return `<h2>Bordereaux d'envoi</h2><div class="drop" id="drop">Glisse tes bordereaux ici (PDF ou images) ou <button onclick="document.getElementById('fin').click()">choisir des fichiers</button><input id="fin" type="file" multiple accept=".pdf,image/*" hidden></div>
      <h3>À imprimer (${S.files.filter(f => !f.printed).length})</h3>${S.files.filter(f => !f.printed).map(row).join('') || '<span class="mut">Aucun</span>'}
      <h3>Déjà imprimés (${S.files.filter(f => f.printed).length})</h3>${S.files.filter(f => f.printed).map(row).join('') || '<span class="mut">Aucun</span>'}
      <p class="mut">Les fichiers restent dans ce navigateur (IndexedDB), ils ne sont pas envoyés ailleurs.</p>`;
  },

  stock() {
    return `<h2>Stock</h2><div class="card"><table><tr><th>Article</th><th>En ligne</th><th>Seuil</th><th>Prix Shein payé</th><th>Prix Shein maintenant</th><th>Lien Shein</th></tr>
      ${S.articles.map(a => `<tr><td><b>${esc(a.name)}</b><br><span class="mut">${esc(a.size)}</span></td><td>${online(a)}</td>
      <td><input type="number" data-f="a|${a.id}|threshold" value="${esc(a.threshold ?? 1)}"></td>
      <td><input type="number" step="0.01" data-f="a|${a.id}|sheinPrice" value="${esc(a.sheinPrice)}"></td>
      <td><input type="number" step="0.01" data-f="a|${a.id}|sheinNow" value="${esc(a.sheinNow ?? '')}"></td>
      <td><input data-f="a|${a.id}|sheinUrl" value="${esc(a.sheinUrl)}" placeholder="https://fr.shein.com/…"></td></tr>`).join('') || '<tr><td colspan="6" class="mut">Aucun article</td></tr>'}</table></div>`;
  },

  pub() {
    const d = S.draft;
    const a = S.articles.find(x => x.id === d.articleId);
    const auto = a ? { title: `${a.name} – Taille ${a.size}`, desc: `${a.name}.\n\nTaille : ${a.size}\nÉtat : neuf, jamais porté\n\nN'hésite pas si tu as une question !` } : { title: '', desc: '' };
    return `<h2>Publier</h2><div class="card">
      <div class="row"><select id="dArt"><option value="">— choisir un article —</option>${S.articles.map(x => `<option value="${x.id}" ${x.id === d.articleId ? 'selected' : ''}>${esc(x.name)} (${esc(x.size)})</option>`).join('')}</select>
      <button data-a="autoTxt">🔄 Texte automatique</button></div>
      <p class="mut">Titre</p><input class="w" id="dTitle" value="${esc(d.title ?? auto.title)}">
      <p class="mut">Description</p><textarea id="dDesc">${esc(d.desc ?? auto.desc)}</textarea>
      <div class="row" style="margin-top:10px"><button data-a="cpTitle">Copier le titre</button><button data-a="cpDesc">Copier la description</button>
      <a href="https://www.vinted.fr/items/new" target="_blank" rel="noopener"><button class="p">Ouvrir la page de vente Vinted ↗</button></a>
      <button data-a="published">✓ C'est publié : l'ajouter au suivi</button></div></div>`;
  },

  art() {
    const t = S.tab && S.articles.find(a => a.id === S.tab) ? S.tab : (S.articles[0] || {}).id;
    const a = S.articles.find(x => x.id === t);
    return `<h2>Articles & fiches</h2><div class="tabs">${S.articles.map(x => `<span class="pill ${x.id === t ? 'on' : ''}" style="cursor:pointer" data-a="tab" data-id="${x.id}">${esc(x.name)} · ${esc(x.size)}</span>`).join('')}<span class="pill" style="cursor:pointer" data-a="newArt">+ Ajouter un article</span></div>
      ${a ? `<div class="card"><div class="row"><b style="font-size:17px">${esc(a.name)}</b>${ST.map(s => { const n = a.units.filter(u => u.status === s[0]).length; return n ? `<span class="pill">${s[1]} : ${n}</span>` : ''; }).join('')}</div>
      <div class="row" style="margin-top:10px"><input data-f="a|${a.id}|name" value="${esc(a.name)}"><input style="width:70px" data-f="a|${a.id}|size" value="${esc(a.size)}">
      <span class="mut">Shein</span><input type="number" step="0.01" data-f="a|${a.id}|sheinPrice" value="${esc(a.sheinPrice)}">
      <span class="mut">Vinted</span><input type="number" step="0.01" data-f="a|${a.id}|vintedPrice" value="${esc(a.vintedPrice)}">
      <b class="${num(a.vintedPrice) - num(a.sheinPrice) >= 0 ? 'pos' : 'neg'}">marge ${eur(num(a.vintedPrice) - num(a.sheinPrice))}</b>
      <button class="x" data-a="delArt" data-id="${a.id}">Supprimer l'article</button></div></div>
      ${a.units.map((u, i) => unitRow(u, a)).join('')}
      <button data-a="addUnit" data-id="${a.id}">+ Ajouter une annonce</button>` : '<div class="card mut">Aucun article. Clique sur « + Ajouter un article ».</div>'}`;
  },

  stats() {
    const U = units(); const yr = new Date().getFullYear();
    const sold = U.filter(x => idx(x.u.status) >= 1 && new Date(x.u.dates.vendu || 0).getFullYear() === yr);
    const sCount = sold.length, sSum = sold.reduce((t, x) => t + sale(x.u, x.a), 0);
    const months = {};
    U.filter(x => x.u.status === 'paye').forEach(x => { const d = new Date(x.u.dates.paye || Date.now()); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); months[k] = (months[k] || 0) + sale(x.u, x.a); });
    const rate = num(S.settings.rate);
    const bil = S.articles.map(a => { const us = a.units; const sd = us.filter(u => idx(u.status) >= 1); const gain = sd.reduce((t, u) => t + sale(u, a) - cost(u, a), 0);
      return `<tr><td><b>${esc(a.name)}</b> ${esc(a.size)}</td><td>${online(a)}</td><td>${sd.length}</td><td>${us.filter(u => u.status === 'paye').length}</td><td>${eur(us.filter(u => u.status === 'paye').reduce((t, u) => t + sale(u, a), 0))}</td><td class="${gain >= 0 ? 'pos' : 'neg'}">${eur(gain)}</td></tr>`; }).join('');
    return `<h2>Argent dans le temps</h2><div class="card"><canvas id="chart" width="1000" height="260"></canvas><div class="row mut" id="legend"></div></div>
      <h3>Bilan : stock, gains et marges</h3><div class="card"><table><tr><th>Produit</th><th>En ligne</th><th>Vendus</th><th>Payés</th><th>Encaissé</th><th>Gain (vendus)</th></tr>${bil || '<tr><td class="mut">Aucune donnée</td></tr>'}</table></div>
      <h3>Fiscalité : DAC7 et URSSAF</h3><div class="card grid" style="align-items:start">
      <div><b>DAC7 ${yr}</b><p>${sCount} vente(s) sur 30<br>${eur(sSum)} sur 2 000 €</p><p class="mut">Dès 30 ventes <b>ou</b> 2 000 € dans l'année, Vinted transmet tes ventes au fisc. Revendre ses affaires perso n'est pas imposable ; acheter pour revendre est une activité commerciale à déclarer.</p></div>
      <div><b>Ton régime</b><br><select data-f="s|x|regime"><option value="micro" ${S.settings.regime === 'micro' ? 'selected' : ''}>Micro-entreprise (achat-revente)</option><option value="autre" ${S.settings.regime === 'autre' ? 'selected' : ''}>Autre</option></select>
      <p><select data-f="s|x|decl"><option ${S.settings.decl === 'mensuelle' ? 'selected' : ''}>mensuelle</option><option ${S.settings.decl === 'trimestrielle' ? 'selected' : ''}>trimestrielle</option></select> <input type="number" step="0.1" style="width:80px" placeholder="taux %" data-f="s|x|rate" value="${esc(S.settings.rate)}"></p>
      <p class="mut">Vérifie le taux sur autoentrepreneur.urssaf.fr.</p></div>
      <div><b>À déclarer à l'URSSAF</b> <span class="mut">(ventes « Payé »)</span>${Object.keys(months).sort().map(k => `<p>${k} : <b>${eur(months[k])}</b>${rate ? ` <span class="mut">→ cotisation ≈ ${eur(months[k] * rate / 100)}</span>` : ''}</p>`).join('') || '<p class="mut">Rien d\'encaissé pour l\'instant.</p>'}<p class="mut">On déclare le prix de vente encaissé, pas le bénéfice.</p></div></div>
      <div class="row noprint"><button class="p" data-a="csv">⬇ Toutes les ventes en CSV</button><button data-a="print">🖨 Imprimer / PDF</button><button data-a="backup">Exporter une sauvegarde</button><label>Importer : <input type="file" id="imp" accept=".json"></label></div>
      <p class="mut">Les données sont enregistrées dans ce navigateur uniquement. La sauvegarde ne contient pas les bordereaux : garde aussi les PDF ailleurs.</p>`;
  }
};

/* ================= Rendu ================= */
function render() {
  const v = (location.hash.slice(1) || 'today'); const view = views[v] ? v : 'today';
  $('#nav').innerHTML = NAV.map(n => n.length === 1 ? `<h6>${n[0]}</h6>` : `<a href="#${n[0]}" class="${n[0] === view ? 'on' : ''}">${n[1]}${n[2] ? (x => x ? `<i>${x}</i>` : '')(n[2]()) : ''}</a>`).join('');
  $('#main').innerHTML = views[view]();
  $('#sync').innerHTML = 'Données locales<br><b>' + units().length + '</b> unité(s) suivie(s)';
  if (view === 'stats') drawChart();
  if (view === 'bord') bindDrop();
  const imp = $('#imp'); if (imp) imp.onchange = importBackup;
}

function drawChart() {
  const cv = $('#chart'); if (!cv) return; const g = cv.getContext('2d'); const W = cv.width, H = cv.height, P = 30;
  const ev = [];
  units().forEach(x => { if (x.u.dates.commande && idx(x.u.status) >= 2) ev.push([x.u.dates.commande, -cost(x.u, x.a), 0]); if (x.u.dates.paye && x.u.status === 'paye') ev.push([x.u.dates.paye, 0, sale(x.u, x.a)]); });
  ev.sort((a, b) => a[0] - b[0]);
  let sp = 0, en = 0; const pts = [[ev.length ? ev[0][0] - 1 : Date.now() - 1, 0, 0, 0]];
  ev.forEach(e => { sp += -e[1]; en += e[2]; pts.push([e[0], sp, en, en - sp]); });
  pts.push([Date.now(), sp, en, en - sp]);
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1;
  const all = pts.flatMap(p => [p[1], p[2], p[3]]); const mn = Math.min(0, ...all), mx = Math.max(1, ...all);
  const X = t => P + (t - t0) / ((t1 - t0) || 1) * (W - 2 * P), Y = v => H - P - (v - mn) / ((mx - mn) || 1) * (H - 2 * P);
  g.clearRect(0, 0, W, H); g.strokeStyle = '#243257'; g.beginPath(); g.moveTo(P, Y(0)); g.lineTo(W - P, Y(0)); g.stroke();
  [[1, '#f0b43c', 'Dépensé'], [2, '#5b8def', 'Encaissé'], [3, '#4ade80', 'Solde']].forEach(([k, col]) => {
    g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath();
    pts.forEach((p, i) => { if (i === 0) g.moveTo(X(p[0]), Y(p[k])); else { g.lineTo(X(p[0]), Y(pts[i - 1][k])); g.lineTo(X(p[0]), Y(p[k])); } });
    g.stroke(); });
  g.fillStyle = '#8b97b8'; g.font = '13px sans-serif'; g.fillText(fdate(t0), P, H - 8); g.fillText(fdate(t1), W - P - 70, H - 8);
  $('#legend').innerHTML = `<span style="color:#f0b43c">● Dépensé ${eur(sp)}</span><span style="color:#5b8def">● Encaissé ${eur(en)}</span><span style="color:#4ade80">● Solde ${eur(en - sp)}</span>`;
}

/* ================= Actions ================= */
const A = {
  adv: d => { const x = findUnit(d.id); const n = ST[idx(x.u.status) + 1]; if (n) setStatus(x.u, n[0]); },
  tab: d => { S.tab = d.id; },
  newArt: () => { const name = prompt('Nom de l\'article ?'); if (!name) return; const size = prompt('Taille ?', 'M') || ''; const a = { id: uid(), name, size, sheinPrice: '', sheinNow: '', vintedPrice: '', threshold: 1, sheinUrl: '', units: [newUnit()] }; S.articles.push(a); S.tab = a.id; },
  delArt: d => { if (confirm('Supprimer cet article et toutes ses annonces ?')) S.articles = S.articles.filter(a => a.id !== d.id); },
  addUnit: d => S.articles.find(a => a.id === d.id).units.push(newUnit()),
  delUnit: d => { if (!confirm('Supprimer cette annonce ?')) return; S.articles.forEach(a => a.units = a.units.filter(u => u.id !== d.id)); },
  goPub: d => { S.draft = { articleId: d.id }; location.hash = '#pub'; },
  mkOrder: () => {
    const ids = [...document.querySelectorAll('.sel:checked')].map(c => c.value); if (!ids.length) return toast('Coche au moins un article');
    const total = num($('#ordTotal').value); const o = { id: uid(), date: Date.now(), total };
    S.orders.push(o); ids.forEach(id => { const x = findUnit(id); x.u.orderId = o.id; x.u.cost = (total / ids.length).toFixed(2); setStatus(x.u, 'commande', true); });
    toast('Commande créée'); location.hash = '#shein';
  },
  recvOrder: d => units().filter(x => x.u.orderId === d.id && idx(x.u.status) < 3).forEach(x => setStatus(x.u, 'recu', true)),
  openF: async d => { const f = S.files.find(f => f.id === d.id); const blob = await idb('readonly', s => s.get(f.id)); if (!blob) return toast('Fichier introuvable'); const url = URL.createObjectURL(blob); const w = window.open(url); if (w) w.addEventListener('load', () => w.print()); },
  printed: d => { const f = S.files.find(f => f.id === d.id); f.printed = !f.printed; },
  delF: async d => { if (!confirm('Supprimer ce bordereau ?')) return; await idb('readwrite', s => s.delete(d.id)); S.files = S.files.filter(f => f.id !== d.id); save(); render(); },
  autoTxt: () => { S.draft.articleId = $('#dArt').value; delete S.draft.title; delete S.draft.desc; },
  cpTitle: () => { navigator.clipboard.writeText($('#dTitle').value); toast('Titre copié'); return true; },
  cpDesc: () => { navigator.clipboard.writeText($('#dDesc').value); toast('Description copiée'); return true; },
  published: () => { const id = $('#dArt').value; const a = S.articles.find(x => x.id === id); if (!a) return toast('Choisis un article'); a.units.push(newUnit()); toast('Ajouté au suivi'); },
  csv: () => {
    const rows = [['Article', 'Taille', 'Statut', 'Acheteur', 'Prix de vente', 'Coût', 'Marge', 'Date vente', 'Date payé']];
    units().forEach(({ u, a }) => rows.push([a.name, a.size, SL[u.status], u.buyer, sale(u, a).toFixed(2), cost(u, a).toFixed(2), (sale(u, a) - cost(u, a)).toFixed(2), fdate(u.dates.vendu), fdate(u.dates.paye)]));
    dl('ventes.csv', '\ufeff' + rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';')).join('\n'), 'text/csv');
    return true; },
  print: () => { window.print(); return true; },
  backup: () => { dl('sauvegarde-suivi-vinted.json', JSON.stringify(S), 'application/json'); return true; }
};
function setStatus(u, s, quiet) { u.status = s; u.dates[s] = Date.now(); if (!quiet) save(); }
function dl(name, content, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click(); }
function importBackup(e) { const f = e.target.files[0]; if (!f) return; f.text().then(t => { try { S = JSON.parse(t); save(); render(); toast('Sauvegarde importée'); } catch { toast('Fichier invalide'); } }); }

async function addFiles(list) {
  for (const f of list) { const id = uid(); await idb('readwrite', s => s.put(f, id)); S.files.push({ id, name: f.name, added: Date.now(), printed: false, unitId: '' }); }
  save(); render(); toast(list.length + ' bordereau(x) ajouté(s)');
}
function bindDrop() {
  const dz = $('#drop'), fi = $('#fin'); fi.onchange = () => addFiles([...fi.files]);
  ['dragover', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); if (ev === 'drop') addFiles([...e.dataTransfer.files]); }));
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const r = A[b.dataset.a](b.dataset, b);
  if (r === true) return;
  if (b.dataset.a === 'autoTxt') { S.draft.articleId = $('#dArt').value; }
  save(); render();
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'dArt') { S.draft = { articleId: t.value }; save(); return render(); }
  if (t.id === 'dTitle') { S.draft.title = t.value; return save(); }
  if (!t.dataset.f) return;
  const [k, id, field] = t.dataset.f.split('|'); const val = t.type === 'number' ? t.value : t.value;
  if (k === 'u') { const x = findUnit(id); if (field === 'status') setStatus(x.u, val, true); else x.u[field] = val; }
  if (k === 'a') S.articles.find(a => a.id === id)[field] = val;
  if (k === 'f') S.files.find(f => f.id === id)[field] = val;
  if (k === 's') S.settings[field] = val;
  save(); render();
});
document.addEventListener('input', e => { if (e.target.id === 'dDesc') { S.draft.desc = e.target.value; save(); } });
window.addEventListener('hashchange', render);
render();
})();
