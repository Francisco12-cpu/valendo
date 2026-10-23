// Prova individual — lado do professor (host): configuração e acompanhamento em tempo real
// (status de cada aluno, tempo restante, tempo extra individual) e a grade no final.
import { h } from '../dom.js';
import { t } from '../../i18n/i18n.js';
import * as P from '../../core/prova.js';
import { perguntaSemGabarito } from '../../core/quiz.js';
import { formatarRelogio } from '../../core/timer.js';
import { salvar } from '../../storage/db.js';
import { novoId } from '../../core/ids.js';
import { Stepper } from '../components/stepper.js';
import { Switch } from '../components/switch.js';
import { Escolha } from '../components/escolha.js';
import { Botao } from '../components/botao.js';
import { abrirModal } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { Grade } from '../components/grade.js';

const agora = () => performance.now();
const MIN = 60000;

export function configProva() {
  const valores = { minutos: 50, inicio: 'agora', horario: '', embaralharPerguntas: true, embaralharOpcoes: true };
  const campoHora = h('input', { type: 'time', id: 'prova-horario', class: 'campo campo--hora' });
  const blocoHora = h('div', { class: 'pilha pilha--justa' }, h('label', { for: 'prova-horario', class: 'rotulo' }, t('provaInd.horario')), campoHora);
  blocoHora.hidden = true;
  campoHora.addEventListener('input', () => (valores.horario = campoHora.value));
  const el = h(
    'div',
    { class: 'pilha' },
    Stepper({ rotulo: t('provaInd.minutos'), valor: valores.minutos, min: 1, max: 240, passo: 5, aoMudar: (v) => (valores.minutos = v) }),
    Escolha({
      rotulo: t('provaInd.comeca'),
      valor: 'agora',
      compacta: true,
      aoMudar: (v) => {
        valores.inicio = v;
        blocoHora.hidden = v !== 'horario';
      },
      opcoes: [
        { valor: 'agora', texto: t('provaInd.agora') },
        { valor: 'horario', texto: t('provaInd.noHorario') },
      ],
    }),
    blocoHora,
    Switch({ rotulo: t('provaInd.embaralharPerguntas'), ligado: true, aoMudar: (v) => (valores.embaralharPerguntas = v) }),
    Switch({ rotulo: t('provaInd.embaralharOpcoes'), ligado: true, aoMudar: (v) => (valores.embaralharOpcoes = v) })
  );
  return { el, valores };
}

// "14:30" de hoje → instante no relógio do host (performance.now).
function horarioParaHost(hhmm) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const alvo = new Date();
  alvo.setHours(hh, mm, 0, 0);
  return agora() + Math.max(0, alvo.getTime() - Date.now());
}

export function jogarProva(alvo, host, config, atividade, participantes, extraTopo) {
  const inicioEm = config.inicio === 'horario' && config.horario ? horarioParaHost(config.horario) : agora();
  let p = P.criarProva(atividade, { duracaoMs: config.minutos * MIN, inicioEm, embaralharPerguntas: config.embaralharPerguntas, embaralharOpcoes: config.embaralharOpcoes });
  for (const x of participantes) p = P.entrarNaProva(p, x.id);
  const nomes = () => Object.fromEntries(Object.values(host.sala.clientes).map((c) => [c.clientId, c.nome]));
  const statusAnterior = {};
  let gradeEl = null;

  host.definirJogo({
    paraAluno: (id, tt) => P.paraAlunoProva(p, id, tt, perguntaSemGabarito),
    aoEntrar: (id) => {
      p = P.entrarNaProva(p, id);
      desenhar();
    },
    aoAcao: (id, acao, tHost, tChegada) => {
      // A estimativa do relógio do aluno pode recuar um pouco (anti-trapaça): se ela cair antes
      // do início mas a mensagem chegou depois dele, vale a chegada.
      const t0 = P.statusDe(p, id, tHost) === P.STATUS_ALUNO.AGUARDANDO && tChegada >= p.inicioEm ? tChegada : tHost;
      if (acao.tipo === 'prova-responder') {
        const res = P.responderProva(p, id, acao.qid, acao.resposta, t0);
        if (res.ok) p = res.p;
      } else if (acao.tipo === 'prova-entregar') p = P.entregar(p, id, t0);
      host.enviarEstado(id);
      desenhar();
    },
  });

  const tabela = h('div', { class: 'espiral__tabela' });
  const relogio = h('p', { class: 'espiral__relogio', role: 'timer' });
  const corpo = h('div', { class: 'pilha' });

  function desenhar() {
    if (gradeEl) return;
    const t0 = agora();
    const n = nomes();
    const total = p.perguntas.filter((q) => q.tipo !== 'slide' && q.tipo !== 'enquete').length;
    relogio.textContent = t0 < p.inicioEm ? t('provaInd.comecaEm', { tempo: formatarRelogio(p.inicioEm - t0, { paraCima: true }) }) : formatarRelogio(Math.max(0, p.inicioEm + p.duracaoMs - t0), { paraCima: true });
    tabela.replaceChildren(
      h(
        'table',
        { class: 'espiral__grupos' },
        h('thead', null, h('tr', null, [t('provaInd.aluno'), t('provaInd.situacao'), t('espiral.progresso'), t('provaInd.restante'), t('provaInd.extra')].map((c) => h('th', { scope: 'col' }, c)))),
        h(
          'tbody',
          null,
          Object.keys(p.alunos).map((id) => {
            const a = p.alunos[id];
            const st = P.statusDe(p, id, t0);
            const feitas = Object.keys(a.respostas).length;
            return h(
              'tr',
              { 'data-status': st },
              h('th', { scope: 'row' }, n[id] ?? id),
              h('td', null, t(`provaInd.status.${st}`)),
              h('td', null, h('span', { class: 'espiral__barra', style: { '--valor': total ? feitas / total : 0 } }, `${feitas}/${total}`)),
              h('td', null, st === P.STATUS_ALUNO.FAZENDO || st === P.STATUS_ALUNO.AGUARDANDO ? formatarRelogio(P.prazoDe(p, id) - Math.max(t0, p.inicioEm), { paraCima: true }) : '—'),
              h(
                'td',
                null,
                Botao({
                  texto: '+5 min',
                  rotulo: t('provaInd.darExtra', { nome: n[id] ?? id }),
                  desativado: st === P.STATUS_ALUNO.ENTREGUE,
                  aoClicar: () => {
                    p = P.darTempoExtra(p, id, 5 * MIN);
                    host.enviarEstado(id);
                    toast(t('provaInd.extraDado', { nome: n[id] ?? id }));
                    desenhar();
                  },
                }),
                a.extraMs ? h('span', { class: 'texto-suave' }, ` +${Math.round(a.extraMs / MIN)} min`) : null
              )
            );
          })
        )
      )
    );
  }

  function tique() {
    if (gradeEl) return;
    const t0 = agora();
    let mudou = false;
    for (const id of Object.keys(p.alunos)) {
      const st = P.statusDe(p, id, t0);
      if (statusAnterior[id] !== st) {
        statusAnterior[id] = st;
        host.enviarEstado(id); // avisa quem começou ou cujo tempo acabou
        mudou = true;
      }
    }
    desenhar();
    const todosAcabaram = Object.keys(p.alunos).every((id) => [P.STATUS_ALUNO.ENTREGUE, P.STATUS_ALUNO.ENCERRADA].includes(P.statusDe(p, id, t0)));
    if (todosAcabaram && Object.keys(p.alunos).length && !mudou) mostrarGrade();
  }

  function mostrarGrade() {
    if (gradeEl) return;
    p = P.encerrarTodos(p, agora());
    host.transmitirEstados();
    const linhas = () => P.gradeProva(p, nomes()).map((l) => ({ id: l.pid, nome: l.nome, celulas: [{ ...l, coluna: 'prova' }] }));
    gradeEl = Grade({
      titulo: atividade.titulo,
      rotuloLinha: t('provaInd.aluno'),
      colunas: [{ id: 'prova', titulo: atividade.titulo }],
      linhas: linhas(),
      aoCorrigir: (pid, _c, qid, valor) => {
        p = P.corrigirManualProva(p, pid, qid, valor);
        gradeEl.atualizar(linhas());
        guardar();
      },
      aoComentar: (pid, _c, texto) => {
        p = P.comentarProva(p, pid, texto);
        gradeEl.atualizar(linhas());
        guardar();
      },
    });
    corpo.replaceChildren(gradeEl);
    guardar();
  }

  const idResultado = novoId('res');
  const guardar = () => salvar('resultados', { id: idResultado, atividadeId: atividade.id, titulo: atividade.titulo, modalidade: 'prova', data: new Date().toISOString(), grade: P.gradeProva(p, nomes()) });

  corpo.append(
    h('div', { class: 'espiral__painel' }, h('div', { class: 'pilha' }, h('p', { class: 'etiqueta' }, t('provaInd.tempoGeral')), relogio), tabela),
    h(
      'div',
      { class: 'linha espiral__controles' },
      Botao({
        texto: t('provaInd.encerrar'),
        variante: 'perigo',
        aoClicar: async () => {
          const ok = await abrirModal({ titulo: t('provaInd.encerrarTitulo'), conteudo: t('provaInd.encerrarTexto'), acoes: [{ texto: t('vitrine.secundario'), valor: false }, { texto: t('provaInd.encerrar'), variante: 'perigo', valor: true }] });
          if (ok) mostrarGrade();
        },
      })
    )
  );
  alvo.append(h('div', { class: 'tela__topo buzzer-topo' }, h('div', null, h('h1', { tabindex: '-1' }, atividade.titulo), h('p', { class: 'tela__subtitulo' }, t('provaInd.dica'))), extraTopo), corpo);
  host.transmitirEstados();
  desenhar();
  const intervalo = setInterval(tique, 1000);
  return () => clearInterval(intervalo);
}
