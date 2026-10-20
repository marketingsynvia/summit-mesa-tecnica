// Sobreposições do datashow. O fundo (tela/fundo.mp4) roda sempre por baixo.
// loop:false toca uma vez e para no último quadro (cronômetro).
// Para incluir uma nova: coloque o mp4 em tela/ (1920 x 384, fundo preto) e acrescente uma linha aqui.
window.TELA = [
  {id:'nenhum',          nome:'Só o fundo'},
  {id:'logo-horizontal', nome:'Logo horizontal (descanso)', src:'tela/logo-horizontal.mp4'},
  {id:'logo-completo',   nome:'Logo Summit 2026',           src:'tela/logo-completo.mp4'},
  {id:'apoio',           nome:'Apoio',                      src:'tela/apoio.mp4'},
  {id:'agenda',          nome:'Agenda manhã e tarde',       src:'tela/agenda.mp4'},
  {id:'cronometro',      nome:'Cronômetro 5 min',           src:'tela/cronometro.mp4', loop:false},
  {id:'painel-01',       nome:'Painel 01 · Regulação',      src:'tela/painel-01.mp4'},
  {id:'painel-03',       nome:'Painel 03 · Biossimilares',  src:'tela/painel-03.mp4'},
  {id:'painel-05',       nome:'Painel 05 · Dose múltipla',  src:'tela/painel-05.mp4'},
  {id:'painel-07',       nome:'Painel 07 · Novo ciclo',     src:'tela/painel-07.mp4'},
];
