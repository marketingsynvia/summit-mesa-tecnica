// Camada de dados do credenciamento.
// Firebase Realtime Database em produção; modo demonstração (?demo) guarda tudo neste navegador.
// Estrutura: cred/<chave>/p (participantes), ci (credenciados, escrita única), staff (equipe), log.
// A chave vem no link enviado à equipe (depois do #) e fica salva no aparelho. Ela não fica no repositório.

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";

export async function firebaseStore(key){
  const { initializeApp } = await import(FB + "firebase-app.js");
  const D = await import(FB + "firebase-database.js");
  const app = initializeApp(window.FIREBASE_CONFIG);
  const db = D.getDatabase(app);
  const base = `cred/${key}`;
  const r = p => D.ref(db, `${base}/${p}`);
  let offset = 0;
  D.onValue(D.ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });

  return {
    demo: false,
    now: () => Date.now() + offset,
    newId: () => "X" + D.push(r("p")).key.replace(/[^A-Za-z0-9_-]/g, ""),
    onConn(cb){ D.onValue(D.ref(db, ".info/connected"), s => cb(!!s.val())); },
    on(part, cb, fail){ D.onValue(r(part), s => cb(s.val() || {}), e => fail && fail(e)); },
    async checkin(id, rec){
      const res = await D.runTransaction(r(`ci/${id}`), cur => (cur ? undefined : rec), { applyLocally: false });
      return res.committed ? { ok: true } : { ok: false, existing: res.snapshot.val() };
    },
    undo(id){ return D.remove(r(`ci/${id}`)); },
    update(paths){ return D.update(D.ref(db, base), paths); },
    log(entry){ return D.set(D.push(r("log")), entry); }
  };
}

// ---------- modo demonstração ----------
// Dados fictícios, salvos no localStorage. Abas abertas no mesmo navegador sincronizam entre si.
export function demoStore(){
  const KEY = "cred-demo-v2";
  const subs = { p: [], ci: [], staff: [] };
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch(e){ return null; } };
  let data = load();
  if (!data){ data = { p: fakePeople(), ci: {}, staff: {}, log: {} }; save(); }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(data)); } catch(e){} }
  function emit(){ for (const k of Object.keys(subs)) subs[k].forEach(cb => cb(structuredClone(data[k] || {}))); }
  window.addEventListener("storage", e => { if (e.key === KEY){ data = load() || data; emit(); } });
  const setPath = (path, val) => {
    const parts = path.split("/"); let o = data;
    while (parts.length > 1){ const k = parts.shift(); o[k] = o[k] || {}; o = o[k]; }
    if (val === null) delete o[parts[0]]; else o[parts[0]] = val;
  };
  return {
    demo: true,
    now: () => Date.now(),
    newId: () => "X" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    onConn(cb){ setTimeout(() => cb(true), 150); },
    on(part, cb){ subs[part].push(cb); setTimeout(() => cb(structuredClone(data[part] || {})), 200); },
    async checkin(id, rec){
      data = load() || data;
      if (data.ci[id]) return { ok: false, existing: data.ci[id] };
      data.ci[id] = rec; save(); emit(); return { ok: true };
    },
    async undo(id){ delete data.ci[id]; save(); emit(); },
    async update(paths){ for (const [k, v] of Object.entries(paths)) setPath(k, v); save(); emit(); },
    async log(){ }
  };
}

function fakePeople(){
  const nomes = ["Ana Ribeiro","Bruno Teixeira","Camila Duarte","Diego Fontes","Elisa Moura","Fábio Lacerda","Gabriela Nunes","Heitor Campos","Isadora Pires","João Batista Lima","Karina Sales","Leonardo Prado","Marina Couto","Natália Freitas","Otávio Rangel","Paula Siqueira","Rafael Antunes","Sofia Albuquerque","Tiago Mendonça","Vanessa Rocha","Wagner Dias","Yara Cardoso"];
  const emp = [["Laboratório Alfa","VIP"],["Beta Farma","VIP"],["Gama Pharma","Convidado"],["Synvia","Colaborador Synvia"],["Delta Bio","Lote 2"]];
  const cargos = ["Gerente de Pesquisa Clínica","Coordenadora Regulatória","Diretor Médico","Analista de P&D","Head de Inovação"];
  const p = {};
  nomes.forEach((n, i) => {
    const [e, g] = emp[i % emp.length];
    const id = "DEMO-" + String(i + 1).padStart(3, "0");
    p[id] = { n, e, c: cargos[i % cargos.length], g, tk: id, src: "sympla" };
  });
  return p;
}
