import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Estado vindo da mesa técnica (mesa/<código>/tela):
//   rot: "id1,id2,..."  sobreposições do mix, alternam sozinhas com transição suave
//   ov:  "rot" (rodando o mix) ou o id de uma tela direta (entra na hora, corte seco, sem mix)
//   seg: segundos por tela no mix (0 = o vídeo inteiro)
const LISTA = (window.TELA || []).filter(o => o.src);
const $ = s => document.querySelector(s);
const stage = $('#stage');
const vids = {};
const FADE = 800;
for (const o of LISTA) {
  const v = document.createElement('video');
  v.src = o.src; v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.className = 'ov'; stage.appendChild(v); vids[o.id] = v;
}
const nome = id => (LISTA.find(o => o.id === id) || {nome:id}).nome;

let estado = { ov:'rot', rot:[], seg:0 };
let visivel = null, timer = null, idx = -1, assinatura = '';

function esconderTudo(exceto, corte){
  for (const id in vids) {
    if (id === exceto) continue;
    const v = vids[id];
    if (corte) { v.classList.add('cut'); v.classList.remove('on'); v.pause(); }
    else if (v.classList.contains('on')) { v.classList.remove('cut'); v.classList.remove('on'); setTimeout(() => { if (!v.classList.contains('on')) v.pause(); }, FADE + 100); }
  }
}
function exibir(id, corte, loop){
  const v = vids[id]; if (!v) return;
  esconderTudo(id, corte);
  v.loop = loop; v.currentTime = 0; v.play().catch(()=>{});
  v.classList.toggle('cut', !!corte); v.classList.add('on');
  visivel = id;
}
function limpar(corte){ clearTimeout(timer); esconderTudo(null, corte); visivel = null; }

// mix: passa pela lista, cada tela fica o vídeo inteiro (ou "seg" segundos)
function proxima(){
  clearTimeout(timer);
  if (estado.ov !== 'rot') return;
  const rot = estado.rot.filter(id => vids[id]);
  if (!rot.length) { limpar(false); hudNow(); return; }
  idx = (rot.indexOf(visivel) + 1) % rot.length;
  if (rot.length === 1 && visivel === rot[0]) { idx = 0; }
  const id = rot[idx], v = vids[id];
  if (!(rot.length === 1 && visivel === id && !v.paused)) exibir(id, false, rot.length === 1);
  hudNow();
  if (rot.length > 1) {
    const dur = estado.seg > 0 ? estado.seg : (isFinite(v.duration) && v.duration > 1 ? v.duration : 30);
    timer = setTimeout(proxima, Math.max(3, dur) * 1000 - FADE);
  }
}

function aplicar(novo){
  const antes = estado; estado = novo;
  if (novo.ov !== 'rot') {
    clearTimeout(timer);
    const item = (window.TELA || []).find(o => o.id === novo.ov);
    if (novo.ov === 'nenhum') limpar(true);
    else exibir(novo.ov, true, item ? item.loop !== false : true);
    hudNow(); return;
  }
  // voltando ao mix ou mudando a lista
  const mudouLista = antes.rot.join() !== novo.rot.join() || antes.seg !== novo.seg;
  if (antes.ov !== 'rot') { visivel = null; esconderTudo(null, true); proxima(); return; }
  if (mudouLista) {
    if (visivel && !novo.rot.includes(visivel)) { visivel = null; proxima(); }
    else { clearTimeout(timer); if (!visivel) proxima(); else { const v = vids[visivel]; v.loop = novo.rot.length === 1; if (novo.rot.length > 1) { const dur = novo.seg > 0 ? novo.seg : (isFinite(v.duration) && v.duration > 1 ? v.duration : 30); const resta = Math.max(1, dur - (novo.seg > 0 ? 0 : v.currentTime)); timer = setTimeout(proxima, resta * 1000 - FADE); } } }
    hudNow();
  }
}

function hudNow(){
  if (estado.ov !== 'rot') { $('#hudNow').textContent = 'Direto: ' + nome(estado.ov); return; }
  $('#hudNow').textContent = estado.rot.length ? 'Mix: ' + estado.rot.map(nome).join(' · ') : 'Só o fundo';
}

// aviso na tela, some sozinho
let hudT = null;
function hud(){ $('#hud').classList.remove('off'); document.body.classList.add('showcursor'); clearTimeout(hudT); hudT = setTimeout(() => { $('#hud').classList.add('off'); document.body.classList.remove('showcursor'); }, 4000); }
hud(); hudNow();
document.addEventListener('mousemove', hud);

// teclado no computador do datashow: 1 a 9 manda direto, 0 volta ao mix
const TODOS = window.TELA || [];
document.addEventListener('keydown', e => {
  const n = parseInt(e.key, 10);
  if (!isNaN(n)) { if (n === 0) aplicar({...estado, ov:'rot'}); else if (TODOS[n]) aplicar({...estado, ov:TODOS[n].id}); hud(); }
  else if (e.key === 'p' || e.key === 'P') document.body.classList.toggle('fill');
  else if (e.key === 'h' || e.key === 'H') hud();
  else if (e.key === 'f' || e.key === 'F') tela();
});
function tela(){ if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(()=>{}); }
document.addEventListener('click', tela);
$('#fundo').addEventListener('pause', () => $('#fundo').play().catch(()=>{}));

// comando remoto pela mesa técnica
const sala = decodeURIComponent(location.hash.slice(1)).trim();
if (sala.length < 16) { $('#hudStatus').textContent = 'Sem código no link: só o teclado funciona'; }
else {
  try {
    const db = getDatabase(initializeApp(window.FIREBASE_CONFIG || {}));
    onValue(ref(db, '.info/connected'), s => { $('#hudStatus').textContent = s.val() ? 'Recebendo comandos da mesa técnica' : 'Sem conexão. A tela continua rodando.'; });
    onValue(ref(db, `mesa/${sala}/tela`), s => {
      const d = s.val() || {};
      const novo = { ov: d.ov || 'rot', rot: String(d.rot || '').split(',').filter(Boolean), seg: Number(d.seg) || 0 };
      const sig = JSON.stringify(novo) + (novo.ov !== 'rot' ? d.at : '');
      if (sig === assinatura) return; assinatura = sig;
      aplicar(novo);
    }, () => { $('#hudStatus').textContent = 'Sem permissão no banco. Confira as regras do Firebase.'; });
  } catch (e) { $('#hudStatus').textContent = 'Erro ao conectar. Só o teclado funciona.'; }
}
