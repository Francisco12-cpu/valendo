# Valendo!

Caixa de ferramentas **gratuita e de código aberto** para a sala de aula: buzzer, placar, sorteio, quiz, prova em espiral e muito mais. Funciona no celular, no tablet e no computador, **sem internet, sem conta e sem coletar dados**.

> Status: **Fase 2 — Ferramentas rápidas** pronta (e as Fases 0 e 1: fundação e buzzer). Quiz, Passa ou Repassa, Espiral e Provas aparecem como "Em breve" e chegam nas próximas fases. Veja o plano completo em [`PLANO-VALENDO.md`](PLANO-VALENDO.md).

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
js/core/              lógica pura, sem DOM e sem rede: buzzer, placar, sorteio, cronômetro e equipes
js/audio/             sons gerados com WebAudio
js/storage/           IndexedDB (turmas e sessões) e preferências
assets/               ícones e fontes locais
tests/                testes com node --test
```

Rotas: `#/` (início), `#/buzzer` (ajustes), `#/buzzer/jogar` (jogo; `?relampago` usa o padrão), `#/placar`, `#/sorteio`, `#/cronometro`, `#/equipes`, `#/turmas`, `#/ferramentas`, `#/sobre` (Sobre e créditos), `#/vitrine` (todos os componentes).

## Design system: "caderno neo-brutalista"

Fundo branco-papel, bordas pretas grossas, sombra sólida deslocada e cores vivas. Cada modalidade é uma pasta com aba colorida. Títulos manuscritos (Caveat), corpo em Space Grotesk, laranja escuro para ações e azul escuro para informação. Botões "afundam" ao apertar. Modo escuro "quadro-negro" automático ou manual (botão no cabeçalho).

Acessibilidade: contraste AA, alvos de toque de 48px, foco visível em laranja, respeito a `prefers-reduced-motion` e tamanhos em `rem` (acompanham o tamanho de texto do sistema).

## Privacidade

Sem contas, sem analytics, sem coleta. Tudo fica no aparelho.

## Créditos e autor

Criado por **Francisco Audir** — Instagram [@filho.af](https://instagram.com/filho.af).

Repositório: <https://github.com/Francisco12-cpu/valendo>

Fontes [Caveat](https://fonts.google.com/specimen/Caveat) e [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk), sob a SIL Open Font License (cópias das licenças em `assets/fonts/`).

## Licença

[MIT](LICENSE) — use, copie e adapte à vontade.
