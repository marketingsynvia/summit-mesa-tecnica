// Página só de leitura para o time acompanhar a mesa técnica. Não grava nada no banco.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = { get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }, set(k,v){ try { localStorage.setItem(k,v); } catch(e){} } };

let ROS = JSON.parse(JSON.stringify(window.ROS || []));
let cur = 0, filtro = 'all', aberto = -1, ultimoScroll = -1;
const TELA = window.TELA || [];

const tema = store.get('mt-tema'); if (tema) document.documentElement.dataset.theme = tema;
$('#themeBtn').onclick = () => { const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = t; store.set('mt-tema', t); };

const fmt = o => new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo', ...o});
const minutos = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(t||'').trim()); return m ? (+m[1])*60 + (+m[2]) : null; };
function minutosAgora(){ const [h,m] = fmt({hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date()).split(':').map(Number); return h*60+m; }
function tick(){ $('#clock').textContent = fmt({hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date()); tempoRel(); }
setInterval(tick, 1000);

const ehVideo = c => !!(c && c.video), ehAudio = c => !!(c && c.narr), ehTroca = c => !!(c && c.troca);
const pills = c => `${ehVideo(c)?'<span class="pill video">▶ Vídeo</span>':''}${ehAudio(c)?'<span class="pill audio">Contagem + áudio</span>':''}${ehTroca(c)?'<span class="pill troca">Troca de palco</span>':''}`;
const facts = c => `<dl class="facts"><dt>Telão</dt><dd>${esc(c.clip||'')}</dd>${c.palco?`<dt>Palco</dt><dd>${esc(c.palco)}</dd>`:''}${c.mov?`<dt>Entra / sai</dt><dd>${esc(c.mov)}</dd>`:''}</dl>`;

function render(){
  cur = Math.max(0, Math.min(cur, ROS.length - 1));
  const c = ROS[cur], n = ROS[cur+1];
  $('#cueNow').innerHTML = c ? `<div class="cue-top"><span class="cue-label">Agora</span><span class="cue-time">${esc(c.t)}</span>${pills(c)}</div><h2>${esc(c.n)}</h2>${facts(c)}${c.d?`<p class="desc">${esc(c.d)}</p>`:''}` : '<h2>Roteiro vazio</h2>';
  $('#cueNow').classList.toggle('is-video', ehVideo(c));
  $('#cueNext').innerHTML = n ? `<div class="cue-top"><span class="cue-label">Próximo</span><span class="cue-time">${esc(n.t)}</span><span class="when" id="when" hidden></span>${pills(n)}</div><h2>${esc(n.n)}</h2>${facts(n)}` : '<div class="cue-top"><span class="cue-label">Próximo</span></div><h2>Fim do roteiro</h2>';
  $('#progText').textContent = ROS.length ? `Deixa ${cur+1} de ${ROS.length}` : 'Sem deixas';
  $('#progFill').style.width = ROS.length > 1 ? (100 * cur / (ROS.length - 1)) + '%' : '0';
  let html = '', bloco = '';
  ROS.forEach((r,i) => {
    const m = minutos(r.t), b = m === null ? '' : m < 12*60+30 ? 'Manhã' : m < 18*60 ? 'Tarde' : 'Noite';
    if (b && b !== bloco) { bloco = b; html += `<li class="block-title" aria-hidden="true">${b}</li>`; }
    const cls = ['row', i<cur?'done':'', i===cur?'cur':'', i===aberto?'open':'', ehVideo(r)?'video':'', ehAudio(r)?'audio':'', ehTroca(r)?'troca':''].join(' ');
    html += `<li class="${cls}" data-i="${i}"><time>${esc(r.t)}</time><span class="rail"><b></b></span><div class="body"><span class="t">${esc(r.n)}</span>
      <span class="meta">${pills(r)}<span class="clip">${esc(r.clip||'')}</span>${r.palco?`<span class="clip">· ${esc(r.palco)}</span>`:''}</span>
      ${r.mov?`<span class="mov">${esc(r.mov)}</span>`:''}${r.d?`<span class="d">${esc(r.d)}</span>`:''}</div></li>`;
  });
  $('#ros').innerHTML = html; aplicaFiltro();
  if (cur !== ultimoScroll) { ultimoScroll = cur; const box = $('#ros'), li = $('#ros .row.cur'); if (li && filtro === 'all' && box.scrollHeight > box.clientHeight + 4) box.scrollTo({top: Math.max(0, li.offsetTop - box.clientHeight * 0.28), behavior:'smooth'}); }
  tempoRel();
}
function aplicaFiltro(){
  $$('#ros .row').forEach(li => { const r = ROS[+li.dataset.i]; li.classList.toggle('hide', filtro === 'video' ? !ehVideo(r) : filtro === 'palco' ? !ehTroca(r) : false); });
  $$('#ros .block-title').forEach(b => b.hidden = filtro !== 'all');
}
function tempoRel(){
  const agora = minutosAgora(), prox = ROS[cur+1], mp = prox ? minutos(prox.t) : null, w = $('#when'), dr = $('#drift');
  if (w) { if (mp !== null && mp - agora >= 0 && mp - agora <= 180) { const d = mp - agora; w.hidden = false; w.textContent = d === 0 ? 'agora' : `em ${d} min`; w.classList.toggle('soon', d <= 5); } else w.hidden = true; }
  if (mp !== null && agora - mp > 0 && agora - mp <= 180) { dr.hidden = false; dr.className = 'badge late'; dr.textContent = `${agora - mp} min de atraso`; }
  else if (mp !== null && mp - agora >= 0 && mp - agora <= 180) { dr.hidden = false; dr.className = 'badge ok'; dr.textContent = 'no horário'; }
  else dr.hidden = true;
}
$('#ros').addEventListener('click', e => { const li = e.target.closest('.row'); if (!li) return; const i = +li.dataset.i; aberto = aberto === i ? -1 : i; render(); });
$$('.filters button').forEach(b => b.onclick = () => { filtro = b.dataset.filter; $$('.filters button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); aplicaFiltro(); });

const tNome = id => (TELA.find(o => o.id === id) || {nome:id}).nome;
function status(t, s){ $('#sync').textContent = t; $('#dot').className = 'dot ' + (s||''); }
const hora = ms => ms ? fmt({hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms)) : '';

render(); tick();
const vc = decodeURIComponent(location.hash.slice(1)).trim();
if (vc.length < 16) status('Link incompleto: peça o link de visualização ao Carlos', 'off');
else {
  try {
    const db = getDatabase(initializeApp(window.FIREBASE_CONFIG || {}));
    onValue(ref(db, '.info/connected'), s => s.val() ? status('Ao vivo', 'on') : status('Sem conexão', 'off'));
    onValue(ref(db, `ver/${vc}/ros`), s => { const d = s.val(); if (d && d.lista) { try { ROS = JSON.parse(d.lista); render(); } catch(e){} } }, () => status('Link inválido', 'off'));
    onValue(ref(db, `ver/${vc}/now`), s => { const d = s.val(); if (d && typeof d.idx === 'number') { cur = d.idx; aberto = -1; render(); $('#ultima').textContent = `${d.by || ''} às ${hora(d.at)}`.trim(); } }, () => {});
    onValue(ref(db, `ver/${vc}/tela`), s => { const d = s.val() || {}; const rot = String(d.rot || '').split(',').filter(Boolean);
      $('#telaNow').textContent = d.ov && d.ov !== 'rot' ? 'Direto: ' + tNome(d.ov) : rot.length ? 'Mix: ' + rot.map(tNome).join(' · ') : 'Só o fundo'; }, () => {});
  } catch(e) { status('Erro ao conectar', 'off'); }
}
