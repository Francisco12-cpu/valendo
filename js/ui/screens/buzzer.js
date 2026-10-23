// #/buzzer — ajustes antes de jogar. Tudo é salvo no aparelho na hora.
import { h, svg } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { MAX_JOGADORES, MIN_JOGADORES } from '../../core/buzzer.js';
import { lerAjustes, salvarAjustes, ajustesPadrao, nomePadrao, CORES_JOGADORES, rotuloTecla, TECLAS_RESERVADAS } from '../buzzer-ajustes.js';
import { Escolha } from '../components/escolha.js';
import { Stepper } from '../components/stepper.js';
import { Switch } from '../components/switch.js';
import { Botao, ativarAfundar } from '../components/botao.js';
import { toast } from '../components/toast.js';
import { icones } from '../components/icones.js';

export const titulo = () => t('buzzer.titulo');

export function render(alvo) {
  let ajustes = lerAjustes();
  const mudar = (parcial) => {
    ajustes = { ...ajustes, ...parcial };
    salvarAjustes(ajustes);
    atualizarVisibilidade();
  };

  // ---------- Jogadores ----------
  const listaNomes = h('ol', { class: 'buzzer-nomes', role: 'list' });
  function desenharNomes() {
    listaNomes.replaceChildren(
      ...Array.from({ length: ajustes.quantidade }, (_, i) => {
        const campo = h('input', {
          class: 'campo',
          type: 'text',
          maxlength: 24,
          autocomplete: 'off',
          placeholder: nomePadrao(i),
          'aria-label': t('buzzer.nomeDoJogador', { n: i + 1 }),
        });
        campo.value = ajustes.nomes[i] || '';
        campo.addEventListener('input', () => {
          const nomes = [...ajustes.nomes];
          nomes[i] = campo.value;
          mudar({ nomes });
        });
        return h('li', { class: 'buzzer-nomes__item' }, h('span', { class: 'buzzer-nomes__cor', style: { background: CORES_JOGADORES[i] }, 'aria-hidden': 'true' }, String(i + 1)), campo);
      })
    );
  }
  desenharNomes();

  const quantidade = Stepper({
    rotulo: t('buzzer.quantidade'),
    valor: ajustes.quantidade,
    min: MIN_JOGADORES,
    max: MAX_JOGADORES,
    aoMudar: (v) => {
      mudar({ quantidade: v });
      desenharNomes();
      desenharTeclas();
    },
  });

  // ---------- Regras ----------
  const metodo = Escolha({
    rotulo: t('buzzer.metodo'),
    valor: ajustes.metodo,
    aoMudar: (v) => mudar({ metodo: v }),
    opcoes: [
      { valor: 'B', texto: t('buzzer.metodoB'), descricao: t('buzzer.metodoBDesc') },
      { valor: 'A', texto: t('buzzer.metodoA'), descricao: t('buzzer.metodoADesc') },
    ],
  });

  const contagem = Stepper({ rotulo: t('buzzer.contagemSegundos'), valor: ajustes.contagem, min: 1, max: 10, aoMudar: (v) => mudar({ contagem: v }) });
  const gatilho = Escolha({
    rotulo: t('buzzer.gatilho'),
    valor: ajustes.gatilho,
    aoMudar: (v) => mudar({ gatilho: v }),
    opcoes: [
      { valor: 'aleatorio', texto: t('buzzer.gatilhoAleatorio'), descricao: t('buzzer.gatilhoAleatorioDesc') },
      { valor: 'contagem', texto: t('buzzer.gatilhoContagem'), descricao: t('buzzer.gatilhoContagemDesc') },
      { valor: 'manual', texto: t('buzzer.gatilhoManual'), descricao: t('buzzer.gatilhoManualDesc') },
    ],
  });

  const sinal = Escolha({
    rotulo: t('buzzer.sinal'),
    valor: ajustes.sinal,
    compacta: true,
    aoMudar: (v) => mudar({ sinal: v }),
    opcoes: [
      { valor: 'ambos', texto: t('buzzer.sinalAmbos') },
      { valor: 'visual', texto: t('buzzer.sinalVisual') },
      { valor: 'som', texto: t('buzzer.sinalSom') },
    ],
  });

  const penalidade = Stepper({ rotulo: t('buzzer.penalidadeMs'), valor: ajustes.penalidadeMs, min: 100, max: 3000, passo: 100, aoMudar: (v) => mudar({ penalidadeMs: v }) });
  const queima = Escolha({
    rotulo: t('buzzer.queima'),
    valor: ajustes.queima,
    aoMudar: (v) => mudar({ queima: v }),
    opcoes: ['aviso', 'anular', 'penalidade', 'eliminar', 'professor'].map((r) => ({
      valor: r,
      texto: t(`buzzer.queima.${r}`),
      descricao: t(`buzzer.queima.${r}Desc`),
    })),
  });

  const margem = Stepper({ rotulo: t('buzzer.margem'), valor: ajustes.margemEmpateMs, min: 0, max: 100, passo: 5, aoMudar: (v) => mudar({ margemEmpateMs: v }) });

  const mesa = Switch({ rotulo: t('buzzer.mesa'), ligado: ajustes.mesa, aoMudar: (v) => mudar({ mesa: v }) });
  const som = Switch({ rotulo: t('buzzer.som'), ligado: ajustes.som, aoMudar: (v) => mudar({ som: v }) });

  // ---------- Método D: teclas ----------
  const listaTeclas = h('ol', { class: 'buzzer-nomes', role: 'list' });
  let ouvindo = null; // { i, botao, parar }
  function desenharTeclas() {
    listaTeclas.replaceChildren(
      ...Array.from({ length: ajustes.quantidade }, (_, i) => {
        const nome = (ajustes.nomes[i] || '').trim() || nomePadrao(i);
        const botao = h('button', { type: 'button', class: 'botao tecla', 'aria-label': t('buzzer.teclaDe', { nome, tecla: rotuloTecla(ajustes.teclas[i]) }) }, h('kbd', null, rotuloTecla(ajustes.teclas[i])));
        botao.addEventListener('click', () => capturar(i, botao, nome));
        return h('li', { class: 'buzzer-nomes__item' }, h('span', { class: 'buzzer-nomes__cor', style: { background: CORES_JOGADORES[i] }, 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'tecla__nome' }, nome), botao);
      })
    );
  }

  function capturar(i, botao, nome) {
    ouvindo?.parar();
    botao.querySelector('kbd').textContent = t('buzzer.aperteTecla');
    botao.setAttribute('aria-label', t('buzzer.aperteTeclaPara', { nome }));
    const aoTeclar = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') return parar();
      if (TECLAS_RESERVADAS.includes(e.code)) {
        toast(t('buzzer.teclaReservada', { tecla: rotuloTecla(e.code) }), { tipo: 'aviso' });
        return;
      }
      const teclas = [...ajustes.teclas];
      const outro = teclas.indexOf(e.code);
      if (outro >= 0 && outro !== i) teclas[outro] = teclas[i]; // troca, sem repetir tecla
      teclas[i] = e.code;
      mudar({ teclas });
      parar();
    };
    const parar = () => {
      document.removeEventListener('keydown', aoTeclar, true);
      ouvindo = null;
      desenharTeclas();
      listaTeclas.querySelectorAll('.tecla')[i]?.focus();
    };
    document.addEventListener('keydown', aoTeclar, true);
    ouvindo = { parar };
  }
  desenharTeclas();

  const teclado = Switch({ rotulo: t('buzzer.teclado'), ligado: ajustes.teclado, aoMudar: (v) => mudar({ teclado: v }) });
  const blocoTeclas = h('div', { class: 'pilha' }, h('p', { class: 'texto-suave buzzer-dica' }, t('buzzer.tecladoDica')), listaTeclas);

  function atualizarVisibilidade() {
    contagem.hidden = ajustes.gatilho !== 'contagem';
    penalidade.hidden = ajustes.queima !== 'penalidade';
    blocoTeclas.hidden = !ajustes.teclado;
  }
  atualizarVisibilidade();

  const jogar = h('a', { class: 'botao botao--primario botao--grande', href: '#/buzzer/jogar' }, svg(icones.buzzer), h('span', null, t('buzzer.jogar')));
  ativarAfundar(jogar);

  const restaurar = Botao({
    texto: t('buzzer.restaurar'),
    variante: 'fantasma',
    aoClicar: () => {
      salvarAjustes(ajustesPadrao());
      alvo.replaceChildren();
      render(alvo);
      toast(t('buzzer.restaurado'), { tipo: 'sucesso' });
    },
  });

  const bloco = (id, tituloBloco, ...filhos) =>
    h('section', { class: 'cartao buzzer-bloco', 'aria-labelledby': id }, h('h2', { id }, tituloBloco), ...filhos);

  alvo.append(
    h(
      'div',
      { class: 'tela__topo buzzer-topo' },
      h('div', null, h('h1', { tabindex: '-1' }, t('buzzer.titulo')), h('p', { class: 'tela__subtitulo' }, t('buzzer.subtitulo'))),
      jogar
    ),
    h(
      'div',
      { class: 'buzzer-ajustes' },
      bloco('bz-jogadores', t('buzzer.blocoJogadores'), quantidade, listaNomes),
      bloco('bz-resposta', t('buzzer.blocoResposta'), metodo, h('div', { class: 'pilha' }, mesa, som, teclado), blocoTeclas),
      bloco('bz-largada', t('buzzer.blocoLargada'), gatilho, contagem, sinal),
      bloco('bz-justica', t('buzzer.blocoJustica'), queima, penalidade, margem, h('p', { class: 'texto-suave buzzer-dica' }, t('buzzer.margemDica')))
    ),
    h('div', { class: 'linha buzzer-rodape' }, jogar.cloneNode(true), restaurar)
  );
  ativarAfundar(alvo.querySelector('.buzzer-rodape .botao'));
  return () => ouvindo?.parar();
}
