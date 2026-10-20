import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const clone = x => JSON.parse(JSON.stringify(x));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
};

let ROS = clone(window.ROS || []);
let cur = 0, role = store.get('mt-role') || 'Carlos', filtro = 'all', aberto = -1;
let db = null, sala = null, ultimoScroll = -1, primeiraDeixa = true;

/* ---------- tema ---------- */
const temaSalvo = store.get('mt-tema'); if (temaSalvo) document.documentElement.dataset.theme = temaSalvo;
$('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = t; store.set('mt-tema', t); };

/* ---------- tempo ---------- */
const fmtSP = (o) => new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo', ...o});
function minutosAgora(){ const [h,m] = fmtSP({hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':').map(Number); return h*60+m; }
function minutos(t){ const m = /^(\d{1,2}):(\d{2})$/.exec(String(t||'').trim()); return m ? (+m[1])*60 + (+m[2]) : null; }
function tick(){ $('#clock').textContent = fmtSP({hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()); tempoRel(); }
setInterval(tick, 1000);

/* ---------- tipo de cada deixa ---------- */
const ehVideo = c => !!(c && c.video);
const ehAudio = c => !!(c && c.narr);
const ehTroca = c => !!(c && c.troca);
function pills(c){
  return `${ehVideo(c)?'<span class="pill video">▶ Vídeo</span>':''}${ehAudio(c)?'<span class="pill audio">Contagem + áudio</span>':''}${ehTroca(c)?'<span class="pill troca">Troca de palco</span>':''}${c.tbc?'<span class="pill tbc">a confirmar</span>':''}`;
}

/* ---------- render ---------- */
function cardAgora(c){
  if (!c) return `<div class="cue-top"><span class="cue-label">Agora</span></div><h2>Roteiro vazio</h2>`;
  return `<div class="cue-top"><span class="cue-label">Agora</span><span class="cue-time">${esc(c.t)}</span>${pills(c)}</div>
    <h2>${esc(c.n)}</h2>
    <dl class="facts"><dt>Telão</dt><dd>${esc(c.clip||'')}</dd>${c.palco?`<dt>Palco</dt><dd>${esc(c.palco)}</dd>`:''}${c.mov?`<dt>Entra / sai</dt><dd>${esc(c.mov)}</dd>`:''}${c.audio?`<dt>Áudio</dt><dd>${esc(c.audio)}</dd>`:''}</dl>
    ${c.d?`<p class="desc">${esc(c.d)}</p>`:''}
    ${ehAudio(c)?`<div class="play-row"><button class="play-btn" data-play="${esc(c.narr)}" id="playMain">▶ Tocar aviso + narração</button><div class="bar"><i id="bar"></i></div></div>`:''}`;
}
function cardProximo(c){
  if (!c) return `<div class="cue-top"><span class="cue-label">Próximo</span></div><h2>Fim do roteiro</h2><p class="desc">Depois desta deixa não há mais nada programado.</p>`;
  return `<div class="cue-top"><span class="cue-label">Próximo</span><span class="cue-time">${esc(c.t)}</span><span class="when" id="when" hidden></span></div>
    <h2>${esc(c.n)}</h2>
    <dl class="facts"><dt>Telão</dt><dd>${esc(c.clip||'')}</dd>${c.palco?`<dt>Palco</dt><dd>${esc(c.palco)}</dd>`:''}${c.mov?`<dt>Entra / sai</dt><dd>${esc(c.mov)}</dd>`:''}</dl>
    ${c.d?`<p class="desc">${esc(c.d)}</p>`:''}
    ${ehTroca(c)?`<div class="prep" style="color:var(--green-2)">● Staff: ${esc(c.mov||'troca de palco')}</div>`:ehVideo(c)?'<div class="prep">● Deixe o vídeo pronto no Resolume</div>':ehAudio(c)?'<div class="prep" style="color:var(--amber)">● Contagem com aviso e narração da Laís</div>':''}`;
}
function render(){
  cur = Math.max(0, Math.min(cur, ROS.length - 1));
  const c = ROS[cur];
  $('#cueNow').innerHTML = cardAgora(c);
  $('#cueNow').classList.toggle('is-video', ehVideo(c));
  $('#cueNext').innerHTML = cardProximo(ROS[cur+1]);
  $('#progText').textContent = ROS.length ? `Deixa ${cur+1} de ${ROS.length}` : 'Sem deixas';
  $('#progFill').style.width = ROS.length > 1 ? (100 * cur / (ROS.length - 1)) + '%' : '0';
  $('#prev').disabled = cur <= 0; $('#next').disabled = cur >= ROS.length - 1;

  let html = '', bloco = '';
  ROS.forEach((r,i) => {
    const m = minutos(r.t), b = m === null ? '' : m < 12*60+30 ? 'Manhã' : m < 18*60 ? 'Tarde' : 'Noite';
    if (b && b !== bloco) { bloco = b; html += `<li class="block-title" aria-hidden="true">${b}</li>`; }
    const cls = ['row', i<cur?'done':'', i===cur?'cur':'', i===aberto?'open':'', ehVideo(r)?'video':'', ehAudio(r)?'audio':'', ehTroca(r)?'troca':''].join(' ');
    html += `<li class="${cls}" data-i="${i}"><time>${esc(r.t)}</time><span class="rail"><b></b></span>
      <div class="body"><span class="t">${esc(r.n)}</span><span class="meta">${pills(r)}<span class="clip">${esc(r.clip||'')}</span>${r.palco?`<span class="clip">· ${esc(r.palco)}</span>`:''}</span>
      ${r.mov?`<span class="mov">${esc(r.mov)}</span>`:''}
      ${r.d?`<span class="d">${esc(r.d)}</span>`:''}
      <button class="btn small ghost go" data-goto="${i}">Marcar como agora</button></div></li>`;
  });
  $('#ros').innerHTML = html;
  aplicaFiltro();
  if (cur !== ultimoScroll) { ultimoScroll = cur; const box = $('#ros'), li = $('#ros .row.cur');
    // rola só a lista do roteiro (nunca a página), deixando a deixa atual no terço de cima
    if (li && filtro === 'all' && box.scrollHeight > box.clientHeight + 4) box.scrollTo({top: Math.max(0, li.offsetTop - box.clientHeight * 0.28), behavior: 'smooth'}); }
  $$('.seg [id^="r-"]').forEach(b => b.setAttribute('aria-pressed', String(b.id === 'r-' + role.toLowerCase())));
  tempoRel();
}
function aplicaFiltro(){
  $$('#ros .row').forEach(li => { const r = ROS[+li.dataset.i]; li.classList.toggle('hide', filtro === 'video' ? !ehVideo(r) : filtro === 'audio' ? !ehAudio(r) : filtro === 'palco' ? !ehTroca(r) : false); });
  $$('#ros .block-title').forEach(b => b.hidden = filtro !== 'all');
}
// "em 5 min" no próximo e atraso em relação ao horário previsto
function tempoRel(){
  const agora = minutosAgora(), prox = ROS[cur+1], mp = prox ? minutos(prox.t) : null, w = $('#when'), dr = $('#drift');
  if (w) {
    if (mp !== null && mp - agora >= 0 && mp - agora <= 180) { const d = mp - agora; w.hidden = false; w.textContent = d === 0 ? 'agora' : `em ${d} min`; w.classList.toggle('soon', d <= 5); }
    else w.hidden = true;
  }
  if (mp !== null && agora - mp > 0 && agora - mp <= 180) { dr.hidden = false; dr.className = 'badge late'; dr.textContent = `${agora - mp} min de atraso`; }
  else if (mp !== null && mp - agora >= 0 && mp - agora <= 180) { dr.hidden = false; dr.className = 'badge ok'; dr.textContent = 'no horário'; }
  else dr.hidden = true;
}

/* ---------- navegação ---------- */
function setCur(i){
  cur = Math.max(0, Math.min(ROS.length - 1, i)); aberto = -1; render();
  if (db) set(ref(db, `mesa/${sala}/now`), {idx:cur, by:role, at:Date.now()}).catch(() => status('Não consegui gravar a deixa. Confira o código.', 'off'));
}
$('#prev').onclick = () => setCur(cur - 1);
$('#next').onclick = () => setCur(cur + 1);
$('#ros').addEventListener('click', e => {
  const g = e.target.closest('[data-goto]'); if (g) { setCur(+g.dataset.goto); return; }
  const li = e.target.closest('.row'); if (!li) return;
  const i = +li.dataset.i; aberto = aberto === i ? -1 : i; render();
});
$$('.filters button').forEach(b => b.onclick = () => { filtro = b.dataset.filter; $$('.filters button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); aplicaFiltro(); });
$$('.seg [id^="r-"]').forEach(b => b.onclick = () => { role = b.id === 'r-carlos' ? 'Carlos' : 'Felipe'; store.set('mt-role', role); render(); });
document.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (['ArrowRight','PageDown',' '].includes(e.key)) { e.preventDefault(); setCur(cur + 1); }
  else if (['ArrowLeft','PageUp'].includes(e.key)) { e.preventDefault(); setCur(cur - 1); }
  else if (e.key === 'Escape') { if (gavetaAberta()) fechaGaveta(); else pararAudio(); }
});
// botão clicado com o mouse não fica com foco, para o espaço do teclado não disparar de novo
document.addEventListener('pointerup', e => { const b = e.target.closest('button'); if (b) setTimeout(() => b.blur(), 0); });
function status(t, s){ $('#sync').textContent = t; $('#dot').className = 'dot ' + (s||''); }

/* ---------- aviso visual e bipe quando o outro avança ---------- */
let actx = null;
document.addEventListener('pointerdown', () => { try { actx = actx || new (window.AudioContext||window.webkitAudioContext)(); actx.resume(); } catch(e){} }, {once:false});
function beep(){ if (!actx || actx.state !== 'running') return; const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.0001, actx.currentTime); g.gain.exponentialRampToValueAtTime(.25, actx.currentTime + .02); g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + .45); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime + .5); }
let tT = null;
function toast(text){ const t = $('#toast'); t.textContent = text; t.hidden = false; clearTimeout(tT); tT = setTimeout(() => t.hidden = true, 5000); beep(); }

/* ---------- áudios do palco (tocam só neste computador) ---------- */
const FILES = { aviso:'audio/aviso.mp3', '04':'audio/narracao-04-retorno-coffee.mp3' };
const NOMES = { aviso:'Aviso sonoro', '04':'Narração da Laís' };
const players = {};
for (const k in FILES) { const el = new Audio(FILES[k]); el.preload = 'auto'; players[k] = el; }
let seqId = 0, tocando = null;
function barras(p){ ['#bar','#bar2'].forEach(s => { const b = $(s); if (b) b.style.width = p + '%'; }); }
function marcaTocando(key){
  $$('[data-play]').forEach(x => { const on = key && x.dataset.play === key; x.setAttribute('aria-pressed', String(!!on)); x.classList.toggle('playing', !!on); });
  const pm = $('#playMain'); if (pm) pm.textContent = key ? '■ Parar áudio' : '▶ Tocar aviso + narração';
  $('#player').hidden = !key;
}
function pararAudio(){ seqId++; if (tocando) { tocando.pause(); tocando.currentTime = 0; tocando = null; } barras(0); marcaTocando(null); }
function tocaUm(key, id){
  return new Promise(res => {
    if (id !== seqId) return res(false);
    const el = players[key]; tocando = el; el.currentTime = 0;
    $('#nowplaying').textContent = '▶ ' + NOMES[key];
    el.ontimeupdate = () => { if (el.duration) barras(100 * el.currentTime / el.duration); };
    el.onended = () => res(true);
    el.onerror = () => { toast('Não consegui tocar ' + NOMES[key]); res(false); };
    el.play().catch(() => { toast('O navegador bloqueou o áudio. Clique de novo.'); res(false); });
  });
}
async function tocar(key){
  pararAudio(); const id = seqId; marcaTocando(key);
  for (const k of key === 'aviso' ? ['aviso'] : ['aviso', key]) { barras(0); if (!(await tocaUm(k, id)) || id !== seqId) return; }
  if (id === seqId) { tocando = null; barras(0); marcaTocando(null); }
}
document.addEventListener('click', e => {
  const p = e.target.closest('[data-play]');
  if (p) { if (p.classList.contains('playing')) pararAudio(); else tocar(p.dataset.play); return; }
  if (e.target.closest('[data-stop]')) pararAudio();
});

/* ---------- gaveta de ensaio ---------- */
const gavetaAberta = () => $('#drawer').classList.contains('open');
function abreGaveta(){ $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden','false'); $('#scrim').hidden = false; $('#ensaioBtn').setAttribute('aria-expanded','true'); }
function fechaGaveta(){ $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden','true'); $('#scrim').hidden = true; $('#ensaioBtn').setAttribute('aria-expanded','false'); }
$('#ensaioBtn').onclick = () => gavetaAberta() ? fechaGaveta() : abreGaveta();
$('#drawerClose').onclick = fechaGaveta; $('#scrim').onclick = fechaGaveta;
function abaAtiva(id){ $$('.tabs [role="tab"]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === id))); $$('.tab').forEach(p => p.hidden = p.id !== id); store.set('mt-aba', id); }
$$('.tabs [role="tab"]').forEach(t => t.onclick = () => abaAtiva(t.dataset.tab));
abaAtiva(store.get('mt-aba') || 'tDatashow');

/* ---------- datashow ---------- */
const TELA = window.TELA || [];
let telaSt = { ov:'rot', rot:[], seg:0 };
const tNome = id => (TELA.find(o => o.id === id) || {nome:id}).nome;
function renderTela(){
  $('#telaMix').innerHTML = TELA.filter(o => o.src).map(o => { const on = telaSt.rot.includes(o.id); return `<button data-mix="${o.id}" aria-pressed="${on}">${on?'✓ ':'+ '}${esc(o.nome)}</button>`; }).join('');
  $('#telaDir').innerHTML = TELA.map((o,i) => `<button data-dir="${o.id}" class="${telaSt.ov === o.id ? 'live' : ''}">${i && i < 10 ? `<kbd>${i}</kbd>` : ''}${esc(o.nome)}</button>`).join('');
  $('#telaSeg').value = String(telaSt.seg);
  $('#telaVolta').hidden = telaSt.ov === 'rot';
  $('#telaNow').textContent = telaSt.ov !== 'rot' ? 'No ar, direto: ' + tNome(telaSt.ov)
    : telaSt.rot.length ? 'No ar, mix: ' + telaSt.rot.map(tNome).join(' · ') : 'No ar: só o fundo';
}
function enviaTela(p){
  const st = { ...telaSt, ...p };
  if (!db) { toast('Sem código de acesso: o datashow não recebe comandos'); return; }
  set(ref(db, `mesa/${sala}/tela`), { ov: st.ov, rot: st.rot.join(','), seg: st.seg, by: role, at: Date.now() })
    .catch(() => toast('O banco recusou o comando do datashow'));
}
document.addEventListener('click', e => {
  const m = e.target.closest('[data-mix]');
  if (m) { const id = m.dataset.mix; const rot = telaSt.rot.includes(id) ? telaSt.rot.filter(x => x !== id) : TELA.filter(o => o.id === id || telaSt.rot.includes(o.id)).map(o => o.id); enviaTela({ rot }); return; }
  const d = e.target.closest('[data-dir]'); if (d) { enviaTela({ ov: d.dataset.dir }); return; }
  if (e.target.closest('#telaVolta')) enviaTela({ ov: 'rot' });
});
$('#telaSeg').onchange = e => enviaTela({ seg: Number(e.target.value) });

/* ---------- editor do roteiro ---------- */
const ORIGINAL = clone(window.ROS || []);
const LAIS = 'Aviso + narração da Laís';
let rascunho = clone(ROS), sujo = false, arrastando = null;
function marcaSujo(v){ sujo = v; const s = $('#edStatus'); s.textContent = v ? 'Alterações não salvas' : 'Igual ao roteiro em uso'; s.className = 'edstatus' + (v ? ' warn' : ''); }
function renderEditor(){
  $('#edList').innerHTML = rascunho.map((c,k) => `<li draggable="true" data-k="${k}">
    <span class="grip" title="Arraste para mudar a ordem">⋮⋮</span>
    <input class="t" data-f="t" value="${esc(c.t)}" aria-label="Horário" maxlength="5">
    <input data-f="n" value="${esc(c.n)}" aria-label="Nome da deixa">
    <span class="mv"><button data-mv="-1" title="Subir">↑</button><button data-mv="1" title="Descer">↓</button><button data-rm title="Apagar">✕</button></span>
    <div class="row2"><input data-f="clip" value="${esc(c.clip||'')}" aria-label="Telão" placeholder="telão">
      <label class="ck"><input type="checkbox" data-f="video" ${c.video?'checked':''}> vídeo</label>
      <label class="ck"><input type="checkbox" data-f="narr" ${c.narr?'checked':''}> áudio Laís</label></div>
    <div class="row2b"><input data-f="palco" value="${esc(c.palco||'')}" aria-label="Palco" placeholder="palco (ex.: Púlpito + 4 cadeiras)"><input data-f="mov" value="${esc(c.mov||'')}" aria-label="Entra e sai" placeholder="entra / sai"><label class="ck"><input type="checkbox" data-f="troca" ${c.troca?'checked':''}> troca</label></div>
    <div class="row3"><input data-f="d" value="${esc(c.d||'')}" aria-label="Observação" placeholder="observação"></div>
  </li>`).join('');
}
$('#edList').addEventListener('input', e => {
  const li = e.target.closest('li'); if (!li) return; const c = rascunho[+li.dataset.k], f = e.target.dataset.f;
  if (f === 'video' || f === 'troca') { if (e.target.checked) c[f] = true; else delete c[f]; }
  else if (f === 'narr') { if (e.target.checked) { c.narr = '04'; c.audio = LAIS; } else { delete c.narr; if (c.audio === LAIS) delete c.audio; } }
  else c[f] = e.target.value;
  marcaSujo(true);
});
$('#edList').addEventListener('click', e => {
  const li = e.target.closest('li'); if (!li) return; const k = +li.dataset.k;
  const mv = e.target.closest('[data-mv]');
  if (mv) { const j = k + Number(mv.dataset.mv); if (j < 0 || j >= rascunho.length) return; [rascunho[k], rascunho[j]] = [rascunho[j], rascunho[k]]; renderEditor(); marcaSujo(true); return; }
  const rm = e.target.closest('[data-rm]');
  if (rm) { if (!rm.dataset.ok) { rm.dataset.ok = 1; rm.textContent = 'apagar?'; setTimeout(() => { if (rm.isConnected) { delete rm.dataset.ok; rm.textContent = '✕'; } }, 2500); return; } rascunho.splice(k,1); renderEditor(); marcaSujo(true); }
});
$('#edList').addEventListener('dragstart', e => { const li = e.target.closest('li'); if (li) { arrastando = +li.dataset.k; li.classList.add('drag'); } });
$('#edList').addEventListener('dragend', () => $$('#edList li').forEach(l => l.classList.remove('drag','over')));
$('#edList').addEventListener('dragover', e => { const li = e.target.closest('li'); if (!li || arrastando === null) return; e.preventDefault(); $$('#edList li').forEach(l => l.classList.toggle('over', l === li)); });
$('#edList').addEventListener('drop', e => { const li = e.target.closest('li'); if (!li || arrastando === null) return; e.preventDefault(); const [it] = rascunho.splice(arrastando,1); rascunho.splice(+li.dataset.k,0,it); arrastando = null; renderEditor(); marcaSujo(true); });
$('#edAdd').onclick = () => { rascunho.splice(Math.min(cur+1, rascunho.length), 0, {t:(ROS[cur]||{}).t||'00:00', n:'Nova deixa', clip:'01 Summit loop', d:''}); renderEditor(); marcaSujo(true); };
$('#edSort').onclick = () => { rascunho = rascunho.map((c,i) => [c,i]).sort((x,y) => (minutos(x[0].t) ?? 9999) - (minutos(y[0].t) ?? 9999) || x[1]-y[1]).map(x => x[0]); renderEditor(); marcaSujo(true); };
$('#edUndo').onclick = () => { rascunho = clone(ROS); renderEditor(); marcaSujo(false); };
$('#edOrig').onclick = () => { rascunho = clone(ORIGINAL); renderEditor(); marcaSujo(true); };
$('#edSave').onclick = () => {
  const lista = rascunho.filter(c => (c.n||'').trim()).map(c => ({...c, t:(c.t||'').trim(), n:c.n.trim()}));
  const atual = ROS[cur]; ROS = lista;
  const j = atual ? ROS.findIndex(c => c.n === atual.n && c.t === atual.t) : -1;
  rascunho = clone(ROS); marcaSujo(false); renderEditor();
  if (j >= 0) cur = j; render();
  if (db) set(ref(db, `mesa/${sala}/ros`), {lista: JSON.stringify(lista), by: role, at: Date.now()})
    .then(() => { if (j >= 0) setCur(j); toast('Roteiro salvo para os dois'); })
    .catch(() => toast('O banco recusou o roteiro'));
  else toast('Sem código de acesso: o roteiro mudou só neste computador');
};
function recebeRoteiro(lista, by){
  ROS = lista; render();
  if (!sujo) { rascunho = clone(ROS); renderEditor(); marcaSujo(false); }
  else { const s = $('#edStatus'); s.textContent = (by || 'O outro operador') + ' salvou outro roteiro. Use "Descartar" para ver.'; s.className = 'edstatus warn'; }
}

/* ---------- conexão ---------- */
function connect(code){
  sala = code; store.set('mt-sala', code);
  if (location.hash.slice(1) !== code) history.replaceState(null, '', '#' + code);
  $('#telaLink').href = 'tela.html#' + code;
  const cfg = window.FIREBASE_CONFIG || {};
  if (!cfg.databaseURL) { status('Firebase não configurado', 'off'); return; }
  try { db = getDatabase(initializeApp(cfg)); } catch(e) { status('Erro ao iniciar a sincronização', 'off'); return; }
  onValue(ref(db, '.info/connected'), s => s.val() ? status('Sincronizado', 'on') : status('Sem conexão, segue funcionando', 'off'));
  onValue(ref(db, `mesa/${sala}/ros`), s => { const d = s.val(); if (d && d.lista) { try { recebeRoteiro(JSON.parse(d.lista), d.by); } catch(e){} } }, () => {});
  onValue(ref(db, `mesa/${sala}/now`), s => {
    const d = s.val();
    if (d && typeof d.idx === 'number' && d.idx !== cur) { cur = Math.min(d.idx, ROS.length - 1); aberto = -1; render(); if (primeiraDeixa === false && d.by && d.by !== role && ROS[cur]) toast(`${d.by} avançou: ${ROS[cur].n}`); }
    primeiraDeixa = false;
  }, () => status('Código de acesso inválido', 'off'));
  onValue(ref(db, `mesa/${sala}/tela`), s => { const d = s.val() || {}; telaSt = { ov: d.ov || 'rot', rot: String(d.rot || '').split(',').filter(Boolean), seg: Number(d.seg) || 0 }; renderTela(); }, () => {});
}

render(); renderTela(); renderEditor(); marcaSujo(false); tick();
const doLink = decodeURIComponent(location.hash.slice(1)).trim(), salvo = store.get('mt-sala');
if (doLink.length >= 16) connect(doLink);
else if (salvo && salvo.length >= 16) connect(salvo);
else {
  $('#gate').hidden = false; status('Sem sincronizar');
  $('#gateForm').onsubmit = e => { e.preventDefault(); const c = $('#gateCode').value.trim(); if (c.length < 16) { $('#gateCode').value = ''; $('#gateCode').placeholder = 'código incompleto'; return; } $('#gate').hidden = true; if (!db) connect(c); };
  $('#gateLocal').onclick = () => { $('#gate').hidden = true; };
}
