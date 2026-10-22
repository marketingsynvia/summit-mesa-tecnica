// Credenciamento · Synvia Summit 2026
import { firebaseStore, demoStore } from "./store.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const ls = {
  get(k){ try { return localStorage.getItem(k); } catch(e){ return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch(e){} },
  del(k){ try { localStorage.removeItem(k); } catch(e){} }
};
const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const hora = t => t ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(t)) : "";
const desktop = () => matchMedia("(min-width:1021px)").matches;
const ICON_OK = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11"/><path d="M7.5 12.5l3 3 6-6.5"/></svg>`;
const ICON_WARN = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 7v6M12 16.5v.5"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg>`;

/* ---------- aparelho e pessoa ---------- */
function deviceLabel(){
  const ua = navigator.userAgent || "";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? "celular Android" : "tablet Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "computador";
}
let dev = ls.get("cred-dev");
if (!dev){ dev = "d" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4); ls.set("cred-dev", dev); }
const me = { dev, label: deviceLabel(), first: "", last: "" };
try { Object.assign(me, JSON.parse(ls.get("cred-user") || "{}")); } catch(e){}
const fullName = () => `${me.first} ${me.last}`.trim();
const curto = n => { const w = String(n || "").trim().split(/\s+/); return w.length > 1 ? `${w[0]} ${w[w.length - 1][0]}.` : (w[0] || ""); };
const iniciais = n => { const w = String(n || "?").trim().split(/\s+/); return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase(); };
const cap = s => s.replace(/(^|[\s-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

const DEMO = new URLSearchParams(location.search).has("demo");
let KEY = decodeURIComponent((location.hash || "").slice(1)).trim();
if (/^[A-Za-z0-9_-]{16,}$/.test(KEY)) ls.set("cred-key", KEY); else KEY = ls.get("cred-key") || "";
const temChave = () => DEMO || /^[A-Za-z0-9_-]{16,}$/.test(KEY);

/* ---------- estado ---------- */
let store = null, P = {}, CI = {}, STAFF = {};
let loaded = false, filtro = "all", q = "", limite = 150, ativo = -1, visiveis = [];
const busy = new Set(), flash = new Set(), idx = new Map();

/* ---------- entrada ---------- */
function showGate(){
  $("#app").hidden = true; $("#gate").hidden = false;
  const ok = temChave();
  $("#gText").hidden = !ok; $("#gFields").hidden = !ok; $("#gGo").hidden = !ok; $("#gNoLink").hidden = ok;
  if (!ok) return;
  $("#gFirst").value = me.first || ""; $("#gLast").value = me.last || "";
  setTimeout(() => $("#gFirst").focus(), 30);
}
$("#gateForm").addEventListener("submit", e => {
  e.preventDefault();
  const f = cap($("#gFirst").value.trim().replace(/\s+/g, " ")), l = cap($("#gLast").value.trim().replace(/\s+/g, " "));
  $("#gFirst").setAttribute("aria-invalid", String(f.length < 2)); $("#gLast").setAttribute("aria-invalid", String(l.length < 2));
  if (f.length < 2 || l.length < 2){
    $("#gErr").textContent = "Preencha nome e sobrenome."; $("#gErr").hidden = false;
    (f.length < 2 ? $("#gFirst") : $("#gLast")).focus(); return;
  }
  $("#gErr").hidden = true;
  me.first = f; me.last = l; ls.set("cred-user", JSON.stringify({ first: f, last: l }));
  $("#gate").hidden = true;
  start();
});

async function start(){
  $("#app").hidden = false;
  $("#demo").hidden = !DEMO;
  paintUser();
  if (!store){
    try { store = DEMO ? demoStore() : await firebaseStore(KEY); }
    catch(e){ toast("Não foi possível conectar. Confira a internet e recarregue a página.", "err", 10000); return; }
    bind();
    window.credSeed = obj => store.update(Object.fromEntries(Object.entries(obj).map(([k, v]) => [`p/${k}`, v])));
  }
  saveStaff();
  render();
  if (desktop()) $("#q").focus();
}
function paintUser(){
  $("#userName").textContent = fullName();
  $("#userAv").textContent = iniciais(fullName());
  $("#menuHead").innerHTML = `<b>${esc(fullName())}</b>Credenciando neste ${esc(me.label)}`;
}
function saveStaff(){
  const prev = STAFF[me.dev] || {};
  store.update({ [`staff/${me.dev}`]: { n: fullName(), d: me.label, at: prev.at || store.now(), last: store.now() } }).catch(() => {});
}
const erroMsg = e => /permission|denied/i.test(String(e && (e.code || e.message)))
  ? "O banco recusou a gravação. Avise a organização."
  : "Não deu para salvar. Confira a conexão e tente de novo.";

function bind(){
  let everOn = false, t = null;
  store.onConn(on => {
    const el = $("#live");
    el.classList.toggle("on", on); el.classList.toggle("off", !on && everOn);
    el.querySelector("span").textContent = on ? "Ao vivo" : "Sem conexão";
    clearTimeout(t);
    if (on){ everOn = true; $("#offline").hidden = true; }
    else t = setTimeout(() => { $("#offline").hidden = false; }, everOn ? 1500 : 6000);
  });
  store.on("p", v => { P = v; loaded = true; reindex(); render(); });
  store.on("ci", v => { CI = v; render(); refreshDialog(); });
  store.on("staff", v => { STAFF = v; });
}

/* ---------- busca ---------- */
function reindex(){
  idx.clear();
  for (const [id, p] of Object.entries(P)) idx.set(id, " " + norm([p.n, p.e, p.c, p.g, p.tk].join(" ")).replace(/[^a-z0-9]+/g, " ") + " ");
}
const tokens = () => norm(q).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
function realce(text, toks){
  text = String(text ?? "");
  if (!toks.length) return esc(text);
  const chars = [...text], base = chars.map(c => norm(c).charAt(0) || c).join("");
  const on = new Array(chars.length).fill(false), w = ch => /[a-z0-9]/.test(ch || "");
  for (const t of toks){ let i = base.indexOf(t); while (i >= 0){ if (!w(base[i - 1])) for (let k = i; k < i + t.length; k++) on[k] = true; i = base.indexOf(t, i + 1); } }
  let out = "", open = false;
  chars.forEach((c, i) => { if (on[i] !== open){ out += on[i] ? "<mark>" : "</mark>"; open = on[i]; } out += esc(c); });
  return out + (open ? "</mark>" : "");
}

/* ---------- desenho ---------- */
function contagem(){
  const ids = Object.keys(P); let inn = 0;
  for (const id of ids) if (CI[id]) inn++;
  return { tot: ids.length, inn, pend: ids.length - inn };
}
function render(){
  if (!store) return;
  const c = contagem(), pct = c.tot ? Math.round(100 * c.inn / c.tot) : 0;
  $("#pIn").textContent = c.inn; $("#pTot").textContent = c.tot; $("#pPct").textContent = pct + "%";
  $("#pBar").style.width = (c.tot ? 100 * c.inn / c.tot : 0) + "%";
  $("#cAll").textContent = c.tot; $("#cPend").textContent = c.pend; $("#cIn").textContent = c.inn;
  renderList(); renderFeed();
}
function chip(p){
  if (p.src === "extra") return `<span class="chip new">Fora da lista</span>`;
  if (!p.g) return "";
  const cls = /vip/i.test(p.g) ? "vip" : /synvia/i.test(p.g) ? "syn" : "";
  return `<span class="chip ${cls}">${esc(p.g)}</span>`;
}
function renderList(){
  const list = $("#list"), empty = $("#empty");
  if (!loaded){ list.innerHTML = ""; empty.hidden = false; empty.innerHTML = `<p>Carregando a lista…</p>`; return; }
  const toks = tokens();
  const nn = id => norm(P[id].n);
  let ids = Object.keys(P).filter(id => (filtro === "all" || (filtro === "in") === !!CI[id]) && toks.every(t => (idx.get(id) || "").includes(" " + t)));
  if (toks.length){
    const first = toks[0], all = toks.join(" ");
    const score = id => { const n = " " + nn(id); return n.startsWith(" " + all) ? 0 : n.includes(" " + first) ? 1 : 2; };
    ids.sort((a, b) => score(a) - score(b) || nn(a).localeCompare(nn(b)));
  } else if (filtro === "in") ids.sort((a, b) => (CI[b].at || 0) - (CI[a].at || 0));
  else ids.sort((a, b) => nn(a).localeCompare(nn(b)));
  visiveis = ids.slice(0, limite);
  if (ativo >= visiveis.length) ativo = visiveis.length - 1;

  if (!ids.length){
    list.innerHTML = ""; empty.hidden = false;
    const termo = q.trim();
    empty.innerHTML = termo
      ? `<h3>Ninguém encontrado para “${esc(termo)}”</h3><p>Tente só o sobrenome ou o nome da empresa.${filtro !== "all" ? " A busca está filtrada, confira também em Todos." : ""}</p><button class="btn primary" data-act="add">Cadastrar novo participante</button>`
      : filtro === "in" ? `<h3>Ninguém credenciado ainda</h3><p>Os credenciamentos aparecem aqui assim que forem feitos.</p>`
      : filtro === "pend" ? `<h3>Todos os participantes foram credenciados</h3>` : `<h3>A lista está vazia</h3>`;
    return;
  }
  empty.hidden = true;
  list.innerHTML = visiveis.map((id, i) => {
    const p = P[id], c = CI[id];
    const meta = [p.c, p.e].filter(Boolean).join(", ");
    const right = c
      ? `<div class="stamp"><b>${hora(c.at)}</b>por ${esc(curto(c.bn))}</div>`
      : `<div class="act"><button class="btn primary" data-ci="${esc(id)}"${busy.has(id) ? " disabled" : ""}>${busy.has(id) ? "Aguarde" : "Credenciar"}</button></div>`;
    return `<li class="row${c ? " done" : ""}${i === ativo ? " active" : ""}${flash.has(id) ? " flash" : ""}" data-id="${esc(id)}">
      <span class="avatar">${c ? ICON_CHECK : esc(iniciais(p.n))}</span>
      <div class="who"><div class="name">${realce(p.n, toks)}</div><div class="meta">${meta ? `<span class="txt">${realce(meta, toks)}</span>` : ""}${chip(p)}</div></div>
      ${right}</li>`;
  }).join("") + (ids.length > visiveis.length ? `<li class="more"><span>Mostrando ${visiveis.length} de ${ids.length}</span><button class="btn quiet" data-act="more">Mostrar todos</button></li>` : "");
}
function renderFeed(){
  const ids = Object.keys(CI).filter(id => P[id]).sort((a, b) => (CI[b].at || 0) - (CI[a].at || 0)).slice(0, 30);
  $("#feed").innerHTML = ids.length
    ? ids.map(id => `<li><time>${hora(CI[id].at)}</time><button data-open="${esc(id)}">${esc(P[id].n)}</button><span>por ${esc(curto(CI[id].bn))}</span></li>`).join("")
    : `<li class="none">Os credenciamentos aparecem aqui em tempo real.</li>`;
}
function setAtivo(i){
  ativo = Math.max(-1, Math.min(i, visiveis.length - 1));
  $$("#list .row").forEach((r, k) => r.classList.toggle("active", k === ativo));
  const r = $$("#list .row")[ativo];
  if (r) r.scrollIntoView({ block: "nearest" });
}

/* ---------- credenciar ---------- */
async function credenciar(id, { doDialogo = false } = {}){
  const p = P[id];
  if (!p || busy.has(id)) return;
  if (CI[id]){ toast(`<b>${esc(p.n)}</b><small>Já foi credenciado às ${hora(CI[id].at)} por ${esc(curto(CI[id].bn))}</small>`, "warn", 6000); return; }
  busy.add(id); renderList(); refreshDialog();
  const rec = { at: store.now(), by: me.dev, bn: fullName(), bd: me.label };
  const lento = setTimeout(() => { if (busy.has(id)) toast("Aguardando a conexão para confirmar…", "warn", 4000); }, 3500);
  try {
    const r = await store.checkin(id, rec);
    if (r.ok){
      store.log({ a: "in", id, by: me.dev, bn: fullName(), at: rec.at }).catch(() => {});
      flash.add(id); setTimeout(() => flash.delete(id), 1500);
      if (doDialogo) fecharDialogo();
      toast(`<b>${esc(p.n)}</b><small>Credenciamento confirmado às ${hora(rec.at)}</small>`, "", 8000, { label: "Desfazer", fn: () => desfazer(id) });
      limparBusca();
    } else {
      const x = r.existing || {};
      toast(`<b>${esc(p.n)}</b><small>Já tinha sido credenciado às ${hora(x.at)} por ${esc(curto(x.bn) || "outra pessoa")}</small>`, "warn", 7000);
    }
  } catch(e){ toast(erroMsg(e), "err", 7000); }
  finally { clearTimeout(lento); busy.delete(id); renderList(); refreshDialog(); }
}
async function desfazer(id){
  if (!CI[id]) return;
  try {
    await store.undo(id);
    store.log({ a: "undo", id, by: me.dev, bn: fullName(), at: store.now() }).catch(() => {});
    toast(`<b>${esc(P[id] ? P[id].n : "Participante")}</b><small>Credenciamento desfeito</small>`, "", 4000);
  } catch(e){ toast(erroMsg(e), "err", 7000); }
}
function limparBusca(){
  if (q){ q = ""; $("#q").value = ""; $("#qClear").hidden = true; ativo = -1; limite = 150; renderList(); }
  if (desktop()) $("#q").focus();
}

/* ---------- diálogos ---------- */
let dlg = null;
function abrirDialogo(html, estado){
  dlg = estado || null;
  $("#toast").hidden = true;
  $("#dBody").innerHTML = html;
  $("#dialog").hidden = false; $("#scrim").hidden = false;
  document.body.style.overflow = "hidden";
  const f = $("#dialog [autofocus]") || $("#dialog .btn.primary");
  if (f) setTimeout(() => f.focus(), 40);
}
function fecharDialogo(){
  if ($("#dialog").hidden) return;
  $("#dialog").hidden = true; $("#scrim").hidden = true; dlg = null;
  document.body.style.overflow = "";
  if (desktop()) $("#q").focus();
}
$("#dClose").onclick = fecharDialogo; $("#scrim").onclick = fecharDialogo;
function refreshDialog(){ if (dlg && dlg.type === "pessoa") abrirPessoa(dlg.id); }

function abrirPessoa(id){
  const p = P[id]; if (!p) return;
  const c = CI[id];
  const linhas = [
    ["Empresa", p.e], ["Cargo", p.c],
    ["Ingresso", p.src === "extra" ? "Fora da lista" : p.g],
    ["Nº do ingresso", p.src === "extra" ? "" : p.tk],
    ["Cadastro", p.src === "extra" ? `Feito na hora por ${p.bn || "?"}, às ${hora(p.at)}` : ""]
  ].filter(l => l[1]);
  const estado = c
    ? `<div class="state ok">${ICON_OK}<div><b>Credenciado às ${hora(c.at)}</b><span class="sub">por ${esc(c.bn || "?")}${c.bd ? ", no " + esc(c.bd) : ""}</span></div></div>`
    : "";
  const acao = c
    ? `<button class="btn danger block" id="dUndo">Desfazer credenciamento</button>`
    : `<button class="btn primary large block" id="dGo"${busy.has(id) ? " disabled" : ""}>${busy.has(id) ? "Aguarde" : "Credenciar"}</button>`;
  abrirDialogo(`<h2 id="dTitle">${esc(p.n)}</h2>${estado}
    <dl class="facts">${linhas.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <div class="stack">${acao}</div>`, { type: "pessoa", id });
  const go = $("#dGo"); if (go) go.onclick = () => credenciar(id, { doDialogo: true });
  const un = $("#dUndo");
  if (un) un.onclick = () => {
    if (un.dataset.ok){ desfazer(id); return; }
    un.dataset.ok = "1"; un.textContent = "Confirmar: desfazer credenciamento";
    setTimeout(() => { if (un.isConnected){ delete un.dataset.ok; un.textContent = "Desfazer credenciamento"; } }, 4000);
  };
}

function abrirNovo(){
  const termo = q.trim(), nome = /\d/.test(termo) ? "" : cap(termo);
  abrirDialogo(`<h2 id="dTitle">Novo participante</h2><p class="lead">Para quem chegou e não está na lista do Sympla.</p>
    <form id="nForm" autocomplete="off" novalidate>
      <label class="field"><span>Nome e sobrenome</span><input name="n" maxlength="120" autocapitalize="words" value="${esc(nome)}" autofocus required></label>
      <div id="nDup"></div>
      <label class="field"><span>Empresa</span><input name="e" maxlength="120" autocapitalize="words" required></label>
      <label class="field"><span>Cargo (opcional)</span><input name="c" maxlength="120" autocapitalize="sentences"></label>
      <label class="check"><input type="checkbox" name="ci" checked> Credenciar agora</label>
      <p class="form-error" id="nErr" role="alert" hidden></p>
      <button class="btn primary large block" type="submit" id="nGo">Cadastrar e credenciar</button>
    </form>`, { type: "novo" });
  const f = $("#nForm");
  f.ci.onchange = () => { $("#nGo").textContent = f.ci.checked ? "Cadastrar e credenciar" : "Cadastrar"; };
  const dup = () => {
    const t = norm(f.n.value).replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(w => w.length > 1);
    if (t.length < 2){ $("#nDup").innerHTML = ""; return; }
    const achados = Object.keys(P).filter(id => t.every(w => (" " + norm(P[id].n) + " ").includes(" " + w))).slice(0, 3);
    $("#nDup").innerHTML = achados.length
      ? `<div class="state warn">${ICON_WARN}<div><b>Já existe alguém com esse nome na lista</b>${achados.map(id => `<button type="button" data-open="${esc(id)}">${esc(P[id].n)}${P[id].e ? ", " + esc(P[id].e) : ""}</button>`).join("<br>")}</div></div>`
      : "";
  };
  f.n.addEventListener("input", dup); dup();
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const v = k => f[k].value.trim().replace(/\s+/g, " ");
    const n = cap(v("n")), emp = v("e");
    if (n.split(" ").length < 2 || !emp){ $("#nErr").textContent = n.split(" ").length < 2 ? "Informe nome e sobrenome." : "Informe a empresa."; $("#nErr").hidden = false; return; }
    const id = store.newId(), now = store.now();
    const paths = { [`p/${id}`]: { n, e: emp, c: v("c"), g: "Fora da lista", src: "extra", by: me.dev, bn: fullName(), at: now } };
    if (f.ci.checked) paths[`ci/${id}`] = { at: now, by: me.dev, bn: fullName(), bd: me.label };
    $("#nGo").disabled = true;
    try {
      await store.update(paths);
      store.log({ a: "add", id, by: me.dev, bn: fullName(), at: now }).catch(() => {});
      fecharDialogo(); limparBusca();
      flash.add(id); setTimeout(() => flash.delete(id), 1500);
      toast(`<b>${esc(n)}</b><small>${f.ci.checked ? "Cadastro e credenciamento confirmados" : "Cadastro confirmado"}</small>`, "", 6000);
    } catch(err){ $("#nGo").disabled = false; toast(erroMsg(err), "err", 7000); }
  });
}

function abrirEquipe(){
  const porDev = {};
  for (const c of Object.values(CI)){ const k = c.by || "?"; (porDev[k] = porDev[k] || { n: 0, bn: c.bn, bd: c.bd }).n++; }
  const devs = new Set([...Object.keys(STAFF), ...Object.keys(porDev)]);
  const lista = [...devs].map(d => ({ d, nome: (STAFF[d] && STAFF[d].n) || (porDev[d] && porDev[d].bn) || "?", ap: (STAFF[d] && STAFF[d].d) || (porDev[d] && porDev[d].bd) || "", n: porDev[d] ? porDev[d].n : 0 }))
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
  abrirDialogo(`<h2 id="dTitle">Equipe</h2><p class="lead">Quem está credenciando e quantos participantes cada um já credenciou.</p>
    <ul class="team">${lista.map(x => `<li><span class="avatar">${esc(iniciais(x.nome))}</span><span class="t"><b>${esc(x.nome)}${x.d === me.dev ? " (você)" : ""}</b><span>${esc(x.ap)}</span></span><span class="n">${x.n}</span></li>`).join("") || "<li>Ninguém entrou ainda.</li>"}</ul>`, { type: "equipe" });
}

function exportar(){
  const head = ["Nome","Empresa","Cargo","Ingresso","Nº do ingresso","Origem","Situação","Horário","Credenciado por","Aparelho"];
  const ids = Object.keys(P).sort((a, b) => norm(P[a].n).localeCompare(norm(P[b].n)));
  const cel = v => { v = String(v ?? ""); return /[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const linhas = [head.join(";")].concat(ids.map(id => {
    const p = P[id], c = CI[id];
    return [p.n, p.e, p.c, p.g, p.src === "extra" ? "" : p.tk, p.src === "extra" ? "Fora da lista" : "Sympla", c ? "Credenciado" : "Não credenciado", c ? hora(c.at) : "", c ? c.bn : "", c ? c.bd : ""].map(cel).join(";");
  }));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  a.download = `credenciamento-synvia-summit-2026.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- eventos ---------- */
function menu(open){
  open = open ?? $("#menu").hidden;
  $("#menu").hidden = !open; $("#userBtn").setAttribute("aria-expanded", String(open));
}
$("#userBtn").onclick = e => { e.stopPropagation(); menu(); };
$("#addBtn").onclick = abrirNovo;

document.addEventListener("click", e => {
  if (!$("#menu").hidden && !e.target.closest(".user")) menu(false);
  const a = e.target.closest("[data-act]");
  if (a){
    const act = a.dataset.act; menu(false);
    if (act === "team") abrirEquipe();
    else if (act === "export") exportar();
    else if (act === "logout"){ me.first = me.last = ""; ls.del("cred-user"); showGate(); }
    else if (act === "add") abrirNovo();
    else if (act === "more"){ limite = 100000; renderList(); }
    return;
  }
  const b = e.target.closest("[data-ci]");
  if (b){ e.stopPropagation(); credenciar(b.dataset.ci); return; }
  const o = e.target.closest("[data-open]");
  if (o){ e.preventDefault(); abrirPessoa(o.dataset.open); return; }
  const r = e.target.closest(".row");
  if (r) abrirPessoa(r.dataset.id);
});

let qt = null;
$("#q").addEventListener("input", e => {
  q = e.target.value; $("#qClear").hidden = !q; limite = 150;
  clearTimeout(qt); qt = setTimeout(() => { ativo = q.trim() && desktop() ? 0 : -1; renderList(); }, 40);
});
$("#q").addEventListener("keydown", e => {
  if (e.key === "ArrowDown"){ e.preventDefault(); setAtivo(ativo + 1); }
  else if (e.key === "ArrowUp"){ e.preventDefault(); setAtivo(ativo - 1); }
  else if (e.key === "Enter"){
    e.preventDefault();
    const i = ativo >= 0 ? ativo : (visiveis.length === 1 ? 0 : -1);
    const id = visiveis[i]; if (!id) return;
    if (CI[id]) abrirPessoa(id); else credenciar(id);
  }
  else if (e.key === "Escape" && q){ e.preventDefault(); $("#qClear").click(); }
});
$("#qClear").onclick = () => { q = ""; $("#q").value = ""; $("#qClear").hidden = true; ativo = -1; renderList(); $("#q").focus(); };
$$(".tabs button").forEach(b => b.onclick = () => {
  filtro = b.dataset.f; limite = 150; ativo = -1;
  $$(".tabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
  renderList();
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape"){ if (!$("#dialog").hidden) fecharDialogo(); else if (!$("#menu").hidden) menu(false); }
  if (e.key === "/" && $("#dialog").hidden && !/input|textarea/i.test(document.activeElement.tagName) && !$("#app").hidden){ e.preventDefault(); $("#q").focus(); }
});

/* ---------- aviso ---------- */
let toastT = null;
function toast(html, tipo = "", ms = 4000, acao){
  const t = $("#toast");
  t.className = "toast " + tipo; t.hidden = false;
  t.innerHTML = `${tipo === "warn" ? ICON_WARN : tipo === "" ? ICON_OK : ""}<span class="tx">${html}</span>${acao ? `<button type="button">${esc(acao.label)}</button>` : ""}`;
  if (acao) t.querySelector("button").onclick = () => { t.hidden = true; acao.fn(); };
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}
setInterval(() => { if (store && loaded) renderFeed(); }, 60e3);

/* ---------- início ---------- */
if (temChave() && me.first && me.last) start(); else showGate();
