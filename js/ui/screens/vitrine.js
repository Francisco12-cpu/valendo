// #/vitrine: todos os componentes do design system em uma página.
import { h, svg } from '../dom.js';
import { t, tPartes } from '../../i18n/i18n.js';
import { Botao, ativarAfundar } from '../components/botao.js';
import { CartaoPasta } from '../components/pasta.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { PostIt } from '../components/postit.js';
import { Switch } from '../components/switch.js';
import { Stepper } from '../components/stepper.js';
import { Mascote } from '../components/mascote.js';
import { icones } from '../components/icones.js';

export const titulo = () => t('vitrine.titulo');

const CORES = ['papel', 'tinta', 'linha-caderno', 'laranja', 'azul', 'amarelo', 'verde', 'rosa', 'roxo', 'ciano', 'lima', 'acao', 'info', 'superficie'];

function secao(id, tituloSecao, ...conteudo) {
  return h('section', { class: 'secao', 'aria-labelledby': id }, h('h2', { id }, tituloSecao), ...conteudo);
}

export function render(alvo) {
  const amostras = h(
    'ul',
    { class: 'vitrine__cores', role: 'list' },
    CORES.map((cor) =>
      h('li', { class: 'vitrine__cor' }, h('span', { class: 'vitrine__amostra', style: { background: `var(--${cor})` } }), h('code', null, `--${cor}`))
    )
  );

  const botoes = h(
    'div',
    { class: 'linha' },
    Botao({ texto: t('vitrine.primario'), variante: 'primario' }),
    Botao({ texto: t('vitrine.secundario') }),
    Botao({ texto: t('vitrine.info'), variante: 'info' }),
    Botao({ texto: t('vitrine.amarelo'), variante: 'amarelo' }),
    Botao({ texto: t('vitrine.perigo'), variante: 'perigo' }),
    Botao({ texto: t('vitrine.fantasma'), variante: 'fantasma' }),
    Botao({ texto: t('vitrine.desativado'), desativado: true }),
    Botao({ icone: 'mais', rotulo: t('vitrine.icone') }),
    Botao({ texto: t('vitrine.grande'), variante: 'primario', tamanho: 'grande', icone: 'buzzer' })
  );

  const pastas = h(
    'ul',
    { class: 'grade-pastas', role: 'list' },
    h('li', null, CartaoPasta({ titulo: t('vitrine.pastaAtiva'), aba: 'Link', descricao: t('vitrine.pastaAtivaDesc'), cor: 'var(--cor-sorteio)', icone: 'sorteio', href: '#/vitrine' })),
    h(
      'li',
      null,
      CartaoPasta({
        titulo: t('modalidade.espiral'),
        aba: '06',
        descricao: t('modalidade.espiral.desc'),
        cor: 'var(--cor-espiral)',
        icone: 'espiral',
        desativado: true,
        etiqueta: t('inicio.emBreve'),
        aoClicarDesativado: () => toast(t('inicio.emBreveToast', { nome: t('modalidade.espiral') }), { tipo: 'aviso' }),
      })
    )
  );

  const botaoModal = Botao({
    texto: t('vitrine.abrirModal'),
    variante: 'primario',
    aoClicar: async () => {
      const valor = await abrirModal({
        titulo: t('vitrine.modalTitulo'),
        conteudo: t('vitrine.modalTexto'),
        acoes: [
          { texto: t('vitrine.modalCancelar'), valor: t('vitrine.modalCancelar') },
          { texto: t('vitrine.modalConfirmar'), variante: 'primario', valor: t('vitrine.modalConfirmar') },
        ],
      });
      toast(valor ? t('vitrine.modalResultado', { valor }) : t('vitrine.modalFechou'));
    },
  });

  const tiposToast = [
    ['info', 'info', 'toastInfo'],
    ['sucesso', 'info', 'toastSucesso'],
    ['aviso', 'amarelo', 'toastAviso'],
    ['erro', 'perigo', 'toastErro'],
  ];
  const toasts = h(
    'div',
    { class: 'linha' },
    tiposToast.map(([tipo, variante, chave]) =>
      Botao({ texto: t(`vitrine.${chave}`), variante: tipo === 'sucesso' ? undefined : variante, aoClicar: () => toast(t(`vitrine.${chave}Msg`), { tipo }) })
    )
  );

  const postits = h(
    'div',
    { class: 'vitrine__postits' },
    PostIt({ texto: t('vitrine.postit1') }),
    PostIt({ texto: t('vitrine.postit2'), cor: 'var(--rosa)', inclinacao: 2 }),
    PostIt({ texto: t('vitrine.postit3'), cor: 'var(--ciano)', inclinacao: -1 })
  );

  const switches = h(
    'div',
    { class: 'vitrine__coluna' },
    Switch({ rotulo: t('vitrine.switchSom'), ligado: true }),
    Switch({ rotulo: t('vitrine.switchContagem') })
  );

  const steppers = h(
    'div',
    { class: 'linha vitrine__steppers' },
    Stepper({ rotulo: t('vitrine.stepperJogadores'), valor: 2, min: 2, max: 8 }),
    Stepper({ rotulo: t('vitrine.stepperTempo'), valor: 20, min: 5, max: 120, passo: 5 })
  );

  const mascotes = h(
    'div',
    { class: 'pilha' },
    h('div', { class: 'linha' }, ['feliz', 'neutro', 'surpreso', 'triste'].map((humor) => Mascote({ humor, tamanho: '6rem', rotulo: t(`humor.${humor}`) }))),
    h('p', { class: 'texto-suave' }, t('vitrine.mascoteNota'))
  );

  const enfeites = h(
    'div',
    { class: 'linha' },
    h('span', { class: 'etiqueta' }, t('inicio.emBreve')),
    h('span', { class: 'etiqueta', style: { background: 'var(--verde)', color: 'var(--tinta-fixa)', 'border-color': 'var(--tinta-fixa)' } }, t('vitrine.online')),
    h('span', { class: 'seta' }, svg(icones.seta)),
    h('span', { class: 'manuscrito', style: { 'font-size': '2rem' } }, t('vitrine.olhaAqui'))
  );

  const folha = h('a', { class: 'botao', href: '#/pagina-que-nao-existe' }, t('vitrine.folha'));

  alvo.append(
    h(
      'div',
      { class: 'tela__topo' },
      h('h1', { tabindex: '-1' }, t('vitrine.titulo')),
      h('p', { class: 'tela__subtitulo' }, t('vitrine.subtitulo'))
    ),
    secao('v-cores', t('vitrine.cores'), amostras),
    secao(
      'v-tipo',
      t('vitrine.tipografia'),
      h('p', { class: 'manuscrito', style: { 'font-size': 'var(--fs-titulo)', 'line-height': '1.1' } }, t('vitrine.tituloExemplo')),
      h('p', null, tPartes('vitrine.corpoExemplo', { marca: h('span', { class: 'marca-texto' }, t('vitrine.marcaTexto')) }))
    ),
    secao('v-botoes', t('vitrine.botoes'), h('p', { class: 'texto-suave', style: { 'margin-bottom': 'var(--esp-4)' } }, t('vitrine.botoesDica')), botoes),
    secao('v-pastas', t('vitrine.pastas'), pastas),
    secao('v-modal', t('vitrine.modal'), botaoModal),
    secao('v-toasts', t('vitrine.toasts'), toasts),
    secao('v-postits', t('vitrine.postits'), postits),
    secao('v-switches', t('vitrine.switches'), switches),
    secao('v-steppers', t('vitrine.steppers'), steppers),
    secao('v-mascote', t('vitrine.mascote'), mascotes),
    secao('v-enfeites', t('vitrine.etiquetas'), enfeites),
    secao('v-folha', t('vitrine.folha'), ativarAfundar(folha))
  );
}
