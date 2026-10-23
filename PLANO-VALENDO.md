# VALENDO! — Plano de Desenvolvimento para Claude Code

> Ferramenta gratuita e de código aberto para professores e alunos.
> Criado por **Francisco Audir** — Instagram **[@filho.af](https://instagram.com/filho.af)**

Este documento é a fonte da verdade do projeto. Leia inteiro antes de escrever código.
Trabalhe **uma fase por vez**, cumprindo os critérios de aceite antes de avançar.

---

## 0. Regra de ouro

**O buzzer (quem aperta/solta primeiro) precisa SEMPRE funcionar**: offline, em um aparelho só, sem internet, sem conta, em celular velho. Nenhuma fase pode quebrar isso. Tudo o mais é extra.

## 1. Visão

O Valendo! é uma caixa de ferramentas de sala de aula, como um quadro ou um cronômetro. O professor monta a atividade do jeito que quiser, combinando **blocos**:

| Bloco | Exemplos de uso |
|---|---|
| Buzzer | Quem responde primeiro, com detecção de queima de largada |
| Placar | Pontos manuais por equipe |
| Sorteador | Aluno ou equipe, sem repetir |
| Cronômetro | Regressivo, por rodada ou por estação |
| Pergunta | Vários tipos (ver §8) |
| Equipes | Montagem manual, aleatória ou equilibrada |
| Rotação | Prova em espiral / estações |

Uma **atividade** é uma configuração (JSON) desses blocos. Modalidades prontas como Quiz, Passa ou Repassa e Prova em Espiral são apenas **presets** desses blocos.

## 2. Plataformas

- Celular, tablet e computador, nas orientações retrato e paisagem
- Mobile-first, com breakpoints em ~600px (tablet) e ~1024px (desktop/projetor)
- Toque, mouse e teclado (atalhos: Espaço = largada, setas = navegar, F = tela cheia)
- PWA instalável e com funcionamento offline (Service Worker com cache de todo o app)
- Alvo de desempenho: carregar em menos de 2s em 3G e rodar liso em Android de entrada

## 3. Stack e decisões técnicas

- **HTML, CSS e JavaScript puro com ES Modules**, sem framework e sem etapa de build. O GitHub Pages serve os arquivos direto.
- Dependências só por arquivo local em `/vendor` (nada de CDN obrigatória, para o app funcionar offline):
  - `peerjs` (WebRTC)
  - `qrcode` (gerar QR)
  - `jsQR` (ler QR / cartões pela câmera, a partir da Fase 6)
- **Armazenamento:** IndexedDB para atividades, turmas e resultados, e localStorage só para preferências. Sempre usar try/catch.
- **Sem contas na v1.** Os dados ficam no aparelho, com exportação/importação em `.valendo.json`.
- **Licença:** MIT. Créditos ao autor no README, no rodapé e na tela "Sobre".

## 4. Estrutura de pastas

```
/
├── index.html              # shell do app (SPA com hash router)
├── 404.html                # "folha arrancada do caderno"
├── manifest.webmanifest
├── sw.js                   # service worker
├── /css
│   ├── tokens.css          # cores, fontes, espaçamentos, sombras
│   ├── base.css
│   └── components.css
├── /js
│   ├── app.js              # boot + router
│   ├── /core               # lógica pura, SEM DOM (testável)
│   │   ├── clock.js        # tempo monotônico + sincronização
│   │   ├── buzzer.js       # máquina de estados do buzzer
│   │   ├── scoring.js
│   │   ├── timer.js
│   │   ├── teams.js
│   │   ├── rotation.js     # prova em espiral
│   │   ├── activity.js     # schema + validação + migração de versão
│   │   └── questions/      # um arquivo por tipo de questão (plugin)
│   ├── /net
│   │   ├── transport.js    # interface comum
│   │   ├── peer-online.js  # PeerJS com sinalização pela internet
│   │   ├── peer-qr.js      # WebRTC com sinalização manual via QR (sem internet)
│   │   ├── local-server.js # cliente do servidor local (opcional)
│   │   └── protocol.js     # mensagens, ids, deduplicação
│   ├── /ui
│   │   ├── components/     # botão, cartão-pasta, modal, toast, post-it...
│   │   └── screens/        # home, buzzer, placar, editor, sala, resultados...
│   ├── /storage            # IndexedDB
│   └── /audio              # sons gerados com WebAudio (sem arquivos pesados)
├── /server                 # servidor local opcional (Node, 1 arquivo)
│   └── valendo-server.js
├── /vendor
├── /assets                 # ícones SVG, mascote, fontes locais
├── /tests                  # testes de /core (node --test)
├── README.md
├── LICENSE
└── PLANO-VALENDO.md
```

**Regra:** `/core` nunca toca no DOM nem na rede. A UI e a rede só conversam com o `/core` por funções e eventos.

## 5. Design system ("caderno neo-brutalista")

### Referências
- **Base:** fundo branco, cartões quadrados com borda preta grossa, sombra sólida deslocada e cores vivas. Cada modalidade é uma **pasta com aba colorida**.
- **Toques de caderno:** títulos manuscritos, setinhas desenhadas, marca-texto atrás de palavras e post-its. Usar como enfeite, não na interface inteira.
- **Destaques:** laranja escuro para ações e azul escuro para informação e estado.
- **Contraste:** elementos bem recortados, com ilustração de traço preto simples.

### Tokens (`tokens.css`)
```css
:root {
  --papel: #FFFDF7;  --tinta: #141414;  --linha-caderno: #DCE6F5;
  --laranja: #D9531E;  --azul: #1E3A8A;
  --amarelo: #FFD23F;  --verde: #3DBE5A;  --rosa: #FF5C8A;
  --roxo: #7B61FF;  --ciano: #3FC1E0;  --lima: #B5E03F;
  --borda: 2.5px solid var(--tinta);
  --sombra: 4px 4px 0 var(--tinta);
  --sombra-press: 1px 1px 0 var(--tinta);
  --raio: 14px;
  --fonte-titulo: "Caveat", "Patrick Hand", cursive;
  --fonte-corpo: "Space Grotesk", "Inter", system-ui, sans-serif;
}
```
- Fontes servidas localmente em `/assets/fonts` (para funcionar offline)
- Ao apertar um botão, ele "afunda": `translate(3px,3px)` e troca para `--sombra-press`
- Cores por modalidade: Buzzer = amarelo, Placar = verde, Sorteio = ciano, Quiz = laranja, Passa ou Repassa = rosa, Espiral = roxo, Provas = azul, Ferramentas = lima
- **Modo escuro:** "quadro-negro" (fundo #1F2A24, tinta de giz branca), seguindo `prefers-color-scheme` e com opção manual
- **Acessibilidade:** contraste AA, `prefers-reduced-motion`, alvos de toque de no mínimo 48px, foco visível com contorno laranja, tamanho de texto ajustável e todo som com um equivalente visual
- **Mascote:** ainda em definição (possivelmente um macaco). Deixe um `<slot>`/componente `Mascote` trocável, usado na 404, no carregamento, nos estados vazios e na vitória.
- **Easter egg:** tocar 5 vezes no logo ativa o "modo bagunça" (confete e sons exagerados)

## 6. O buzzer (núcleo, Fase 1)

### Máquina de estados
`OCIOSO → PREPARANDO → ARMADO (espera aleatória) → VALENDO → RESULTADO`

### Precisão no mesmo aparelho
- Usar `pointerdown`/`pointerup` com `event.timeStamp` (mesma base do `performance.now()`), **não** o horário em que o handler rodou
- Multitoque: rastrear por `pointerId` e área. Usar `touch-action: none`, bloquear zoom, menu de contexto e seleção de texto.
- A largada é marcada no frame em que o sinal aparece (`requestAnimationFrame`), e o som é agendado no mesmo instante via WebAudio
- **Queima de largada:** ação antes do VALENDO, com a regra configurável (aviso, anular, penalidade, eliminar ou o professor decide)
- **Empate:** diferença menor que a margem configurável (padrão 10ms) conta como empate técnico, com opção de desempate
- **"Juiz de dúvida":** tela mostrando a ordem e a diferença em ms entre todos os participantes

### Métodos de resposta
- **A** — Segurar e soltar primeiro
- **B** — Apertar primeiro
- **C** — Cada um no seu aparelho (Fase 5)
- **D** — Tecla do teclado ou clicker por participante (por exemplo, A e L no PC)

### Layout
2 a 8 áreas que se reorganizam pela orientação. Com 2 jogadores, cada área fica de frente para um aluno (uma área girada 180°, para o celular deitado na mesa).

## 7. Rede e salas (Fase 5)

Uma interface única, `transport.js`, com três implementações intercambiáveis. **O aparelho do professor é sempre o HOST com autoridade**: é ele que valida tempo, pontos e trapaças. Os alunos só enviam ações.

| Modo | Precisa de internet? | Como funciona | Quando usar |
|---|---|---|---|
| **1. Online (padrão)** | Só um pouco, na hora de conectar | PeerJS: a sinalização vai pela internet, e o tráfego do jogo fica P2P direto pela rede local quando possível. Usa bem pouca banda. | Wi-Fi ruim, mas com algum acesso |
| **2. Sem internet (QR)** | Não | WebRTC com sinalização manual. O professor mostra um QR de convite, o aluno lê e mostra um QR de resposta, e o professor lê. Todos precisam estar no mesmo Wi-Fi ou no roteador do celular do professor. | Escola sem internet. Prático para poucos aparelhos, por exemplo um por equipe. |
| **3. Servidor local** | Não | O PC do professor roda `node valendo-server.js`, que serve o app e um WebSocket na rede local. Os alunos abrem `http://IP-do-PC:8080`. | Turma grande e sem internet |

### Limitações a documentar no README e mostrar na interface
- Alguns roteadores escolares bloqueiam a comunicação entre aparelhos (isolamento de clientes). Nesse caso, use o **ponto de acesso do celular do professor**.
- Pela rede, a ordem é justa, mas não física e perfeita. A margem de empate é maior (padrão 30ms) e configurável.

### Sincronização de relógio
Ao entrar, cada cliente faz cerca de 8 pings, calcula o deslocamento (`offset`) e o tempo de ida e volta (RTT) e guarda a mediana. Cada ação é enviada como `{id, tipo, tLocal, tHost=tLocal+offset}`. O host ordena pelo `tHost`, deduplica pelo `id` e rejeita ações fora da janela.

### Protocolo
Mensagens JSON com `v` (versão), `id` único, `seq` e `tipo`. Exemplos: `entrar`, `estado`, `acao`, `ack`, `ping`/`pong`.
- Reconexão automática com o mesmo `clientId`, guardado em sessionStorage, sem duplicar pontos
- O host envia o **estado completo** a quem reconecta
- As respostas corretas **nunca** são enviadas ao aluno antes da revelação
- Código da sala com 6 caracteres aleatórios e sem ambiguidade (sem 0/O nem 1/I), mais QR Code
- O professor pode trancar a sala, remover alunos e ver o sinal de conexão de cada um (verde, amarelo ou vermelho)

## 8. Modelo de dados

```json
{
  "schema": 1,
  "id": "uuid",
  "titulo": "Revisão Citologia",
  "modalidade": "quiz | buzzer | passa-repassa | espiral | prova | personalizada",
  "blocos": { "...configurações de cada bloco..." },
  "conteudo": {
    "perguntas": [
      { "id": "q1", "tipo": "multipla", "enunciado": "...", "midia": null,
        "opcoes": [{ "id": "a", "texto": "...", "correta": true }],
        "pontos": 1000, "tempo": 20, "explicacao": "...", "tags": ["citologia"] }
    ]
  },
  "regras": { "pontuacao": {}, "tempo": {}, "fimDoTempo": "travar-e-salvar" },
  "exibicao": { "pergunta": "projetor+alunos", "ranking": "top5" },
  "criadoEm": "...", "atualizadoEm": "..."
}
```
- `activity.js` traz `validar()` e `migrar(schemaAntigo)`, para que versões novas nunca quebrem atividades antigas
- **Tipos de questão como plugins** em `core/questions/`: cada um exporta `{tipo, schema, corrigir(resposta), Editor, Visor}`
- Tipos da v1: múltipla escolha (uma ou várias corretas), verdadeiro ou falso, resposta curta (com variações aceitas), numérica (com tolerância e unidade), enquete e "slide" (sem resposta)
- Tipos depois: lacunas, associação, ordenação, desenho, marcar na imagem, resposta oral, envio de arquivo, nuvem de palavras e escala

## 9. Fases (com critérios de aceite)

### Fase 0 — Fundação
- Estrutura de pastas, tokens, componentes base (botão, cartão-pasta, modal, toast, post-it, switch e stepper), router, página 404, tela "Sobre/Créditos", README, LICENSE, manifest e service worker
- Página `#/vitrine` mostrando todos os componentes
- ✅ Abre offline depois da primeira visita, tem nota 90+ no Lighthouse em mobile e fica correto em 360px, 768px e 1440px

### Fase 1 — Buzzer (a regra de ouro)
- Métodos A e B, de 2 a 8 participantes, largada (contagem, som, visual, manual, aleatória), queima de largada, empate, resultado, reinício rápido e Juiz de dúvida
- **Modo "Valendo relâmpago":** um toque na home e o buzzer abre com 2 jogadores e o padrão já aplicado
- ✅ Testes de `/core/buzzer.js` cobrindo queima, empate e multitoque. Funciona com dois dedos ao mesmo tempo em Android e iOS, e o tablet deitado na mesa funciona para os dois lados.

### Fase 2 — Ferramentas rápidas
- Placar manual por equipe (com desfazer), sorteador sem repetição (com chamada rápida de presença), cronômetro grande para o projetor, gerador de equipes (manual, aleatório ou equilibrado) e turmas salvas
- Método D (teclado ou clicker)
- ✅ Tudo funciona offline e os dados persistem após recarregar a página

### Fase 3 — Editor de atividades e banco de questões
- Criar, duplicar, editar uma cópia, favoritar, buscar por tag, disciplina ou dificuldade, e exportar ou importar `.valendo.json` e CSV
- **Colar texto e converter:** o professor cola "1) Enunciado / a) ... b) ... * marca a correta" e o sistema monta as questões
- Configuração em três níveis (básica, avançada e personalizada), mostrando só o que é relevante para a modalidade
- Pré-visualização e modo de teste
- ✅ Uma atividade criada na versão do schema 1 continua abrindo após uma migração simulada

### Fase 4 — Quiz em um aparelho e no projetor
- Fluxo estilo Kahoot no projetor: pergunta, tempo, distribuição das respostas, revelação, explicação, ranking (completo, top 5 ou oculto) e pódio
- Pontos por velocidade (opcional), pontos dobrados ou zero por pergunta, sequência de acertos e embaralhamento
- **Modo controle remoto:** o celular do professor controla o projetor (exige a Fase 5, então deixe preparado)
- **Passa ou Repassa:** equipes, passa e repassa com regras de pontos configuráveis e penalidade visual ("torta" animada)
- ✅ Uma partida completa de 10 perguntas roda sem nenhuma conexão

### Fase 5 — Salas conectadas
- `transport.js` com o modo 1 (online) primeiro, depois o 2 (QR) e o 3 (servidor local)
- Lobby com nomes, gerador de apelidos e filtro de nomes ofensivos
- Buzzer método C, quiz com respostas no celular, modo no seu ritmo e reconexão
- ✅ 30 clientes simulados (abas) sem pontos duplicados; o celular desconectado volta e recupera o estado; e as respostas não aparecem no tráfego antes da revelação

### Fase 6 — Prova em Espiral e provas
- **Rotação:** N grupos × M provas, tempo por rodada (ou por prova), sentido do giro, grupo em pausa quando N > M, aviso antes do fim, prorrogação, pausa geral e avanço manual
- **Opção "a prova anda, o grupo fica":** o aparelho fica na mesa e o conteúdo troca
- No fim do tempo: trava, salva e marca questões em branco
- Grade final grupo × prova, correção automática e manual, comentários e exportação
- Provas individuais, com horário, limite de tempo, embaralhamento por aluno e tempo extra individual
- ✅ Simulação de 5×5 com 5 minutos gera a grade completa, mesmo com uma queda de conexão no meio

### Fase 7 — Extras
- Cartões impressos estilo Plickers (PDF para imprimir e leitura pela câmera)
- Relatórios com gráficos (acertos por questão, desempenho por grupo, questões mais erradas) e "refazer as erradas"
- Exportar o resultado como imagem, sequência de modalidades numa sessão, modo professor ausente, roleta de temas, enquete, nuvem de palavras e compartilhamento de atividade por link ou QR

## 10. Configurações globais
Idioma (pt-BR primeiro, com textos em arquivo de tradução desde o começo), tema (claro, quadro-negro ou automático), tamanho do texto, volume e mudo, animações reduzidas, alto contraste, padrões de atividade e "restaurar padrões".

## 11. Anti-trapaça (dentro do possível)
- O host valida tudo: se a pergunta está aberta, se o tempo acabou, se é resposta única e se o `clientId` é conhecido
- Gabarito só sai do host depois da revelação
- Código de sala aleatório, sala trancável e log de eventos para o professor auditar e corrigir
- Documentar que, em um aparelho só, quem tem o aparelho tem o controle

## 12. Privacidade
Sem coleta, sem analytics e sem contas. Nomes de alunos só no aparelho do professor. A exportação é decisão do professor.

## 13. Créditos (obrigatório)
- Rodapé da home: "Feito por Francisco Audir · @filho.af" (link para o Instagram)
- Tela "Sobre" com nome, Instagram, link do repositório e licença
- README com uma seção de autor

## 14. Qualidade
- Testes de `/core` com `node --test`, rodando a cada fase
- Checklist manual por fase: Android barato, iPhone, tablet, PC e projetor 1280×720
- Commits pequenos com mensagens em português; atualizar o README a cada fase

---

## Prompt inicial sugerido para o Claude Code

> Leia `PLANO-VALENDO.md` inteiro. Execute apenas a **Fase 0**, seguindo a estrutura de pastas, os tokens de design e os critérios de aceite. Não adiante funcionalidades de outras fases. Ao terminar, liste o que foi feito, como testar e o que ficou pendente.

Depois, repita trocando para a próxima fase.
