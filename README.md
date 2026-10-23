# Valendo!

Caixa de ferramentas **gratuita e de código aberto** para a sala de aula: buzzer, placar, sorteio, quiz, prova em espiral e muito mais. Funciona no celular, no tablet e no computador, **sem internet, sem conta e sem coletar dados**.

> Status: **Fase 6 — Prova em Espiral e provas** pronta (e as Fases 0 a 5). Próxima: extras (Fase 7). Quiz, Passa ou Repassa, Espiral e Provas aparecem como "Em breve" e chegam nas próximas fases. Veja o plano completo em [`PLANO-VALENDO.md`](PLANO-VALENDO.md).

## Buzzer

Quem responde primeiro, num aparelho só, sem internet.

- **Valendo relâmpago:** um toque na tela inicial abre o buzzer com 2 jogadores e o padrão aplicado.
- **2 a 8 jogadores**, com áreas que se reorganizam em retrato e paisagem. Com o aparelho deitado na mesa, as áreas ficam de frente para cada aluno (giradas 180° ou 90°).
- **Dois métodos:** *aperta primeiro* (B) ou *segura e solta primeiro* (A).
- **Largada:** espera surpresa (aleatória), contagem 3-2-1 ou manual pelo professor; sinal com som e tela, só tela ou só som.
- **Queima de largada** com regra configurável: aviso, anular a rodada, penalidade de tempo, eliminar ou o professor decide.
- **Empate técnico** quando a diferença é menor que a margem (padrão 10 ms), com botão de desempate.
- **Juiz de dúvida:** ordem de todos e a diferença em milissegundos.
- **Método D:** cada jogador responde por uma tecla do teclado ou botão de clicker (teclas configuráveis; padrão A e L).
- **Atalhos:** Espaço = largada / de novo, F = tela cheia, Esc = sair.

## Ferramentas rápidas

Tudo funciona offline e fica salvo no aparelho (IndexedDB), mesmo depois de recarregar a página.

- **Placar** por equipe: +1, +5, +10, −1 ou qualquer valor, desfazer/refazer, zerar e modo projetor. Teclado: 1–8 dá +1, Shift+1–8 tira 1, Ctrl+Z desfaz.
- **Sorteio** sem repetição, com **chamada rápida** de presença (quem faltou não entra), desfazer e histórico. Espaço sorteia.
- **Cronômetro** grande para o projetor: regressivo ou progressivo, tempos prontos, +30 s, aviso nos 10 s finais e alarme com som e tela piscando. Continua certo mesmo se recarregar a página.
- **Equipes**: aleatórias ou equilibradas por nível (1 a 3), por número de equipes ou por tamanho, ajuste manual, copiar e "usar no placar".
- **Turmas salvas**: listas de alunos (com nível opcional) para usar no sorteio, nas equipes e no placar. Dá para colar a lista inteira da planilha.

## Atividades e banco de questões

Em **Atividades** (`#/atividades`) o professor monta quizzes, provas e Passa ou Repassa:

- **Tipos de questão:** múltipla escolha (uma ou várias corretas), verdadeiro ou falso, resposta curta (com variações aceitas; ignora acentos e maiúsculas), numérica (com tolerância e unidade), enquete e "slide".
- **Colar texto e converter:** cole `1) Enunciado` / `a) ...` / `*b) correta` (ou `Resposta: c`, `Resposta: V`, `Resposta: 9,8 ±0,1 m/s²`) e o Valendo! monta as questões.
- **Configuração em três níveis** (básica, avançada e personalizada), mostrando só o que importa para a modalidade.
- **Pré-visualização** com gabarito e **modo de teste** para responder como aluno.
- Criar, **duplicar**, **editar uma cópia**, **favoritar** e **buscar** por texto, tag, disciplina ou dificuldade.
- **Exportar/importar** `.valendo.json` (uma ou várias atividades) e **CSV** (abre no Excel/Planilhas: colunas `tipo;enunciado;a;b;c;d;e;f;resposta;pontos;tempo;explicacao;tags`).
- Versões: cada atividade guarda o `schema`; `js/core/activity.js` migra atividades antigas automaticamente, então versões novas do app não quebram arquivos antigos.

## Quiz e Passa ou Repassa

Tudo num aparelho só, ligado no projetor, sem internet:

- **Quiz** (`#/quiz`): abertura, pergunta com tempo, o professor registra a resposta de cada equipe (tocando na forma que a equipe mostrou, ou ✓/✕ nas abertas), revelação com a distribuição das respostas e a explicação, ranking (completo, top 5 ou oculto) e pódio com confete.
- **Pontuação:** pontos por velocidade (opcional), pergunta valendo em dobro ou zero, bônus por acertos seguidos e desconto por erro.
- **Passa ou Repassa** (`#/passa`): de 2 a 4 equipes; a equipe da vez responde ou passa, quem recebe responde ou repassa, e quem passou é obrigado a responder. Pontos configuráveis (acerto, acerto no repassa, erro no repassa) e **torta animada** em quem erra.
- **Exemplo pronto:** "Experimentar o exemplo" cria um quiz de 10 perguntas para testar na hora.
- O resultado de cada partida fica salvo no aparelho (para os relatórios da Fase 7).
- **Controle remoto:** o quiz já funciona por comandos (`executar('proxima')`, `'responder'`, `'encerrar'`...); na Fase 5 o celular do professor só vai mandar esses comandos.

## Salas com celulares

Em **Sala com celulares** (`#/sala`) cada aluno joga no próprio celular, entrando com um **código de 6 caracteres** (sem 0/O nem 1/I) ou pelo **QR Code**. O aparelho do professor é sempre o **host com autoridade**: valida tempo, pontos e trapaças.

- **Quiz ao vivo**: a pergunta no projetor e as respostas pelos celulares. O gabarito **nunca** é enviado aos alunos antes da revelação.
- **Quiz no seu ritmo**: cada aluno avança sozinho; o professor acompanha o progresso e encerra para todos.
- **Buzzer no celular** (método C): a largada é marcada num horário do relógio do professor e cada celular converte para o seu, então todos veem o sinal juntos. Margem de empate pela rede: 30 ms.
- **Lobby**: nomes com gerador de apelidos e filtro de nomes ofensivos, sinal de conexão de cada um (verde, amarelo ou vermelho), trancar a sala e remover alunos.
- **Reconexão**: o celular que cai volta sozinho com o mesmo `clientId` (guardado no `sessionStorage`), recebe o estado completo e não ganha pontos em dobro.
- **Relógio sincronizado**: cerca de 8 pings, com a mediana das amostras de menor tempo de ida e volta; ressincroniza a cada 20 s.

### Três jeitos de conectar

| Modo | Precisa de internet? | Como |
|---|---|---|
| **Online** (padrão) | Só para conectar | PeerJS: a sinalização vai pela internet e o jogo passa direto entre os aparelhos. |
| **Sem internet (QR)** | Não | WebRTC com sinalização manual: o aluno lê o QR de convite do professor e mostra um QR de resposta. Bom para poucos aparelhos. |
| **Servidor local** | Não | No PC do professor: dois cliques em `iniciar-sala-local.bat` (ou `node server/valendo-server.js`). Os alunos abrem `http://IP-do-PC:8080/#/entrar?modo=local`. Para turma grande. |

**Limitações:** alguns roteadores de escola bloqueiam a conversa entre aparelhos (isolamento de clientes); nesse caso, use o **ponto de acesso do celular do professor**. Pela rede, a ordem é justa, mas não física e perfeita. Num aparelho só, quem tem o aparelho tem o controle.

## Prova em Espiral e provas individuais

Abertas pela **Sala com celulares** (pastas Espiral e Provas na tela inicial):

- **Prova em Espiral** (rotação): N grupos × M provas (estações), tempo por rodada (ou o tempo de cada prova), sentido do giro, **grupo em pausa** quando há mais grupos que provas, **aviso** antes do fim, **prorrogação** (+1 min), **pausa geral** e **avanço manual** (ou automático).
- Dois jeitos: **"a prova anda, o grupo fica"** (o aparelho fica na mesa do grupo e o conteúdo troca) ou **"o grupo anda"** (cada estação tem um aparelho).
- No fim do tempo: **trava, salva e marca em branco** o que ficou sem resposta. Se um aparelho cair, ele volta na mesma prova e as respostas pendentes são reenviadas sem duplicar.
- **Grade final** grupo × prova com correção automática, **correção manual** por questão, **comentários** e **exportação CSV**.
- **Prova individual**: horário de início, limite de tempo, **embaralhamento por aluno** (fixo: a mesma ordem se ele cair e voltar), **tempo extra individual** (+5 min), navegação livre entre as questões, entrega e grade aluno × prova.

Precisão: os toques usam `pointerdown`/`pointerup` com `event.timeStamp`, multitoque por `pointerId`, e a largada é marcada no frame do `requestAnimationFrame` em que o sinal aparece, com o som tocando no mesmo instante (WebAudio).

## Como rodar localmente

Não há instalação nem etapa de build: são arquivos estáticos (HTML, CSS e JavaScript puro com ES Modules). Só é preciso servir a pasta por HTTP — abrir o `index.html` direto (`file://`) não funciona, porque módulos e service worker exigem um servidor.

**No Windows:** dê dois cliques em `iniciar.bat`. Ele sobe o servidor e abre o navegador.

Ou, em qualquer sistema, escolha um:

```bash
# Python (já vem no Windows com Python, no macOS e no Linux)
python -m http.server 8080

# ou Node
npx serve -l 8080 .
```

Depois abra <http://localhost:8080>.

### Testes

```bash
node --test        # ou: npm test
```

Os testes cobrem a máquina de estados do buzzer (queima, empate e multitoque) e conferem, entre outras coisas, que todo arquivo do app está no cache offline, que `/js/core` não usa DOM nem rede, que as chaves de tradução existem e que os créditos estão no lugar.

## Funciona offline

Na primeira visita o service worker (`sw.js`) guarda o app inteiro no aparelho. A partir daí ele abre mesmo sem internet. Pode também ser **instalado** como app (PWA) pelo menu do navegador.

Ao publicar uma versão nova, troque `VERSAO` em `sw.js` **e** em `js/config.js`, e mantenha a lista `ARQUIVOS` do `sw.js` atualizada (o teste avisa se faltar algo).

## Publicar no GitHub Pages

1. Envie a pasta para um repositório no GitHub.
2. Em **Settings → Pages**, escolha *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O app fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.
4. A URL do repositório fica em `REPOSITORIO`, no arquivo `js/config.js` (aparece na tela Sobre).

## Estrutura

```
index.html            shell do app (SPA com router por hash)
404.html              "folha arrancada do caderno" (independente, sem dependências)
manifest.webmanifest  dados do PWA
sw.js                 service worker (cache offline)
css/                  tokens.css · base.css · components.css
js/app.js             boot + router + tema
js/i18n/              textos da interface (pt-BR)
js/ui/components/     botão, cartão-pasta, modal, toast, post-it, switch, stepper, mascote
js/ui/screens/        início, sobre, vitrine, 404
js/net/               transporte das salas: protocol, transport, peer-online, peer-qr, local-server
server/               valendo-server.js (servidor local opcional, Node, sem dependências)
vendor/               peerjs, qrcode-generator e jsQR (locais, com as licenças)
js/core/              lógica pura, sem DOM e sem rede: buzzer, placar, sorteio, cronômetro, equipes, sala, ritmo, rotation (espiral), prova,
                      atividades (schema + migração), arquivos (colar/CSV/JSON), quiz, passa-repassa
js/core/questions/    um arquivo por tipo de questão (plugin)
js/audio/             sons gerados com WebAudio
js/storage/           IndexedDB (turmas e sessões) e preferências
assets/               ícones e fontes locais
tests/                testes com node --test
```

Rotas: `#/` (início), `#/buzzer` (ajustes), `#/buzzer/jogar` (jogo; `?relampago` usa o padrão), `#/placar`, `#/sorteio`, `#/cronometro`, `#/equipes`, `#/turmas`, `#/ferramentas`, `#/atividades` (biblioteca), `#/atividades/editar?id=…`, `#/atividades/testar?id=…`, `#/quiz`, `#/passa`, `#/jogar?id=…`, `#/sala`, `#/entrar`, `#/sobre` (Sobre e créditos), `#/vitrine` (todos os componentes).

## Design system: "caderno neo-brutalista"

Fundo branco-papel, bordas pretas grossas, sombra sólida deslocada e cores vivas. Cada modalidade é uma pasta com aba colorida. Títulos manuscritos (Caveat), corpo em Space Grotesk, laranja escuro para ações e azul escuro para informação. Botões "afundam" ao apertar. Modo escuro "quadro-negro" automático ou manual (botão no cabeçalho).

Acessibilidade: contraste AA, alvos de toque de 48px, foco visível em laranja, respeito a `prefers-reduced-motion` e tamanhos em `rem` (acompanham o tamanho de texto do sistema).

## Privacidade

Sem contas, sem analytics, sem coleta. Tudo fica no aparelho.

## Créditos e autor

Criado por **Francisco Audir** — Instagram [@filho.af](https://instagram.com/filho.af).

Repositório: <https://github.com/Francisco12-cpu/valendo>

Bibliotecas em `vendor/`: [PeerJS](https://peerjs.com) (MIT), [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) e [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0).

Fontes [Caveat](https://fonts.google.com/specimen/Caveat) e [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), sob a SIL Open Font License (cópias das licenças em `assets/fonts/`).

## Licença

[MIT](LICENSE) — use, copie e adapte à vontade.
