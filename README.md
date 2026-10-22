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

## Credenciamento (`/credenciamento`)
Página de credenciamento do Summit, no mesmo projeto Firebase.

- A equipe abre pelo link com a chave no fim (`.../credenciamento/#chave`). A chave fica salva no aparelho e não está neste repositório. Ninguém digita código.
- Sem senha: no primeiro acesso a pessoa digita nome e sobrenome, que ficam salvos naquele aparelho. Cada credenciamento registra quem fez, em qual aparelho e a hora.
- Ninguém é credenciado duas vezes: a regra do banco só aceita gravar o credenciamento de alguém se ainda não existir, e a tela avisa quem já credenciou.
- A lista do Sympla fica só no banco (nome, empresa, cargo, tipo e número do ingresso), nunca neste repositório. Quem chega fora da lista entra pelo botão "Novo participante".
- No menu do usuário: equipe com a contagem por pessoa, planilha de credenciados (CSV) e troca de usuário.
- No computador: setas para escolher e Enter para credenciar.
- `?demo` no fim do endereço abre um modo de treino com dados fictícios, salvos só no navegador.

Dados em `cred/<chave>`: `p` (participantes), `ci` (credenciados), `staff` (equipe), `log` (histórico).
Depois de mudar `database.rules.json`, colar o conteúdo em Firebase > Realtime Database > Regras e publicar.

