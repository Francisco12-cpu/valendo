// #/equipes — gerador de equipes: aleatório, equilibrado (por nível) e ajuste manual.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import { dividir, mover, somaNiveis } from '../../core/teams.js';
import { criarPlacar } from '../../core/scoring.js';
import { ler, salvar } from '../../storage/db.js';
import { CORES_JOGADORES } from '../buzzer-ajustes.js';
import { FonteDeNomes } from '../components/fonte-nomes.js';
import { Escolha } from '../components/escolha.js';
import { Stepper } from '../components/stepper.js';
import { Botao } from '../components/botao.js';
import { toast } from '../components/toast.js';
import { ModoProjetor } from '../components/projetor.js';

export const titulo = () => t('equipes.titulo');
const SESSAO = 'equipes';

export function render(alvo) {
  let alunos = [];
  let ajustes = { modo: 'aleatorio', por: 'quantidade', quantidade: 2, tamanho: 4 };
  let fonte = { turmaId: '', texto: '' };
  let equipes = [];
  let selecionado = null; // aluno escolhido para mover
  const projetor = ModoProjetor();

  const guardar = () => salvar('sessoes', { id: SESSAO, ajustes, fonte, equipes });
  const nomeEquipe = (i) => t('equipes.equipeN', { n: i + 1 });

  const resultado = h('div', { class: 'equipes-resultado', 'aria-live': 'polite' });
  const btnGerar = Botao({ texto: t('equipes.gerar'), variante: 'primario', tamanho: 'grande', icone: 'sorteio', aoClicar: () => gerar() });
  const btnPlacar = Botao({ texto: t('equipes.usarPlacar'), icone: 'placar', aoClicar: () => usarNoPlacar() });
  const btnCopiar = Botao({ texto: t('equipes.copiar'), aoClicar: () => copiar() });
  const dicaMover = h('p', { class: 'texto-suave equipes-dica' });

  function gerar() {
    if (alunos.length < 2) {
      toast(t('equipes.poucos'), { tipo: 'aviso' });
      return;
    }
    const opcoes = ajustes.por === 'tamanho' ? { tamanho: ajustes.tamanho } : { quantidade: ajustes.quantidade };
    equipes = dividir(alunos, { ...opcoes, modo: ajustes.modo });
    selecionado = null;
    guardar();
    desenhar();
  }

  function usarNoPlacar() {
    if (!equipes.length) return;
    const placar = criarPlacar(equipes.slice(0, 8).map((_, i) => ({ nome: nomeEquipe(i), cor: CORES_JOGADORES[i] })));
    salvar('sessoes', { id: 'placar', placar }).then(() => (location.hash = '#/placar'));
  }

  async function copiar() {
    const texto = equipes.map((eq, i) => `${nomeEquipe(i)}: ${eq.map((a) => a.nome).join(', ')}`).join('\n');
    try {
      await navigator.clipboard.writeText(texto);
      toast(t('equipes.copiado'), { tipo: 'sucesso' });
    } catch {
      toast(t('equipes.naoCopiou'), { tipo: 'erro' });
    }
  }

  function desenhar() {
    btnPlacar.disabled = btnCopiar.disabled = !equipes.length;
    dicaMover.textContent = !equipes.length ? '' : selecionado ? t('equipes.escolhaDestino', { nome: selecionado.nome }) : t('equipes.dicaMover');
    resultado.replaceChildren(
      ...equipes.map((eq, i) =>
        h(
          'section',
          { class: 'equipe', style: { '--cor': CORES_JOGADORES[i % CORES_JOGADORES.length] }, 'aria-label': nomeEquipe(i) },
          h(
            'div',
            { class: 'equipe__topo' },
            h('h3', { class: 'manuscrito' }, nomeEquipe(i)),
            h('span', { class: 'etiqueta' }, ajustes.modo === 'equilibrado' ? t('equipes.resumoNivel', { n: eq.length, soma: somaNiveis(eq) }) : t('equipes.resumo', { n: eq.length }))
          ),
          h(
            'ul',
            { class: 'equipe__alunos', role: 'list' },
            eq.map((aluno) => {
              const botao = h('button', { type: 'button', class: 'equipe__aluno', 'aria-pressed': String(selecionado?.id === aluno.id) }, aluno.nome);
              botao.addEventListener('click', () => {
                selecionado = selecionado?.id === aluno.id ? null : aluno;
                desenhar();
              });
              return h('li', null, botao);
            })
          ),
          selecionado && !eq.some((a) => a.id === selecionado.id)
            ? Botao({
                texto: t('equipes.moverPara', { nome: selecionado.nome }),
                variante: 'amarelo',
                aoClicar: () => {
                  equipes = mover(equipes, selecionado.id, i);
                  selecionado = null;
                  guardar();
                  desenhar();
                },
              })
            : null
        )
      )
    );
  }

  ler('sessoes', SESSAO).then((sessao) => {
    if (sessao) {
      ajustes = { ...ajustes, ...sessao.ajustes };
      fonte = sessao.fonte ?? fonte;
      equipes = sessao.equipes ?? [];
    }
    const stQuantidade = Stepper({ rotulo: t('equipes.quantas'), valor: ajustes.quantidade, min: 2, max: 12, aoMudar: (v) => ((ajustes.quantidade = v), guardar()) });
    const stTamanho = Stepper({ rotulo: t('equipes.tamanho'), valor: ajustes.tamanho, min: 2, max: 20, aoMudar: (v) => ((ajustes.tamanho = v), guardar()) });
    const mostrarPor = () => {
      stQuantidade.hidden = ajustes.por !== 'quantidade';
      stTamanho.hidden = ajustes.por !== 'tamanho';
    };
    mostrarPor();

    alvo.append(
      h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, t('equipes.titulo')), h('p', { class: 'tela__subtitulo' }, t('equipes.subtitulo'))), projetor.botao),
      h(
        'div',
        { class: 'buzzer-ajustes' },
        h(
          'section',
          { class: 'cartao buzzer-bloco', 'aria-labelledby': 'eq-quem' },
          h('h2', { id: 'eq-quem' }, t('equipes.quem')),
          FonteDeNomes({
            turmaId: fonte.turmaId,
            texto: fonte.texto,
            aoMudar: (lista, origem) => {
              alunos = lista;
              fonte = origem;
              guardar();
            },
          })
        ),
        h(
          'section',
          { class: 'cartao buzzer-bloco', 'aria-labelledby': 'eq-como' },
          h('h2', { id: 'eq-como' }, t('equipes.como')),
          Escolha({
            rotulo: t('equipes.modo'),
            valor: ajustes.modo,
            aoMudar: (v) => ((ajustes.modo = v), guardar()),
            opcoes: [
              { valor: 'aleatorio', texto: t('equipes.aleatorio'), descricao: t('equipes.aleatorioDesc') },
              { valor: 'equilibrado', texto: t('equipes.equilibrado'), descricao: t('equipes.equilibradoDesc') },
            ],
          }),
          Escolha({
            rotulo: t('equipes.dividirPor'),
            valor: ajustes.por,
            compacta: true,
            aoMudar: (v) => ((ajustes.por = v), mostrarPor(), guardar()),
            opcoes: [
              { valor: 'quantidade', texto: t('equipes.porQuantidade') },
              { valor: 'tamanho', texto: t('equipes.porTamanho') },
            ],
          }),
          h('div', { class: 'linha' }, stQuantidade, stTamanho)
        )
      ),
      h('div', { class: 'linha buzzer-rodape' }, btnGerar, btnPlacar, btnCopiar),
      h('section', { class: 'secao', 'aria-labelledby': 'eq-resultado' }, h('h2', { id: 'eq-resultado', class: 'secao__titulo' }, t('equipes.resultado')), dicaMover, resultado)
    );
    desenhar();
  });

  return () => projetor.sair();
}
