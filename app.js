import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, push, onValue, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const ROS = window.ROS || [];
const $ = s => document.querySelector(s);
let cur = 0, role = 'Carlos', soundOn = false, lastSeen = Date.now(), lastMsgs = [];
let db = null, sala = null;

const store = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
};
role = store.get('mt-role') || 'Carlos';

/* ---------- interface ---------- */
function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function cueHTML(c, tag){
  if(!c) return `<span class="tag">${tag}</span><h2>Fim do roteiro</h2>`;
  return `<span class="tag">${tag} · ${esc(c.t)}</span><h2>${esc(c.n)}</h2>
  <div class="chips">${c.video?'<span class="chip video">▶ VÍDEO</span>':''}<span class="chip clip">Telão <b>${esc(c.clip)}</b></span>${c.audio?`<span class="chip audio">Áudio <b>${esc(c.audio)}</b></span>`:''}${c.tbc?'<span class="chip tbc">ordem a confirmar</span>':''}</div>
  ${c.d?`<p>${esc(c.d)}</p>`:''}
  ${c.narr && tag==='Agora'?`<div class="play"><button class="btn audio" data-play="${c.narr}">▶ Tocar aviso + narração</button><div class="bar"><i id="bar"></i></div></div>`:''}`;
}
function render(){
  $('#cueNow').innerHTML = cueHTML(ROS[cur], 'Agora');
  $('#cueNext').innerHTML = cueHTML(ROS[cur+1], 'Próximo');
  $('#ros').innerHTML = ROS.map((c,i)=>`<li data-i="${i}" class="${i<cur?'done':''} ${i===cur?'cur':''} ${c.video?'vid':''}"><time>${esc(c.t)}</time><div><div class="t">${esc(c.n)}</div><div class="chips">${c.video?'<span class="chip video">▶ VÍDEO</span>':''}<span class="chip clip"><b>${esc(c.clip)}</b></span>${c.audio?`<span class="chip audio"><b>${esc(c.audio)}</b></span>`:''}${c.tbc?'<span class="chip tbc">a confirmar</span>':''}</div>${c.d?`<div class="d">${esc(c.d)}</div>`:''}</div></li>`).join('');
  const li = document.querySelector('ol.ros li.cur'); if(li) li.scrollIntoView({block:'nearest'});
  document.querySelectorAll('.roles button').forEach(b => b.setAttribute('aria-pressed', String(b.id === 'r-'+role.toLowerCase())));
  $('#who').textContent = 'você é ' + role;
}
function status(text, state){ $('#sync').textContent = text; $('#dot').className = 'dot ' + (state||''); }

function setCur(i){
  cur = Math.max(0, Math.min(ROS.length-1, i)); render();
  if(db) set(ref(db, `mesa/${sala}/now`), {idx:cur, by:role, at:Date.now()}).catch(()=>status('Não consegui gravar a deixa. Confira o código.', 'off'));
}
$('#prev').onclick = () => setCur(cur-1);
$('#next').onclick = () => setCur(cur+1);
$('#ros').onclick = e => { const li = e.target.closest('li'); if(li) setCur(+li.dataset.i); };
document.querySelectorAll('.roles button').forEach(b => b.onclick = () => {
  role = b.id === 'r-carlos' ? 'Carlos' : 'Felipe'; store.set('mt-role', role); render(); renderMsgs(lastMsgs);
});

/* ---------- relógio, som e avisos ---------- */
function tick(){ $('#clock').textContent = new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date()); }
setInterval(tick, 1000); tick();
let actx = null;
$('#soundBtn').onclick = () => { try { actx = actx || new (window.AudioContext||window.webkitAudioContext)(); soundOn = true; $('#soundBtn').textContent = 'Som dos avisos ligado'; beep(); } catch(e){} };
function beep(){ if(!soundOn||!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.frequency.value=880; g.gain.setValueAtTime(.0001,actx.currentTime); g.gain.exponentialRampToValueAtTime(.3,actx.currentTime+.02); g.gain.exponentialRampToValueAtTime(.0001,actx.currentTime+.5); o.connect(g).connect(actx.destination); o.start(); o.stop(actx.currentTime+.55); }
let tT = null, blink = null;
function toast(text){
  const t = $('#toast'); t.textContent = text; t.hidden = false; clearTimeout(tT); tT = setTimeout(()=>t.hidden=true, 6000); beep();
  let n = 0; clearInterval(blink); const base = 'Summit Mesa Técnica';
  blink = setInterval(()=>{ document.title = (n++%2) ? base : '● '+text; if(n>12){ clearInterval(blink); document.title = base; } }, 800);
}


/* ---------- áudios do palco (tocam só neste computador) ---------- */
const FILES = {
  aviso: 'audio/aviso.mp3',
  '04': 'audio/narracao-04-retorno-coffee.mp3'
};
const NOMES = { aviso:'Aviso sonoro', '04':'Narração da Laís' };
const players = {};
for (const k in FILES) { const el = new Audio(FILES[k]); el.preload = 'auto'; players[k] = el; }
let seqId = 0, playing = null;
function stopAudio(){
  seqId++;
  if (playing) { playing.pause(); playing.currentTime = 0; playing = null; }
  $('#nowplaying').textContent = '';
  const b = document.getElementById('bar'); if (b) b.style.width = '0';
  document.querySelectorAll('[data-play]').forEach(x => x.setAttribute('aria-pressed','false'));
}
function playOne(key, id){
  return new Promise(res => {
    if (id !== seqId) return res(false);
    const el = players[key]; playing = el; el.currentTime = 0;
    $('#nowplaying').textContent = '▶ ' + NOMES[key];
    el.ontimeupdate = () => { const b = document.getElementById('bar'); if (b && el.duration) b.style.width = (100 * el.currentTime / el.duration) + '%'; };
    el.onended = () => res(true);
    el.onerror = () => { $('#nowplaying').textContent = 'Não consegui tocar ' + NOMES[key]; res(false); };
    el.play().catch(() => { $('#nowplaying').textContent = 'O navegador bloqueou o áudio. Clique de novo.'; res(false); });
  });
}
async function playSeq(key, btn){
  stopAudio(); const id = seqId;
  if (btn) btn.setAttribute('aria-pressed','true');
  const list = key === 'aviso' ? ['aviso'] : ['aviso', key];
  if (db && key !== 'aviso') push(ref(db, `mesa/${sala}/chat`), {text:'Narração no ar: ' + NOMES[key], kind:'alert', role, at:Date.now()}).catch(()=>{});
  for (let i = 0; i < list.length; i++) {
    const ok = await playOne(list[i], id);
    if (!ok || id !== seqId) return;
    const b = document.getElementById('bar'); if (b && i < list.length - 1) b.style.width = '0';
  }
  if (id === seqId) { $('#nowplaying').textContent = 'Fim: ' + NOMES[key]; playing = null; if (btn) btn.setAttribute('aria-pressed','false'); }
}
document.addEventListener('click', e => {
  const p = e.target.closest('[data-play]'); if (p) { playSeq(p.dataset.play, p); return; }
  if (e.target.closest('[data-stop]')) stopAudio();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') stopAudio(); });


/* ---------- datashow (tela.html) ---------- */
const TELA = window.TELA || [];
let telaAtual = 'nenhum';
function renderTela(){
  $('#telaBoard').innerHTML = TELA.map((o,i)=>`<button data-tela="${o.id}" aria-pressed="${o.id===telaAtual}">${i} · ${esc(o.nome)}</button>`).join('');
  const o = TELA.find(x => x.id === telaAtual); $('#telaNow').textContent = 'No ar: ' + (o ? o.nome : telaAtual);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-tela]'); if (!b) return;
  if (!db) { status('Modo local: o datashow só recebe comando com o código de acesso', 'off'); return; }
  set(ref(db, `mesa/${sala}/tela`), {ov:b.dataset.tela, by:role, at:Date.now()}).catch(()=>status('O banco recusou o comando do datashow. Confira as regras do Firebase.', 'off'));
});
renderTela();

/* ---------- rádio ---------- */
function hhmm(ms){ return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(ms)); }
function renderMsgs(list){
  const box = $('#msgs');
  if(!list.length){ box.innerHTML = '<p class="empty">As mensagens entre vocês dois aparecem aqui. Use os avisos rápidos abaixo ou escreva.</p>'; return; }
  box.innerHTML = list.map(m=>`<div class="msg ${m.role===role?'me':''} ${m.kind==='alert'?'alert':''}"><div class="who"><span>${esc(m.role)}</span><span>${hhmm(m.at||0)}</span></div>${esc(m.text)}</div>`).join('');
  box.scrollTop = box.scrollHeight;
}
function send(text, kind){
  text = String(text||'').trim().slice(0,500); if(!text) return;
  if(!db){ status('Modo local: o rádio só funciona com o código de acesso', 'off'); return; }
  push(ref(db, `mesa/${sala}/chat`), {text, kind:kind||'msg', role, at:Date.now()}).catch(()=>status('Não consegui enviar. Confira o código.', 'off'));
}
$('#send').addEventListener('submit', e => { e.preventDefault(); const i = $('#txt'); send(i.value,'msg'); i.value = ''; });
$('#quick').onclick = e => { const b = e.target.closest('button[data-q]'); if(b) send(b.dataset.q, 'alert'); };

/* ---------- conexão ---------- */
function connect(code){
  sala = code; store.set('mt-sala', code);
  if(location.hash.slice(1) !== code) history.replaceState(null, '', '#'+code);
  const cfg = window.FIREBASE_CONFIG || {};
  if(!cfg.databaseURL || cfg.databaseURL.includes('COLE_AQUI')){ status('Firebase ainda não configurado (config.js)', 'off'); return; }
  try {
    db = getDatabase(initializeApp(cfg));
  } catch(e){ status('Erro ao iniciar o Firebase', 'off'); return; }
  onValue(ref(db, '.info/connected'), s => s.val() ? status('Sincronizado com o outro operador', 'on') : status('Sem conexão. Continua funcionando e sincroniza quando voltar.', 'off'));
  onValue(ref(db, `mesa/${sala}/now`), s => {
    const d = s.val();
    if(d && typeof d.idx === 'number' && d.idx !== cur){ cur = Math.min(d.idx, ROS.length-1); render(); if(d.by && d.by !== role) toast(d.by + ' avançou: ' + ROS[cur].n); }
  }, () => status('Código de acesso inválido', 'off'));
  onValue(query(ref(db, `mesa/${sala}/chat`), limitToLast(300)), s => {
    const list = []; s.forEach(c => { list.push(c.val()); });
    list.filter(m => m.at > lastSeen && m.role !== role).forEach(m => toast(m.role + ': ' + m.text));
    lastSeen = Math.max(lastSeen, ...list.map(m => m.at||0));
    lastMsgs = list; renderMsgs(list);
  }, () => status('Rádio sem permissão. Confira o código.', 'off'));
  onValue(ref(db, `mesa/${sala}/tela`), s => { const d = s.val(); telaAtual = (d && d.ov) || 'nenhum'; renderTela(); }, () => {});
  $('#telaLink').href = 'tela.html#' + sala;
}

render(); renderMsgs([]);
const fromHash = decodeURIComponent(location.hash.slice(1)).trim();
const saved = store.get('mt-sala');
if(fromHash.length >= 16) connect(fromHash);
else if(saved && saved.length >= 16) connect(saved);
else {
  $('#gate').hidden = false; status('Modo local, sem sincronizar');
  $('#gateForm').onsubmit = e => { e.preventDefault(); const c = $('#gateCode').value.trim(); if(c.length < 16){ $('#gateCode').value=''; $('#gateCode').placeholder='código incompleto'; return; } $('#gate').hidden = true; if(!db) connect(c); };
  $('#gateLocal').onclick = () => { $('#gate').hidden = true; };
}
