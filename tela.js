import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const LISTA = window.TELA || [];
const $ = s => document.querySelector(s);
const stage = $('#stage');
const vids = {};
let atual = 'nenhum', ultimoAt = 0;

// um vídeo pronto para cada sobreposição, para trocar sem atraso
for (const o of LISTA) {
  if (!o.src) continue;
  const v = document.createElement('video');
  v.src = o.src; v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.loop = o.loop !== false; v.className = 'ov';
  stage.appendChild(v); vids[o.id] = v;
}
const nome = id => (LISTA.find(o => o.id === id) || {nome:id}).nome;

function mostrar(id){
  if (!LISTA.some(o => o.id === id)) return;
  const novo = vids[id], velho = vids[atual];
  if (novo) { novo.currentTime = 0; novo.play().catch(()=>{}); novo.classList.add('on'); }
  if (velho && velho !== novo) { velho.classList.remove('on'); setTimeout(() => { if (!velho.classList.contains('on')) velho.pause(); }, 700); }
  atual = id;
  $('#hudNow').textContent = 'Sobreposição: ' + nome(id);
}

// aviso na tela, some sozinho
let hudT = null;
function hud(){ $('#hud').classList.remove('off'); document.body.classList.add('showcursor'); clearTimeout(hudT); hudT = setTimeout(() => { $('#hud').classList.add('off'); document.body.classList.remove('showcursor'); }, 4000); }
hud();
document.addEventListener('mousemove', hud);

// teclado no próprio computador do datashow
document.addEventListener('keydown', e => {
  const n = parseInt(e.key, 10);
  if (!isNaN(n) && LISTA[n]) { mostrar(LISTA[n].id); hud(); }
  else if (e.key === 'p' || e.key === 'P') document.body.classList.toggle('fill');
  else if (e.key === 'h' || e.key === 'H') hud();
  else if (e.key === 'f' || e.key === 'F') tela();
});
function tela(){ if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); }
document.addEventListener('click', tela);

// fundo nunca para
$('#fundo').addEventListener('pause', () => $('#fundo').play().catch(()=>{}));

// comando remoto pela mesa técnica
const sala = decodeURIComponent(location.hash.slice(1)).trim();
const cfg = window.FIREBASE_CONFIG || {};
if (sala.length < 16) { $('#hudStatus').textContent = 'Sem código no link: só o teclado funciona'; }
else {
  try {
    const db = getDatabase(initializeApp(cfg));
    onValue(ref(db, '.info/connected'), s => { $('#hudStatus').textContent = s.val() ? 'Recebendo comandos da mesa técnica' : 'Sem conexão. A tela continua rodando.'; });
    onValue(ref(db, `mesa/${sala}/tela`), s => {
      const d = s.val(); if (!d || !d.ov) return;
      if (d.ov !== atual || d.at !== ultimoAt) { ultimoAt = d.at; mostrar(d.ov); }
    }, () => { $('#hudStatus').textContent = 'Sem permissão no banco. Confira as regras do Firebase.'; });
  } catch (e) { $('#hudStatus').textContent = 'Erro ao conectar. Só o teclado funciona.'; }
}
