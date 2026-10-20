# Summit Mesa Técnica

Página de operação da mesa técnica do Synvia Summit 2026 (22/10, Hilton Morumbi). Carlos no Resolume, Felipe nas telas.

- Roteiro do dia com a deixa "agora" e "próximo", sincronizada entre os dois.
- Rádio com avisos rápidos e mensagens.
- Tempo real pelo Firebase Realtime Database.

## Arquivos
- `index.html`: página.
- `roteiro.js`: roteiro do dia. Para mudar horário, clipe ou ordem, edite aqui.
- `app.js`: lógica e conexão com o Firebase.
- `config.js`: chaves do projeto Firebase (públicas por natureza).
- `database.rules.json`: regras do banco. Colar em Firebase > Realtime Database > Regras.

## Acesso
Os dados ficam em `mesa/<código>`. O código não está no repositório: ele vai no fim do link
(`.../#codigo`) ou é digitado na primeira tela. Quem não tem o código não lê nem escreve na sala.
